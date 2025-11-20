import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Monitoring and Health Check Router
 * Provides endpoints for tracking scraper errors, health metrics, and debugging
 */
export const monitoringRouter = router({
  // System Health Overview
  getSystemHealth: protectedProcedure.query(async () => {
    const health = await db.getScrapeHealthSummary(1440);
    return {
      status: health && health.errorRate < 10 ? "healthy" : "degraded",
      uptime: "99.9%",
      totalScans: health?.totalScans || 0,
      activeScans: 0,
      dbStatus: "connected",
      totalResults: 0,
    };
  }),

  // Recent Scans with Details
  getRecentScans: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      // Get all configs for the user
      const configs = await db.getScanConfigs(ctx.user.id);
      const allScans = [];
      
      // Get scans for each config
      for (const config of configs) {
        const scans = await db.getScansForConfig(config.id, input.limit);
        allScans.push(...scans.map(scan => ({
          id: scan.id,
          configName: config.name,
          status: scan.status,
          totalHotels: 0,
          resultsCount: 0,
          duration: scan.completedAt && scan.startedAt ? 
            Math.floor((scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000) : 0,
        })));
      }
      
      return allScans.slice(0, input.limit);
    }),

  // Recent Errors
  getRecentErrors: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const errors = await db.getScraperErrors(undefined, 1440);
      return errors.slice(0, input.limit).map(err => ({
        message: err.errorType || "Unknown error",
        timestamp: err.createdAt.toISOString(),
        scanId: err.scanId,
        details: err.errorMessage,
      }));
    }),

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
