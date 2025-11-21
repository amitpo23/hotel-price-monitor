/**
 * Advanced Scraper Engine - Type Definitions
 * Inspired by changedetection.io architecture
 */

export type FetcherType = 'playwright' | 'http' | 'puppeteer';
export type RoomType = 'room_only' | 'with_breakfast';

/**
 * Browser interaction step for automated workflows
 * Similar to changedetection.io's Browser Steps feature
 */
export interface BrowserStep {
  type: 'click' | 'fill' | 'select' | 'wait' | 'waitForSelector' | 'screenshot' | 'executeJs';
  selector?: string;
  value?: string;
  timeout?: number;
  code?: string; // For executeJs type
  description?: string;
}

/**
 * Proxy configuration with rotation support
 */
export interface ProxyConfig {
  enabled: boolean;
  type?: 'http' | 'socks5' | 'brightdata' | 'oxylabs';
  url?: string;
  username?: string;
  password?: string;
  country?: string; // For geo-targeting
  rotationInterval?: number; // Rotate after N requests
}

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number; // Exponential backoff factor
  retryOnStatusCodes: number[]; // e.g., [429, 503, 504]
}

/**
 * JSON extraction configuration (JSONPath or jq-like)
 */
export interface JsonExtractor {
  path: string; // JSONPath expression like $.price or .rooms[0].price
  type: 'jsonpath' | 'jq';
  fallback?: string; // Fallback selector if JSON extraction fails
}

/**
 * Visual element selector (point-and-click replacement for manual selectors)
 */
export interface VisualSelector {
  xpath: string;
  cssSelector: string;
  screenshot?: string; // Base64 screenshot with element highlighted
  confidence: number; // 0-100
}

/**
 * Change detection configuration
 */
export interface ChangeDetectionConfig {
  enabled: boolean;
  ignoreWhitespace: boolean;
  minimumChange: number; // Minimum % change to trigger alert
  notifyOnDecrease: boolean;
  notifyOnIncrease: boolean;
  threshold?: number; // Alert only if price change > threshold
}

/**
 * Screenshot capture settings
 */
export interface ScreenshotConfig {
  enabled: boolean;
  fullPage: boolean;
  onlyOnChange: boolean;
  format: 'png' | 'jpeg';
  quality?: number; // 0-100 for JPEG
}

/**
 * Main scraper configuration
 */
export interface ScraperConfig {
  // Core settings
  hotelUrl: string;
  fetcherType: FetcherType;
  daysForward: number;
  roomTypes: RoomType[];
  
  // Advanced features
  browserSteps?: BrowserStep[];
  proxy?: ProxyConfig;
  retry?: RetryConfig;
  jsonExtractor?: JsonExtractor;
  visualSelector?: VisualSelector;
  changeDetection?: ChangeDetectionConfig;
  screenshot?: ScreenshotConfig;
  
  // Selectors (traditional)
  priceSelectors?: string[];
  roomNameSelectors?: string[];
  availabilitySelectors?: string[];
  
  // Anti-bot measures
  userAgent?: string;
  viewport?: { width: number; height: number };
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string }>;
  executeJsBeforeScrape?: string; // Custom JS to run before extraction
  
  // Rate limiting
  delayBetweenRequests?: number; // milliseconds
  concurrentRequests?: number;
}

/**
 * Scraper result with enhanced metadata
 */
export interface ScraperResult {
  date: string;
  roomType: RoomType;
  price: number | null;
  currency: string;
  available: boolean;
  
  // Enhanced metadata
  screenshot?: string; // Base64 encoded screenshot
  rawHtml?: string; // For debugging
  jsonData?: any; // Extracted JSON data
  changeDetected?: boolean;
  previousPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  
  // Metadata
  fetcherUsed: FetcherType;
  proxyUsed?: string;
  attempts: number;
  scrapeDuration: number; // milliseconds
  timestamp: Date;
  error?: string;
}

/**
 * Scraper execution context
 */
export interface ScraperContext {
  config: ScraperConfig;
  startDate: Date;
  hotel: {
    id: number;
    name: string;
    bookingUrl: string;
  };
  scanId?: number;
}

/**
 * Strategy interface for different fetchers
 */
export interface IFetcherStrategy {
  name: FetcherType;
  fetch(url: string, config: ScraperConfig, context: ScraperContext): Promise<ScraperResult[]>;
  executeBrowserSteps?(steps: BrowserStep[], page: any): Promise<void>;
  captureScreenshot?(page: any, config: ScreenshotConfig): Promise<string | undefined>;
}
