/**
 * Advanced Playwright Strategy
 * Full-featured scraper with browser automation, proxy support, and anti-bot measures
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { 
  IFetcherStrategy, 
  ScraperConfig, 
  ScraperContext, 
  ScraperResult, 
  BrowserStep,
  ScreenshotConfig 
} from '../types';
import { RetryHandler, DEFAULT_RETRY_CONFIG } from '../utils/retryHandler';
import { ProxyManager } from '../utils/proxyManager';
import { BrowserStepsExecutor } from '../utils/browserSteps';
import { extractPrice } from '../utils/jsonExtractor';

export class PlaywrightStrategy implements IFetcherStrategy {
  name = 'playwright' as const;
  private browser: Browser | null = null;
  private retryHandler: RetryHandler;
  private proxyManager: ProxyManager | null = null;

  constructor() {
    this.retryHandler = new RetryHandler(DEFAULT_RETRY_CONFIG);
  }

  /**
   * Main fetch method
   */
  async fetch(
    url: string, 
    config: ScraperConfig, 
    context: ScraperContext
  ): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [];
    const startTime = Date.now();

    console.log(`\n[PlaywrightStrategy] 🚀 Starting scrape for ${context.hotel.name}`);
    console.log(`[PlaywrightStrategy] URL: ${url}`);
    console.log(`[PlaywrightStrategy] Days forward: ${config.daysForward}`);

    try {
      // Initialize browser
      await this.initBrowser(config);

      // Initialize proxy if configured
      if (config.proxy?.enabled) {
        this.proxyManager = new ProxyManager(config.proxy);
        console.log(`[PlaywrightStrategy] Proxy enabled: ${config.proxy.type}`);
      }

      // Create browser context
      const browserContext = await this.createContext(config);

      // Iterate through dates
      for (let dayOffset = 0; dayOffset < config.daysForward; dayOffset++) {
        const checkIn = new Date(context.startDate);
        checkIn.setDate(checkIn.getDate() + dayOffset);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 1);

        const checkInStr = checkIn.toISOString().split('T')[0];
        const checkOutStr = checkOut.toISOString().split('T')[0];

        console.log(`\n[PlaywrightStrategy] 📅 Processing date: ${checkInStr}`);

        try {
          // Build URL with date parameters
          const dateUrl = this.buildDateUrl(url, checkInStr, checkOutStr);

          // Scrape this date with retry
          const dateResults = await this.retryHandler.execute(
            async () => await this.scrapeSingleDate(
              browserContext,
              dateUrl,
              checkInStr,
              config,
              context
            ),
            (attempt, error, delay) => {
              console.log(
                `[PlaywrightStrategy] ⚠️  Retry ${attempt}/${this.retryHandler.getAttempts()} ` +
                `after ${delay}ms for date ${checkInStr}. Error: ${error.message}`
              );
            }
          );

          results.push(...dateResults);

          // Delay between requests (rate limiting)
          if (config.delayBetweenRequests && dayOffset < config.daysForward - 1) {
            console.log(`[PlaywrightStrategy] 💤 Sleeping ${config.delayBetweenRequests}ms...`);
            await this.sleep(config.delayBetweenRequests);
          }

        } catch (error: any) {
          console.error(`[PlaywrightStrategy] ❌ Failed to scrape date ${checkInStr}:`, error.message);
          
          // Add error result
          results.push({
            date: checkInStr,
            roomType: 'room_only',
            price: null,
            currency: 'ILS',
            available: false,
            error: error.message,
            fetcherUsed: 'playwright',
            attempts: this.retryHandler.getAttempts(),
            scrapeDuration: Date.now() - startTime,
            timestamp: new Date()
          });
        }

        // Reset retry counter for next date
        this.retryHandler.reset();
      }

      await browserContext.close();

    } finally {
      await this.cleanup();
    }

    console.log(`\n[PlaywrightStrategy] ✅ Completed scraping ${results.length} results in ${Date.now() - startTime}ms`);
    return results;
  }

  /**
   * Scrape a single date
   */
  private async scrapeSingleDate(
    context: BrowserContext,
    url: string,
    checkInDate: string,
    config: ScraperConfig,
    scraperContext: ScraperContext
  ): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [];
    const page = await context.newPage();
    const startTime = Date.now();

    try {
      // Navigate to page
      console.log(`[PlaywrightStrategy] 🌐 Navigating to ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });

      // Execute browser steps if configured
      if (config.browserSteps && config.browserSteps.length > 0) {
        console.log(`[PlaywrightStrategy] 🎬 Executing ${config.browserSteps.length} browser steps...`);
        await this.executeBrowserSteps(config.browserSteps, page);
      }

      // Execute custom JS before scrape if configured
      if (config.executeJsBeforeScrape) {
        console.log(`[PlaywrightStrategy] 🔧 Executing custom JavaScript...`);
        await page.evaluate(config.executeJsBeforeScrape);
      }

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Get page content
      const html = await page.content();

      // Check availability
      const noAvailability = await page.locator('text=/no availability|sold out|not available/i').count() > 0;

      if (noAvailability) {
        console.log(`[PlaywrightStrategy] ❌ No availability for ${checkInDate}`);
        results.push({
          date: checkInDate,
          roomType: 'room_only',
          price: null,
          currency: 'ILS',
          available: false,
          fetcherUsed: 'playwright',
          attempts: this.retryHandler.getAttempts(),
          scrapeDuration: Date.now() - startTime,
          timestamp: new Date()
        });
        return results;
      }

      // Try JSON extraction first if configured
      let priceFromJson: number | null = null;
      if (config.jsonExtractor) {
        console.log(`[PlaywrightStrategy] 🔍 Attempting JSON extraction...`);
        priceFromJson = await extractPrice(html, [config.jsonExtractor.path]);
        if (priceFromJson) {
          console.log(`[PlaywrightStrategy] ✅ Found price from JSON: ${priceFromJson}`);
        }
      }

      // Extract room prices using selectors
      const priceSelectors = config.priceSelectors || [
        '[data-testid="price-and-discounted-price"]',
        '.prco-valign-middle-helper',
        '.bui-price-display__value',
        '.prco-text-nowrap-helper',
        'span[aria-hidden="true"]'
      ];

      // Find room blocks
      const roomBlocks = await page.locator(
        '[data-testid="property-card-container"], .hprt-table-row, [data-block-id], .room-block'
      ).all();

      console.log(`[PlaywrightStrategy] Found ${roomBlocks.length} room blocks`);

      // Process each room
      for (const roomBlock of roomBlocks.slice(0, 10)) {
        try {
          // Get room description
          const roomNameSelectors = config.roomNameSelectors || [
            '.hprt-roomtype-icon-link',
            '[data-testid="title"]',
            '.room-name'
          ];

          let roomDesc = '';
          for (const selector of roomNameSelectors) {
            const elem = roomBlock.locator(selector).first();
            if (await elem.count() > 0) {
              roomDesc = await elem.innerText();
              break;
            }
          }

          roomDesc = roomDesc.toLowerCase();

          // Determine room type
          const hasBreakfast = ['breakfast', 'ארוחת בוקר', 'כולל ארוחה'].some(
            keyword => roomDesc.includes(keyword)
          );
          const roomType = hasBreakfast ? 'with_breakfast' : 'room_only';

          // Skip if not in requested room types
          if (!config.roomTypes.includes(roomType)) {
            continue;
          }

          // Extract price
          let price: number | null = priceFromJson; // Use JSON price if available

          if (!price) {
            for (const selector of priceSelectors) {
              const priceElem = roomBlock.locator(selector).first();
              if (await priceElem.count() > 0) {
                const priceText = await priceElem.innerText();
                if (priceText && /\d/.test(priceText)) {
                  const priceClean = priceText.replace(/[^\d.]/g, '');
                  price = parseFloat(priceClean);
                  if (!isNaN(price)) {
                    break;
                  }
                }
              }
            }
          }

          if (!price) {
            continue;
          }

          // Detect currency
          const priceText = await roomBlock.innerText();
          let currency = 'ILS';
          if (priceText.includes('₪') || priceText.includes('ILS')) {
            currency = 'ILS';
          } else if (priceText.includes('$') || priceText.includes('USD')) {
            currency = 'USD';
          } else if (priceText.includes('€') || priceText.includes('EUR')) {
            currency = 'EUR';
          }

          // Capture screenshot if configured
          let screenshot: string | undefined;
          if (config.screenshot?.enabled) {
            screenshot = await this.captureScreenshot(page, config.screenshot);
          }

          results.push({
            date: checkInDate,
            roomType,
            price,
            currency,
            available: true,
            screenshot,
            fetcherUsed: 'playwright',
            proxyUsed: this.proxyManager?.getStats().currentIndex.toString(),
            attempts: this.retryHandler.getAttempts(),
            scrapeDuration: Date.now() - startTime,
            timestamp: new Date()
          });

        } catch (error: any) {
          console.error(`[PlaywrightStrategy] Error processing room:`, error.message);
          continue;
        }
      }

      // If no results, mark as unavailable
      if (results.length === 0) {
        results.push({
          date: checkInDate,
          roomType: 'room_only',
          price: null,
          currency: 'ILS',
          available: false,
          fetcherUsed: 'playwright',
          attempts: this.retryHandler.getAttempts(),
          scrapeDuration: Date.now() - startTime,
          timestamp: new Date()
        });
      }

    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Initialize browser
   */
  private async initBrowser(config: ScraperConfig): Promise<void> {
    if (this.browser) {
      return;
    }

    console.log(`[PlaywrightStrategy] 🚀 Launching Chromium browser...`);

    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    this.browser = await chromium.launch(launchOptions);
    console.log(`[PlaywrightStrategy] ✅ Browser launched`);
  }

  /**
   * Create browser context with configuration
   */
  private async createContext(config: ScraperConfig): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const contextOptions: any = {
      viewport: config.viewport || { width: 1920, height: 1080 },
      userAgent: config.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem'
    };

    // Add proxy if configured
    if (this.proxyManager) {
      const proxyConfig = this.proxyManager.getPlaywrightProxyConfig();
      if (proxyConfig) {
        contextOptions.proxy = proxyConfig;
      }
    }

    // Add extra headers
    if (config.headers) {
      contextOptions.extraHTTPHeaders = config.headers;
    }

    const context = await this.browser.newContext(contextOptions);

    // Set cookies if configured
    if (config.cookies) {
      await context.addCookies(config.cookies);
    }

    // Stealth mode - hide automation indicators
    await context.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );
    });

    return context;
  }

  /**
   * Execute browser steps
   */
  async executeBrowserSteps(steps: BrowserStep[], page: Page): Promise<void> {
    await BrowserStepsExecutor.execute(page, steps);
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(page: Page, config: ScreenshotConfig): Promise<string | undefined> {
    try {
      const screenshot = await page.screenshot({
        fullPage: config.fullPage,
        type: config.format || 'png',
        quality: config.quality
      });

      return screenshot.toString('base64');
    } catch (error: any) {
      console.error(`[PlaywrightStrategy] Screenshot capture failed:`, error.message);
      return undefined;
    }
  }

  /**
   * Build URL with date parameters
   */
  private buildDateUrl(baseUrl: string, checkIn: string, checkOut: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('checkin', checkIn);
    url.searchParams.set('checkout', checkOut);
    url.searchParams.set('group_adults', '2');
    url.searchParams.set('group_children', '0');
    url.searchParams.set('no_rooms', '1');
    return url.toString();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      console.log(`[PlaywrightStrategy] 🧹 Closing browser...`);
      await this.browser.close();
      this.browser = null;
    }
  }
}
