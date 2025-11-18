import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { generateExcelReport } from "../utils/excelExport";

export const exportRouter = router({
  // Export scan results to Excel
  exportToExcel: protectedProcedure
    .input(
      z.object({
        scanId: z.number().optional(),
        configId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      // Get scan config
      const config = await db.getScanConfigById(input.configId);
      if (!config) {
        throw new Error("Scan configuration not found");
      }

      // Get target hotel
      const targetHotel = await db.getHotelById(config.targetHotelId);
      if (!targetHotel) {
        throw new Error("Target hotel not found");
      }

      // Get latest scan results if scanId not provided
      let results;
      let scanDate = new Date();

      if (input.scanId) {
        const scan = await db.getScanById(input.scanId);
        if (scan) {
          scanDate = scan.createdAt;
        }
        results = await db.getScanResultsWithHotels(input.scanId);
      } else {
        results = await db.getLatestScanResultsForConfig(input.configId);
      }

      if (results.length === 0) {
        throw new Error("No scan results available for export");
      }

      // Transform data for Excel export
      const exportData = {
        configName: config.name,
        targetHotelName: targetHotel.name,
        scanDate,
        results: results.map((r) => ({
          hotelName: r.hotel.name,
          checkInDate: r.result.checkInDate,
          roomType: r.result.roomType,
          price: r.result.price,
          isAvailable: r.result.isAvailable === 1,
        })),
      };

      // Generate Excel file
      const buffer = await generateExcelReport(exportData);

      // Convert buffer to base64 for transmission
      const base64 = buffer.toString("base64");

      return {
        success: true,
        filename: `hotel-prices-${config.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.xlsx`,
        data: base64,
      };
    }),
});
