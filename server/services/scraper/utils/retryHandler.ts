/**
 * Smart Retry Handler with Exponential Backoff
 * Inspired by changedetection.io's robust retry logic
 */

import { RetryConfig } from '../types';

export class RetryHandler {
  private attempts = 0;
  
  constructor(private config: RetryConfig) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delay: number) => void
  ): Promise<T> {
    this.attempts = 0;

    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        this.attempts++;

        // Check if we should retry
        if (!this.shouldRetry(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay();

        // Notify about retry
        if (onRetry) {
          onRetry(this.attempts, error, delay);
        }

        console.log(
          `[RetryHandler] Attempt ${this.attempts}/${this.config.maxAttempts} failed. ` +
          `Retrying in ${delay}ms... Error: ${error.message}`
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Max attempts reached
    if (this.attempts >= this.config.maxAttempts) {
      console.log(`[RetryHandler] Max attempts (${this.config.maxAttempts}) reached. Giving up.`);
      return false;
    }

    // Network errors are always retryable
    const networkErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'TimeoutError',
      'net::ERR_'
    ];

    if (networkErrors.some(code => error.message?.includes(code) || error.code?.includes(code))) {
      return true;
    }

    // Check HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      if (this.config.retryOnStatusCodes.includes(status)) {
        return true;
      }
    }

    // Bot detection indicators (retry with different strategy)
    const botIndicators = [
      'captcha',
      'challenge',
      'blocked',
      'denied',
      'forbidden',
      'too many requests',
      'rate limit'
    ];

    if (botIndicators.some(indicator => error.message?.toLowerCase().includes(indicator))) {
      console.log(`[RetryHandler] Bot detection suspected: ${error.message}`);
      return true;
    }

    // Don't retry on other errors
    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(): number {
    // Base delay with exponential backoff
    const exponentialDelay = this.config.initialDelay * 
      Math.pow(this.config.backoffMultiplier, this.attempts - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter (random ±20%) to avoid thundering herd
    const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);

    return Math.round(cappedDelay + jitter);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current attempt number
   */
  getAttempts(): number {
    return this.attempts;
  }

  /**
   * Reset attempt counter
   */
  reset(): void {
    this.attempts = 0;
  }
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * Aggressive retry for important operations
 */
export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 2.5,
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504]
};
