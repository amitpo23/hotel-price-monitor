import * as db from "../db";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { sendScanReportAuto } from "./emailService";

const execAsync = promisify(exec);

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
export async function executeScan(configId: number): Promise<ScanProgress> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[ScanService] ⚡ STARTING NEW SCAN`);
  console.log(`[ScanService] Config ID: ${configId}`);
  console.log(`[ScanService] Timestamp: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  // Get scan configuration
  console.log(`[ScanService] 📋 Fetching scan configuration...`);
  const config = await db.getScanConfigById(configId);
  if (!config) {
    console.error(`[ScanService] ❌ ERROR: Scan configuration not found for ID ${configId}`);
    throw new Error("Scan configuration not found");
  }
  console.log(`[ScanService] ✅ Config found: "${config.name}"`);
  console.log(`[ScanService]    - Days forward: ${config.daysForward}`);
  console.log(`[ScanService]    - Room types: ${config.roomTypes}`);
  console.log(`[ScanService]    - Target hotel ID: ${config.targetHotelId}`);

  // Get hotels to scan
  console.log(`[ScanService] 🏨 Fetching hotels to scan...`);
  const hotels = await db.getHotelsForScanConfig(configId);
  if (hotels.length === 0) {
    console.error(`[ScanService] ❌ ERROR: No hotels configured for this scan`);
    throw new Error("No hotels configured for this scan");
  }
  console.log(`[ScanService] ✅ Found ${hotels.length} hotels to scan:`);
  hotels.forEach((hotel, idx) => {
    console.log(`[ScanService]    ${idx + 1}. ${hotel.name} (${hotel.category})`);
  });

  // Parse room types
  const roomTypes = JSON.parse(config.roomTypes) as ("room_only" | "with_breakfast")[];
  console.log(`[ScanService] 🛏️  Room types to scan: ${roomTypes.join(", ")}`);

  // Create scan record
  console.log(`[ScanService] 💾 Creating scan record in database...`);
  const scanResult = await db.createScan({
    scanConfigId: configId,
    status: "running",
    totalHotels: hotels.length,
    completedHotels: 0,
  });

  // Drizzle returns an array with insertId in the first element
  const scanId = Number(scanResult[0]?.insertId || (scanResult as any).insertId);
  console.log(`[ScanService] ✅ Scan record created with ID: ${scanId}`);

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

      console.log(`\n[ScanService] 🚀 Starting background scan process...`);
      console.log(`[ScanService] Start date: ${startDate.toISOString().split('T')[0]}`);

      for (const hotel of hotels) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`[ScanService] 🏨 Processing hotel ${progress.completedHotels + 1}/${hotels.length}: ${hotel.name}`);
        console.log(`[ScanService] Booking URL: ${hotel.bookingUrl}`);
        console.log(`${"─".repeat(60)}`);

        try {
          // Scrape prices using Python scraper
          const pythonScript = path.join(__dirname, '../scripts/booking_scraper.py');
          console.log(`[ScanService] Python script path: ${pythonScript}`);
          const startDateStr = startDate.toISOString().split('T')[0];
          const roomTypesJson = JSON.stringify(roomTypes);

          const command = `python3.11 "${pythonScript}" "${hotel.bookingUrl}" "${startDateStr}" ${config.daysForward} '${roomTypesJson}'`;

          console.log(`[ScanService] 🐍 Executing Python scraper...`);
          console.log(`[ScanService] Command: ${command}`);

          const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

          if (stderr) {
            console.log(`[ScanService] 📋 Python scraper logs:\n${stderr}`);
          }

          console.log(`[ScanService] 📦 Parsing scraper output...`);
          const rawOutput = stdout.trim();
          const results = JSON.parse(rawOutput) as Array<{
            date: string;
            roomType: 'room_only' | 'with_breakfast';
            price: number;
            available: boolean;
          }>;

          console.log(`[ScanService] ✅ Received ${results.length} results from scraper`);

          // Save raw scraper output as snapshot for debugging
          try {
            await db.createScrapeSnapshot({
              scanId,
              hotelId: hotel.id,
              snapshotType: 'raw_json',
              data: rawOutput,
              dataSize: rawOutput.length,
              checkInDate: startDateStr,
            });
            console.log(`[ScanService] 📸 Saved scraper snapshot for debugging`);
          } catch (snapshotError) {
            console.error(`[ScanService] Warning: Failed to save snapshot:`, snapshotError);
            // Don't fail the scan if snapshot save fails
          }

          // Save results to database
          console.log(`[ScanService] 💾 Saving results to database...`);
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
          console.log(`[ScanService] ✅ Saved ${savedCount} results to database`);

          progress.completedHotels++;
          await db.updateScan(scanId, {
            completedHotels: progress.completedHotels,
          });

          console.log(`[ScanService] 📊 Progress: ${progress.completedHotels}/${progress.totalHotels} hotels completed`);
        } catch (error) {
          console.error(`[ScanService] ❌ ERROR scanning hotel ${hotel.name}:`, error);
          console.error(`[ScanService] Error details:`, error instanceof Error ? error.message : String(error));
          console.error(`[ScanService] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');

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
              errorMessage,
              stackTrace: stackTrace || undefined,
              url: hotel.bookingUrl,
              checkInDate: startDate.toISOString().split('T')[0],
              metadata: JSON.stringify({
                command: `python3 booking_scraper.py ...`,
                daysForward: config.daysForward,
                roomTypes,
              }),
            });
            console.log(`[ScanService] 📝 Error logged to monitoring database`);
          } catch (logError) {
            console.error(`[ScanService] Warning: Failed to log error:`, logError);
          }

          // Continue with next hotel
        }
      }

      // Mark scan as completed
      progress.status = "completed";
      console.log(`\n${"=".repeat(80)}`);
      console.log(`[ScanService] ✅ SCAN COMPLETED SUCCESSFULLY`);
      console.log(`[ScanService] Scan ID: ${scanId}`);
      console.log(`[ScanService] Hotels processed: ${progress.completedHotels}/${progress.totalHotels}`);

      await db.updateScan(scanId, {
        status: "completed",
        completedAt: new Date(),
      });
      console.log(`[ScanService] 💾 Database updated with completion status`);

      // Send email report
      try {
        console.log(`[ScanService] 📧 Attempting to send email report...`);
        const emailSent = await sendScanReportAuto(scanId);
        if (emailSent) {
          console.log(`[ScanService] ✅ Email report sent successfully`);
        } else {
          console.log(`[ScanService] ⚠️  Email report skipped (check GMAIL_USER and GMAIL_APP_PASSWORD env vars)`);
        }
      } catch (emailError: any) {
        console.error(`[ScanService] ❌ Email error:`, emailError.message);
        // Don't fail the scan if email fails
      }

      console.log(`${"=".repeat(80)}\n`);
    } catch (error: any) {
      console.error(`\n${"=".repeat(80)}`);
      console.error(`[ScanService] ❌ SCAN FAILED`);
      console.error(`[ScanService] Scan ID: ${scanId}`);
      console.error(`[ScanService] Error:`, error);
      console.error(`[ScanService] Message:`, error.message);
      console.error(`[ScanService] Stack:`, error.stack);
      console.error(`${"=".repeat(80)}\n`);

      progress.status = "failed";
      progress.error = error.message;

      await db.updateScan(scanId, {
        status: "failed",
        errorMessage: error.message,
      });
    }
  })();

  console.log(`[ScanService] 🔄 Returning initial progress (scan running in background)`);
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
