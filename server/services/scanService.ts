import * as db from "../db";
import { scrapeHotelPrices } from "../utils/bookingScraper";

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
    totalHotels: hotels.length,
    completedHotels: 0,
  });

  const scanId = Number((scanResult as any).insertId);

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
          // Scrape prices for this hotel
          const results = await scrapeHotelPrices(
            hotel.bookingUrl,
            startDate,
            config.daysForward,
            roomTypes
          );

          // Save results to database
          for (const result of results) {
            await db.createScanResult({
              scanId,
              hotelId: hotel.id,
              checkInDate: result.checkInDate,
              roomType: result.roomType,
              price: result.price,
              isAvailable: result.isAvailable ? 1 : 0,
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
