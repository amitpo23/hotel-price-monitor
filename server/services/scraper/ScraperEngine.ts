/**
 * Advanced Scraper Engine
 * Main orchestrator for all scraping strategies
 * Inspired by changedetection.io's architecture
 */

import {
  ScraperConfig,
  ScraperContext,
  ScraperResult,
  IFetcherStrategy,
  FetcherType
} from './types';
import { PlaywrightStrategy } from './strategies/PlaywrightStrategy';
import { DEFAULT_RETRY_CONFIG } from './utils/retryHandler';

export class ScraperEngine {
  private strategies: Map<FetcherType, IFetcherStrategy> = new Map();

  constructor() {
    // Register available strategies
    this.registerStrategy(new PlaywrightStrategy());
    
    console.log(`[ScraperEngine] Initialized with ${this.strategies.size} strategy(ies)`);
  }

  /**
   * Register a scraping strategy
   */
  private registerStrategy(strategy: IFetcherStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`[ScraperEngine] Registered strategy: ${strategy.name}`);
  }

  /**
   * Get strategy by type
   */
  private getStrategy(type: FetcherType): IFetcherStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Strategy "${type}" not found. Available: ${Array.from(this.strategies.keys()).join(', ')}`);
    }
    return strategy;
  }

  /**
   * Main scraping method
   */
  async scrape(
    config: ScraperConfig,
    context: ScraperContext
  ): Promise<ScraperResult[]> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[ScraperEngine] 🚀 STARTING SCRAPE`);
    console.log(`[ScraperEngine] Hotel: ${context.hotel.name}`);
    console.log(`[ScraperEngine] URL: ${context.hotel.bookingUrl}`);
    console.log(`[ScraperEngine] Fetcher: ${config.fetcherType}`);
    console.log(`[ScraperEngine] Days forward: ${config.daysForward}`);
    console.log(`[ScraperEngine] Room types: ${config.roomTypes.join(', ')}`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();

    try {
      // Get strategy
      const strategy = this.getStrategy(config.fetcherType);

      // Execute scraping
      const results = await strategy.fetch(
        context.hotel.bookingUrl,
        config,
        context
      );

      // Post-process results
      const processedResults = await this.postProcessResults(results, config, context);

      const duration = Date.now() - startTime;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[ScraperEngine] ✅ SCRAPE COMPLETED`);
      console.log(`[ScraperEngine] Total results: ${processedResults.length}`);
      console.log(`[ScraperEngine] Duration: ${duration}ms`);
      console.log(`${'='.repeat(80)}\n`);

      return processedResults;

    } catch (error: any) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`[ScraperEngine] ❌ SCRAPE FAILED`);
      console.error(`[ScraperEngine] Error: ${error.message}`);
      console.error(`[ScraperEngine] Stack: ${error.stack}`);
      console.error(`${'='.repeat(80)}\n`);

      throw error;
    }
  }

  /**
   * Post-process results (change detection, filtering, etc.)
   */
  private async postProcessResults(
    results: ScraperResult[],
    config: ScraperConfig,
    context: ScraperContext
  ): Promise<ScraperResult[]> {
    console.log(`[ScraperEngine] 🔄 Post-processing ${results.length} results...`);

    const processedResults: ScraperResult[] = [];

    for (const result of results) {
      // Filter by room types
      if (!config.roomTypes.includes(result.roomType)) {
        continue;
      }

      // Apply change detection if enabled
      if (config.changeDetection?.enabled) {
        const previousResult = await this.getPreviousResult(
          context.scanId,
          context.hotel.id,
          result.date,
          result.roomType
        );

        if (previousResult) {
          result.previousPrice = previousResult.price || undefined;
          
          if (result.price && previousResult.price) {
            result.priceChange = result.price - previousResult.price;
            result.priceChangePercent = 
              ((result.price - previousResult.price) / previousResult.price) * 100;

            // Check if change is significant
            const minimumChange = config.changeDetection.minimumChange || 0;
            result.changeDetected = Math.abs(result.priceChangePercent) >= minimumChange;

            // Log significant changes
            if (result.changeDetected) {
              console.log(
                `[ScraperEngine] 🔔 Price change detected for ${result.date}: ` +
                `₪${previousResult.price} → ₪${result.price} ` +
                `(${result.priceChangePercent.toFixed(1)}%)`
              );
            }
          }
        }
      }

      processedResults.push(result);
    }

    console.log(`[ScraperEngine] ✅ Post-processing complete: ${processedResults.length} results`);
    return processedResults;
  }

  /**
   * Get previous scraping result for change detection
   * (This would query the database)
   */
  private async getPreviousResult(
    scanId: number | undefined,
    hotelId: number,
    date: string,
    roomType: string
  ): Promise<{ price: number | null } | null> {
    // TODO: Query database for previous result
    // For now, return null (no previous data)
    return null;
  }

  /**
   * Create default configuration
   */
  static createDefaultConfig(
    hotelUrl: string,
    daysForward: number = 60,
    roomTypes: ('room_only' | 'with_breakfast')[] = ['room_only', 'with_breakfast']
  ): ScraperConfig {
    return {
      hotelUrl,
      fetcherType: 'playwright',
      daysForward,
      roomTypes,
      
      // Retry configuration
      retry: DEFAULT_RETRY_CONFIG,
      
      // Rate limiting
      delayBetweenRequests: 1000, // 1 second between requests
      concurrentRequests: 1,
      
      // Browser configuration
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      
      // Change detection
      changeDetection: {
        enabled: true,
        ignoreWhitespace: true,
        minimumChange: 5, // Alert on 5% or more price change
        notifyOnDecrease: true,
        notifyOnIncrease: true
      },
      
      // Screenshot
      screenshot: {
        enabled: false,
        fullPage: false,
        onlyOnChange: true,
        format: 'png'
      }
    };
  }

  /**
   * Create configuration with browser steps for Booking.com
   */
  static createBookingComConfig(
    hotelUrl: string,
    daysForward: number = 60,
    useBrowserSteps: boolean = true
  ): ScraperConfig {
    const config = this.createDefaultConfig(hotelUrl, daysForward);

    if (useBrowserSteps) {
      // Browser steps will be dynamically generated per date
      // For now, we'll add common steps like accepting cookies
      config.browserSteps = [
        {
          type: 'wait',
          timeout: 2000,
          description: 'Wait for page to load'
        },
        {
          type: 'executeJs',
          code: `
            // Accept cookies
            const cookieButton = document.querySelector('[data-testid="cookie-banner-accept"]') ||
                                document.querySelector('#onetrust-accept-btn-handler');
            if (cookieButton) cookieButton.click();
            
            // Close any popups
            const closeButton = document.querySelector('[data-testid="modal-close"]');
            if (closeButton) closeButton.click();
          `,
          description: 'Accept cookies and close popups'
        },
        {
          type: 'waitForSelector',
          selector: '[data-testid="property-card"], .hprt-table',
          timeout: 15000,
          description: 'Wait for rooms to load'
        }
      ];
    }

    return config;
  }

  /**
   * Create configuration with proxy support
   */
  static createConfigWithProxy(
    hotelUrl: string,
    proxyUrl: string,
    proxyType: 'http' | 'socks5' | 'brightdata' | 'oxylabs' = 'http',
    username?: string,
    password?: string
  ): ScraperConfig {
    const config = this.createDefaultConfig(hotelUrl);

    config.proxy = {
      enabled: true,
      type: proxyType,
      url: proxyUrl,
      username,
      password,
      rotationInterval: 10 // Rotate after 10 requests
    };

    return config;
  }

  /**
   * Create configuration with JSON extraction
   */
  static createConfigWithJsonExtraction(
    hotelUrl: string,
    jsonPath: string = '$.offers.price'
  ): ScraperConfig {
    const config = this.createDefaultConfig(hotelUrl);

    config.jsonExtractor = {
      path: jsonPath,
      type: 'jsonpath'
    };

    return config;
  }
}

/**
 * Singleton instance
 */
let scraperEngineInstance: ScraperEngine | null = null;

export function getScraperEngine(): ScraperEngine {
  if (!scraperEngineInstance) {
    scraperEngineInstance = new ScraperEngine();
  }
  return scraperEngineInstance;
}

/**
 * Reset engine (useful for testing)
 */
export function resetScraperEngine(): void {
  scraperEngineInstance = null;
}
