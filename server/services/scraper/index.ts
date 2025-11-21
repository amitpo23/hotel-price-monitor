/**
 * Advanced Scraper Module
 * Exports all scraper components
 */

// Main engine
export { ScraperEngine, getScraperEngine, resetScraperEngine } from './ScraperEngine';

// Types
export type {
  FetcherType,
  RoomType,
  BrowserStep,
  ProxyConfig,
  RetryConfig,
  JsonExtractor,
  VisualSelector,
  ChangeDetectionConfig,
  ScreenshotConfig,
  ScraperConfig,
  ScraperResult,
  ScraperContext,
  IFetcherStrategy
} from './types';

// Strategies
export { PlaywrightStrategy } from './strategies/PlaywrightStrategy';

// Utils
export { RetryHandler, DEFAULT_RETRY_CONFIG, AGGRESSIVE_RETRY_CONFIG } from './utils/retryHandler';
export { ProxyManager, createProxyManagerFromEnv } from './utils/proxyManager';
export { JSONPathExtractor, HTMLJsonExtractor, extractWithJsonPath, extractPrice } from './utils/jsonExtractor';
export { BrowserStepsExecutor, BrowserStepsRecorder } from './utils/browserSteps';
