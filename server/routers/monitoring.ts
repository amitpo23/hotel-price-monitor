import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Monitoring and Health Check Router
 * Provides endpoints for tracking scraper errors, health metrics, and debugging
 */
export const monitoringRouter = router({
  // Error Tracking
  errors: router({
    // Get recent scraper errors with optional filters
    list: protectedProcedure
      .input(
        z.object({
          hotelId: z.number().optional(),
          sinceMinutes: z.number().default(1440), // Default: last 24 hours
        })
      )
      .query(async ({ input }) => {
        return db.getScraperErrors(input.hotelId, input.sinceMinutes);
      }),

    // Get error statistics grouped by type and hotel
    stats: protectedProcedure
      .input(z.object({ sinceMinutes: z.number().default(1440) }))
      .query(async ({ input }) => {
        return db.getScraperErrorStats(input.sinceMinutes);
      }),
  }),

  // Snapshot Management
  snapshots: router({
    // Get a specific snapshot by ID
    get: protectedProcedure
      .input(z.object({ snapshotId: z.number() }))
      .query(async ({ input }) => {
        return db.getScrapeSnapshot(input.snapshotId);
      }),

    // Get all snapshots for a specific scan
    listForScan: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        return db.getSnapshotsForScan(input.scanId);
      }),
  }),

  // Health Monitoring
  health: router({
    // Get overall system health summary
    summary: protectedProcedure
      .input(z.object({ sinceMinutes: z.number().default(1440) }))
      .query(async ({ input }) => {
        return db.getScrapeHealthSummary(input.sinceMinutes);
      }),

    // Get combined health report with errors and stats
    fullReport: protectedProcedure
      .input(z.object({ sinceMinutes: z.number().default(1440) }))
      .query(async ({ input }) => {
        const [healthSummary, errorStats] = await Promise.all([
          db.getScrapeHealthSummary(input.sinceMinutes),
          db.getScraperErrorStats(input.sinceMinutes),
        ]);

        return {
          health: healthSummary,
          errors: errorStats,
          timestamp: new Date().toISOString(),
          timeWindowMinutes: input.sinceMinutes,
        };
      }),
  }),
});
