/**
 * Proxy Rotation Manager
 * Supports multiple proxy providers including Bright Data and Oxylabs
 */

import { ProxyConfig } from '../types';

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private requestCount = 0;
  private lastRotation = Date.now();

  constructor(proxies: ProxyConfig | ProxyConfig[]) {
    this.proxies = Array.isArray(proxies) ? proxies : [proxies];
    
    if (this.proxies.length === 0) {
      throw new Error('At least one proxy configuration is required');
    }

    console.log(`[ProxyManager] Initialized with ${this.proxies.length} proxy configuration(s)`);
  }

  /**
   * Get next proxy in rotation
   */
  getNextProxy(): ProxyConfig {
    const proxy = this.proxies[this.currentIndex];

    // Check if we should rotate
    const shouldRotate = 
      proxy.rotationInterval && 
      this.requestCount >= proxy.rotationInterval;

    if (shouldRotate) {
      this.rotate();
    }

    this.requestCount++;
    return this.proxies[this.currentIndex];
  }

  /**
   * Rotate to next proxy
   */
  private rotate(): void {
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    this.requestCount = 0;
    this.lastRotation = Date.now();
    
    console.log(
      `[ProxyManager] Rotated to proxy ${this.currentIndex + 1}/${this.proxies.length}`
    );
  }

  /**
   * Force rotation (e.g., when proxy is blocked)
   */
  forceRotate(): void {
    console.log(`[ProxyManager] Force rotating due to proxy failure`);
    this.rotate();
  }

  /**
   * Get formatted proxy URL for browser/HTTP client
   */
  getProxyUrl(proxy?: ProxyConfig): string | undefined {
    const p = proxy || this.getNextProxy();

    if (!p.enabled || !p.url) {
      return undefined;
    }

    // Format based on proxy type
    switch (p.type) {
      case 'brightdata':
        return this.formatBrightDataProxy(p);
      
      case 'oxylabs':
        return this.formatOxylabsProxy(p);
      
      case 'http':
      case 'socks5':
      default:
        return this.formatStandardProxy(p);
    }
  }

  /**
   * Format Bright Data proxy URL
   * https://brightdata.com/products/proxy-network
   */
  private formatBrightDataProxy(proxy: ProxyConfig): string {
    const { username, password, country } = proxy;
    
    // Bright Data format: username-country-COUNTRY:password@brd.superproxy.io:PORT
    const countryCode = country ? `-country-${country}` : '';
    const auth = `${username}${countryCode}:${password}`;
    const host = proxy.url || 'brd.superproxy.io:22225';
    
    return `http://${auth}@${host}`;
  }

  /**
   * Format Oxylabs proxy URL
   * https://oxylabs.io/products/residential-proxies
   */
  private formatOxylabsProxy(proxy: ProxyConfig): string {
    const { username, password, country } = proxy;
    
    // Oxylabs format: customer-USERNAME-country-COUNTRY:PASSWORD@pr.oxylabs.io:PORT
    const countryCode = country ? `-country-${country}` : '';
    const auth = `customer-${username}${countryCode}:${password}`;
    const host = proxy.url || 'pr.oxylabs.io:7777';
    
    return `http://${auth}@${host}`;
  }

  /**
   * Format standard HTTP/SOCKS5 proxy
   */
  private formatStandardProxy(proxy: ProxyConfig): string {
    const { type, url, username, password } = proxy;
    
    if (!url) {
      throw new Error('Proxy URL is required for standard proxies');
    }

    // With authentication
    if (username && password) {
      const protocol = type === 'socks5' ? 'socks5' : 'http';
      return `${protocol}://${username}:${password}@${url}`;
    }

    // Without authentication
    return url.startsWith('http') ? url : `http://${url}`;
  }

  /**
   * Get proxy configuration for Playwright
   */
  getPlaywrightProxyConfig(proxy?: ProxyConfig): any {
    const p = proxy || this.getNextProxy();

    if (!p.enabled) {
      return undefined;
    }

    const proxyUrl = this.getProxyUrl(p);
    if (!proxyUrl) {
      return undefined;
    }

    // Parse URL
    const url = new URL(proxyUrl);

    return {
      server: `${url.protocol}//${url.host}`,
      username: url.username || undefined,
      password: url.password || undefined
    };
  }

  /**
   * Get proxy configuration for Puppeteer
   */
  getPuppeteerProxyArgs(proxy?: ProxyConfig): string[] {
    const proxyUrl = this.getProxyUrl(proxy);
    
    if (!proxyUrl) {
      return [];
    }

    return [`--proxy-server=${proxyUrl}`];
  }

  /**
   * Check if proxy is enabled
   */
  isEnabled(): boolean {
    return this.proxies.some(p => p.enabled);
  }

  /**
   * Get current proxy stats
   */
  getStats() {
    return {
      totalProxies: this.proxies.length,
      currentIndex: this.currentIndex,
      requestCount: this.requestCount,
      timeSinceLastRotation: Date.now() - this.lastRotation
    };
  }
}

/**
 * Create proxy manager from environment variables
 */
export function createProxyManagerFromEnv(): ProxyManager | null {
  const proxyUrl = process.env.PROXY_URL;
  const proxyType = (process.env.PROXY_TYPE as any) || 'http';
  const proxyUsername = process.env.PROXY_USERNAME;
  const proxyPassword = process.env.PROXY_PASSWORD;
  const proxyCountry = process.env.PROXY_COUNTRY;

  if (!proxyUrl) {
    return null;
  }

  const config: ProxyConfig = {
    enabled: true,
    type: proxyType,
    url: proxyUrl,
    username: proxyUsername,
    password: proxyPassword,
    country: proxyCountry,
    rotationInterval: parseInt(process.env.PROXY_ROTATION_INTERVAL || '10', 10)
  };

  return new ProxyManager(config);
}
