import * as db from "../db";
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { sendScanReportAuto } from "./emailService";

const execFileAsync = promisify(execFile);

interface ScanProgress {
  scanId: number;
  totalHotels: number;
  completedHotels: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

/**
 * Execute a full scan for a configuration
 */
// Check if verbose logging is enabled (only in development)
const isVerbose = process.env.NODE_ENV === 'development' && process.env.VERBOSE_LOGS === 'true';

export async function executeScan(configId: number): Promise<ScanProgress> {
  console.log(`[ScanService] Starting scan for config ${configId}`);

  // Get scan configuration
  const config = await db.getScanConfigById(configId);
  if (!config) {
    console.error(`[ScanService] Config not found: ${configId}`);
    throw new Error("Scan configuration not found");
  }
  console.log(`[ScanService] Config: "${config.name}", days: ${config.daysForward}`);

  // Get hotels to scan
  const hotels = await db.getHotelsForScanConfig(configId);
  if (hotels.length === 0) {
    console.error(`[ScanService] No hotels for config ${configId}`);
    throw new Error("No hotels configured for this scan");
  }
  console.log(`[ScanService] Found ${hotels.length} hotels`);

  // Parse room types with error handling
  let roomTypes: ("room_only" | "with_breakfast")[];
  try {
    roomTypes = JSON.parse(config.roomTypes) as ("room_only" | "with_breakfast")[];
    if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
      throw new Error("Invalid room types configuration");
    }
  } catch (e) {
    console.error(`[ScanService] Invalid room types config`);
    throw new Error("Invalid room types configuration in database");
  }

  // Create scan record
  const scanResult = await db.createScan({
    scanConfigId: configId,
    status: "running",
    totalHotels: hotels.length,
    completedHotels: 0,
  });

  // Drizzle returns an array with insertId in the first element
  const scanId = Number(scanResult[0]?.insertId || (scanResult as any).insertId);
  console.log(`[ScanService] Created scan ${scanId}`);

  const progress: ScanProgress = {
    scanId,
    totalHotels: hotels.length,
    completedHotels: 0,
    status: "running",
  };

  // Start scanning in background (don't await)
  (async () => {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Start from today at midnight

      for (const hotel of hotels) {
        if (isVerbose) console.log(`[ScanService] Processing hotel ${progress.completedHotels + 1}/${hotels.length}`);

        try {
          // Scrape prices using Python scraper
          const pythonScript = path.join(__dirname, '../scripts/booking_scraper.py');
          const startDateStr = startDate.toISOString().split('T')[0];
          const roomTypesJson = JSON.stringify(roomTypes);

          // Use execFile with arguments array to prevent command injection
          const args = [
            pythonScript,
            hotel.bookingUrl,
            startDateStr,
            String(config.daysForward),
            roomTypesJson
          ];

          const { stdout, stderr } = await execFileAsync('python3', args, { maxBuffer: 10 * 1024 * 1024 });

          if (stderr && isVerbose) {
            console.log(`[ScanService] Scraper stderr present`);
          }

          const rawOutput = stdout.trim();
          const results = JSON.parse(rawOutput) as Array<{
            date: string;
            roomType: 'room_only' | 'with_breakfast';
            price: number;
            available: boolean;
          }>;

          // Save raw scraper output as snapshot for debugging (only in development)
          if (isVerbose) {
            try {
              await db.createScrapeSnapshot({
                scanId,
                hotelId: hotel.id,
                snapshotType: 'raw_json',
                data: rawOutput,
                dataSize: rawOutput.length,
                checkInDate: startDateStr,
              });
            } catch (snapshotError) {
              // Silently ignore snapshot errors
            }
          }

          // Save results to database
          let savedCount = 0;
          for (const result of results) {
            await db.createScanResult({
              scanId,
              hotelId: hotel.id,
              checkInDate: result.date,
              roomType: result.roomType,
              price: result.price,
              isAvailable: result.available ? 1 : 0,
            });
            savedCount++;
          }

          progress.completedHotels++;
          await db.updateScan(scanId, {
            completedHotels: progress.completedHotels,
          });

        } catch (error) {
          console.error(`[ScanService] Error scanning hotel ID ${hotel.id}`);

          // Log error to database for monitoring
          try {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stackTrace = error instanceof Error ? error.stack : undefined;

            // Determine error type based on error message
            let errorType: 'timeout' | 'network_error' | 'parsing_failed' | 'other' = 'other';
            if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
              errorType = 'timeout';
            } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
              errorType = 'network_error';
            } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
              errorType = 'parsing_failed';
            }

            await db.createScraperError({
              scanId,
              hotelId: hotel.id,
              errorType,
              errorMessage: errorMessage.substring(0, 500), // Truncate for safety
              stackTrace: isVerbose ? stackTrace : undefined,
              url: hotel.bookingUrl,
              checkInDate: startDate.toISOString().split('T')[0],
              metadata: JSON.stringify({
                errorType,
                daysForward: config.daysForward,
              }),
            });
          } catch (logError) {
            // Silently ignore logging errors
          }

          // Continue with next hotel
        }
      }

      // Mark scan as completed
      progress.status = "completed";
      console.log(`[ScanService] Scan ${scanId} completed: ${progress.completedHotels}/${progress.totalHotels}`);

      await db.updateScan(scanId, {
        status: "completed",
        completedAt: new Date(),
      });

      // Send email report
      try {
        await sendScanReportAuto(scanId);
      } catch (emailError: any) {
        // Email errors are non-critical
      }

    } catch (error: any) {
      console.error(`[ScanService] Scan ${scanId} failed`);

      progress.status = "failed";
      progress.error = "Scan failed"; // Generic error message

      await db.updateScan(scanId, {
        status: "failed",
        errorMessage: error.message?.substring(0, 500) || "Unknown error",
      });
    }
  })();

  return progress;
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
