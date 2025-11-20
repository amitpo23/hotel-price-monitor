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

      // Determine which scan to export
      let actualScanId = input.scanId;

      if (!actualScanId) {
        // Find the latest scan for this config
        const latestScan = await db.getLatestScanForConfig(input.configId);
        if (!latestScan) {
          throw new Error("No scans found for this configuration");
        }
        actualScanId = latestScan.id;
      }

      // Verify scan exists
      const scan = await db.getScanById(actualScanId);
      if (!scan) {
        throw new Error("Scan not found");
      }

      // Generate Excel file
      const buffer = await generateExcelReport({
        scanId: actualScanId,
        scanConfigId: input.configId,
      });

      // Convert buffer to base64 for transmission
      const base64 = buffer.toString("base64");

      return {
        success: true,
        filename: `hotel-prices-${config.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.xlsx`,
        data: base64,
      };
    }),
});
