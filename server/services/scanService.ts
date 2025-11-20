import * as db from "../db";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
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
  console.log(`[ScanService] Starting scan for config ${configId}`);

  // Get scan configuration
  const config = await db.getScanConfigById(configId);
  if (!config) {
    throw new Error("Scan configuration not found");
  }

  // Get hotels to scan
  const hotels = await db.getHotelsForScanConfig(configId);
  if (hotels.length === 0) {
    throw new Error("No hotels configured for this scan");
  }

  // Parse room types
  const roomTypes = JSON.parse(config.roomTypes) as ("room_only" | "with_breakfast")[];

  // Create scan record
  const scanResult = await db.createScan({
    scanConfigId: configId,
    status: "running",
    startedAt: new Date(),
    totalHotels: hotels.length,
    completedHotels: 0,
  });

  // Drizzle returns an array with insertId in the first element
  const scanId = Number(scanResult[0]?.insertId || (scanResult as any).insertId);

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
        console.log(`[ScanService] Scanning hotel: ${hotel.name}`);

        try {
          // Scrape prices using Python scraper
          const pythonScript = path.join(__dirname, '../scripts/booking_scraper.py');
          const startDateStr = startDate.toISOString().split('T')[0];
          const roomTypesJson = JSON.stringify(roomTypes);

          // Verify Python script exists
          if (!fs.existsSync(pythonScript)) {
            throw new Error(`Python scraper script not found at: ${pythonScript}`);
          }

          const command = `python3 "${pythonScript}" "${hotel.bookingUrl}" "${startDateStr}" ${config.daysForward} '${roomTypesJson}'`;

          console.log(`[ScanService] Running Python scraper for ${hotel.name}`);

          let stdout: string;
          let stderr: string;
          try {
            const result = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
            stdout = result.stdout;
            stderr = result.stderr;
          } catch (execError: any) {
            if (execError.code === 'ENOENT' || execError.message?.includes('python3: command not found')) {
              throw new Error('Python 3 is not installed or not in PATH. Please install Python 3 to use the scraper.');
            }
            throw new Error(`Failed to execute Python scraper: ${execError.message}`);
          }

          if (stderr) {
            console.log(`[ScanService] Python scraper stderr:`, stderr);
          }

          if (!stdout || stdout.trim() === '') {
            throw new Error('Python scraper returned empty output');
          }

          let results: Array<{
            date: string;
            roomType: 'room_only' | 'with_breakfast';
            price: number;
            available: boolean;
          }>;

          try {
            results = JSON.parse(stdout.trim());
          } catch (parseError: any) {
            throw new Error(`Failed to parse Python scraper output: ${parseError.message}. Output: ${stdout.substring(0, 200)}`);
          }

          // Save results to database
          // Note: Currency defaults to ILS in the database schema
          // The Python scraper is configured for Israeli hotels (Booking.com IL)
          // If expanding to other markets, add currency detection in the scraper
          for (const result of results) {
            await db.createScanResult({
              scanId,
              hotelId: hotel.id,
              checkInDate: result.date,
              roomType: result.roomType,
              price: result.price,
              isAvailable: result.available ? 1 : 0,
              // currency field uses database default: "ILS"
            });
          }

          progress.completedHotels++;
          await db.updateScan(scanId, {
            completedHotels: progress.completedHotels,
          });

          console.log(`[ScanService] Completed ${progress.completedHotels}/${progress.totalHotels} hotels`);
        } catch (error) {
          console.error(`[ScanService] Error scanning hotel ${hotel.name}:`, error);
          // Continue with next hotel
        }
      }

      // Mark scan as completed
      progress.status = "completed";
      await db.updateScan(scanId, {
        status: "completed",
        completedAt: new Date(),
      });

      console.log(`[ScanService] Scan ${scanId} completed successfully`);

      // Send email report
      try {
        console.log(`[ScanService] Sending email report for scan ${scanId}`);
        const emailSent = await sendScanReportAuto(scanId);
        if (emailSent) {
          console.log(`[ScanService] Email report sent successfully`);
        } else {
          console.log(`[ScanService] Email report failed (check GMAIL_USER and GMAIL_APP_PASSWORD env vars)`);
        }
      } catch (emailError: any) {
        console.error(`[ScanService] Email error:`, emailError.message);
        // Don't fail the scan if email fails
      }
    } catch (error: any) {
      console.error(`[ScanService] Scan ${scanId} failed:`, error);
      
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
