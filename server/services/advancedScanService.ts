/**
 * Advanced Scan Service
 * Integrates the new ScraperEngine with existing scan infrastructure
 */

import * as db from "../db";
import { sendScanReportAuto } from "./emailService";
import { getScraperEngine, ScraperEngine } from "./scraper/ScraperEngine";
import type { ScraperConfig, ScraperContext, RoomType } from "./scraper/types";

interface ScanProgress {
  scanId: number;
  totalHotels: number;
  completedHotels: number;
  status: "running" | "completed" | "failed";
  error?: string;
  useAdvancedScraper?: boolean;
}

interface ScanOptions {
  useAdvancedScraper?: boolean; // Use new ScraperEngine vs old Python scraper
  enableBrowserSteps?: boolean;
  enableProxyRotation?: boolean;
  enableJsonExtraction?: boolean;
  enableChangeDetection?: boolean;
  enableScreenshots?: boolean;
}

/**
 * Execute scan with advanced scraper engine
 */
export async function executeAdvancedScan(
  configId: number,
  options: ScanOptions = {}
): Promise<ScanProgress> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[AdvancedScanService] ⚡ STARTING ADVANCED SCAN`);
  console.log(`[AdvancedScanService] Config ID: ${configId}`);
  console.log(`[AdvancedScanService] Options:`, options);
  console.log(`[AdvancedScanService] Timestamp: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  // Get scan configuration
  console.log(`[AdvancedScanService] 📋 Fetching scan configuration...`);
  const config = await db.getScanConfigById(configId);
  if (!config) {
    console.error(`[AdvancedScanService] ❌ Scan configuration not found`);
    throw new Error("Scan configuration not found");
  }
  
  console.log(`[AdvancedScanService] ✅ Config: "${config.name}"`);
  console.log(`[AdvancedScanService]    - Days forward: ${config.daysForward}`);
  console.log(`[AdvancedScanService]    - Room types: ${config.roomTypes}`);

  // Get hotels
  console.log(`[AdvancedScanService] 🏨 Fetching hotels...`);
  const hotels = await db.getHotelsForScanConfig(configId);
  if (hotels.length === 0) {
    throw new Error("No hotels configured for this scan");
  }
  console.log(`[AdvancedScanService] ✅ Found ${hotels.length} hotel(s)`);

  // Parse room types
  const roomTypes = JSON.parse(config.roomTypes) as RoomType[];

  // Create scan record
  console.log(`[AdvancedScanService] 💾 Creating scan record...`);
  const scanResult = await db.createScan({
    scanConfigId: configId,
    status: "running",
    totalHotels: hotels.length,
    completedHotels: 0,
  });

  const scanId = Number(scanResult[0]?.insertId || (scanResult as any).insertId);
  console.log(`[AdvancedScanService] ✅ Scan ID: ${scanId}`);

  const progress: ScanProgress = {
    scanId,
    totalHotels: hotels.length,
    completedHotels: 0,
    status: "running",
    useAdvancedScraper: options.useAdvancedScraper || false,
  };

  // Start background scan
  (async () => {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      console.log(`\n[AdvancedScanService] 🚀 Starting background process...`);

      // Get scraper engine
      const scraperEngine = getScraperEngine();

      for (const hotel of hotels) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`[AdvancedScanService] 🏨 Hotel ${progress.completedHotels + 1}/${hotels.length}: ${hotel.name}`);
        console.log(`${"─".repeat(60)}`);

        try {
          // Build scraper config
          const scraperConfig = buildScraperConfig(
            hotel.bookingUrl,
            config.daysForward,
            roomTypes,
            options
          );

          // Build context
          const context: ScraperContext = {
            config: scraperConfig,
            startDate,
            hotel: {
              id: hotel.id,
              name: hotel.name,
              bookingUrl: hotel.bookingUrl,
            },
            scanId,
          };

          // Execute scraping
          console.log(`[AdvancedScanService] 🔍 Starting scrape with ${scraperConfig.fetcherType}...`);
          const results = await scraperEngine.scrape(scraperConfig, context);
          console.log(`[AdvancedScanService] ✅ Got ${results.length} results`);

          // Save results to database
          console.log(`[AdvancedScanService] 💾 Saving to database...`);
          let savedCount = 0;

          for (const result of results) {
            // Skip if no price
            if (!result.price) {
              continue;
            }

            await db.createScanResult({
              scanId,
              hotelId: hotel.id,
              checkInDate: result.date,
              roomType: result.roomType,
              price: Math.round(result.price * 100), // Convert to cents
              isAvailable: result.available ? 1 : 0,
            });

            savedCount++;
          }

          console.log(`[AdvancedScanService] ✅ Saved ${savedCount} results`);

          // Save snapshot for debugging
          try {
            await db.createScrapeSnapshot({
              scanId,
              hotelId: hotel.id,
              snapshotType: 'advanced_scraper_results',
              data: JSON.stringify(results, null, 2),
              dataSize: JSON.stringify(results).length,
              checkInDate: startDate.toISOString().split('T')[0],
            });
          } catch (snapshotError) {
            console.error(`[AdvancedScanService] Warning: Snapshot save failed:`, snapshotError);
          }

          progress.completedHotels++;
          await db.updateScan(scanId, {
            completedHotels: progress.completedHotels,
          });

        } catch (error: any) {
          console.error(`[AdvancedScanService] ❌ Hotel scan failed:`, error.message);

          // Log error
          try {
            await db.createScraperError({
              scanId,
              hotelId: hotel.id,
              errorType: 'other',
              errorMessage: error.message,
              stackTrace: error.stack,
              url: hotel.bookingUrl,
              checkInDate: startDate.toISOString().split('T')[0],
              metadata: JSON.stringify({
                useAdvancedScraper: true,
                options,
              }),
            });
          } catch (logError) {
            console.error(`[AdvancedScanService] Error logging failed:`, logError);
          }

          // Continue with next hotel
        }
      }

      // Mark as completed
      progress.status = "completed";
      console.log(`\n${"=".repeat(80)}`);
      console.log(`[AdvancedScanService] ✅ SCAN COMPLETED`);
      console.log(`[AdvancedScanService] Processed: ${progress.completedHotels}/${progress.totalHotels}`);
      console.log(`${"=".repeat(80)}\n`);

      await db.updateScan(scanId, {
        status: "completed",
        completedAt: new Date(),
      });

      // Send email
      try {
        const emailSent = await sendScanReportAuto(scanId);
        if (emailSent) {
          console.log(`[AdvancedScanService] ✅ Email sent`);
        }
      } catch (emailError: any) {
        console.error(`[AdvancedScanService] Email error:`, emailError.message);
      }

    } catch (error: any) {
      console.error(`\n${"=".repeat(80)}`);
      console.error(`[AdvancedScanService] ❌ SCAN FAILED`);
      console.error(`[AdvancedScanService] Error:`, error.message);
      console.error(`${"=".repeat(80)}\n`);

      progress.status = "failed";
      progress.error = error.message;

      await db.updateScan(scanId, {
        status: "failed",
        errorMessage: error.message,
      });
    }
  })();

  return progress;
}

/**
 * Build scraper configuration from options
 */
function buildScraperConfig(
  hotelUrl: string,
  daysForward: number,
  roomTypes: RoomType[],
  options: ScanOptions
): ScraperConfig {
  // Start with default config
  let config = ScraperEngine.createDefaultConfig(hotelUrl, daysForward, roomTypes);

  // Enable browser steps
  if (options.enableBrowserSteps) {
    config = ScraperEngine.createBookingComConfig(hotelUrl, daysForward, true);
  }

  // Enable proxy rotation
  if (options.enableProxyRotation) {
    const proxyUrl = process.env.PROXY_URL;
    const proxyType = (process.env.PROXY_TYPE as any) || 'http';
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;

    if (proxyUrl) {
      config.proxy = {
        enabled: true,
        type: proxyType,
        url: proxyUrl,
        username: proxyUsername,
        password: proxyPassword,
        rotationInterval: 10,
      };
      console.log(`[AdvancedScanService] Proxy enabled: ${proxyType}`);
    } else {
      console.log(`[AdvancedScanService] Proxy requested but PROXY_URL not set`);
    }
  }

  // Enable JSON extraction
  if (options.enableJsonExtraction) {
    config.jsonExtractor = {
      path: '$.offers.price',
      type: 'jsonpath',
    };
    console.log(`[AdvancedScanService] JSON extraction enabled`);
  }

  // Enable change detection
  if (options.enableChangeDetection) {
    config.changeDetection = {
      enabled: true,
      ignoreWhitespace: true,
      minimumChange: 5,
      notifyOnDecrease: true,
      notifyOnIncrease: true,
    };
    console.log(`[AdvancedScanService] Change detection enabled`);
  }

  // Enable screenshots
  if (options.enableScreenshots) {
    config.screenshot = {
      enabled: true,
      fullPage: false,
      onlyOnChange: true,
      format: 'png',
    };
    console.log(`[AdvancedScanService] Screenshots enabled`);
  }

  return config;
}

/**
 * Get scan progress
 */
export async function getScanProgress(scanId: number): Promise<ScanProgress | null> {
  const scan = await db.getScanById(scanId);
  if (!scan) {
    return null;
  }

  return {
    scanId: scan.id,
    totalHotels: scan.totalHotels || 0,
    completedHotels: scan.completedHotels || 0,
    status: scan.status as "running" | "completed" | "failed",
    error: scan.errorMessage || undefined,
  };
}
