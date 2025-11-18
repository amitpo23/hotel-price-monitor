import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { executeScan, getScanProgress } from "../services/scanService";

export const scansRouter = router({
  // Scan Configuration Management
  configs: router({
    // List all scan configurations for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getScanConfigs(ctx.user.id);
    }),

    // Get a single scan configuration by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const config = await db.getScanConfigById(input.id);
        if (!config) return null;

        // Get associated hotels
        const hotels = await db.getHotelsForScanConfig(input.id);
        
        // Get schedule if exists
        const schedule = await db.getScanScheduleByConfigId(input.id);

        return {
          ...config,
          hotels,
          schedule,
        };
      }),

    // Create a new scan configuration
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Configuration name is required"),
          targetHotelId: z.number(),
          daysForward: z.number().default(60),
          roomTypes: z.array(z.enum(["room_only", "with_breakfast"])),
          hotelIds: z.array(z.number()),
          schedule: z.object({
            cronExpression: z.string(),
            timezone: z.string().default("Asia/Jerusalem"),
            isEnabled: z.boolean().default(true),
          }).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { hotelIds, schedule, ...configData } = input;

        // Create scan config
        const result = await db.createScanConfig({
          ...configData,
          roomTypes: JSON.stringify(input.roomTypes),
          createdBy: ctx.user.id,
          isActive: 1,
        });

        const configId = Number((result as any).insertId);

        // Add hotels to config
        for (const hotelId of hotelIds) {
          await db.addHotelToScanConfig(configId, hotelId);
        }

        // Create schedule if provided
        if (schedule) {
          await db.createScanSchedule({
            scanConfigId: configId,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            isEnabled: schedule.isEnabled ? 1 : 0,
          });
        }

        return { success: true, configId };
      }),

    // Update scan configuration
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          targetHotelId: z.number().optional(),
          daysForward: z.number().optional(),
          roomTypes: z.array(z.enum(["room_only", "with_breakfast"])).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, roomTypes, isActive, ...data } = input;
        
        const updateData: any = { ...data };
        if (roomTypes) {
          updateData.roomTypes = JSON.stringify(roomTypes);
        }
        if (isActive !== undefined) {
          updateData.isActive = isActive ? 1 : 0;
        }

        await db.updateScanConfig(id, updateData);
        return { success: true };
      }),

    // Delete scan configuration
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScanConfig(input.id);
        return { success: true };
      }),
  }),

  // Scan Execution
  execute: router({
    // Manually trigger a scan
    start: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .mutation(async ({ input }) => {
        // Execute scan in background
        const progress = await executeScan(input.configId);
        return { success: true, scanId: progress.scanId };
      }),

    // Get scan status
    getStatus: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        return getScanProgress(input.scanId);
      }),

    // List scans for a configuration
    listForConfig: protectedProcedure
      .input(z.object({ configId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getScansForConfig(input.configId, input.limit);
      }),
  }),

  // Scan Results
  results: router({
    // Get results for a specific scan
    getByScanId: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        return db.getScanResultsWithHotels(input.scanId);
      }),

    // Get latest results for a configuration
    getLatest: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .query(async ({ input }) => {
        return db.getLatestScanResultsForConfig(input.configId);
      }),

    // Get aggregated statistics
    getStats: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .query(async ({ input }) => {
        const results = await db.getLatestScanResultsForConfig(input.configId);
        
        if (results.length === 0) {
          return {
            totalDates: 0,
            averagePrice: 0,
            minPrice: 0,
            maxPrice: 0,
            availabilityRate: 0,
          };
        }

        const prices = results
          .filter(r => r.result.price !== null)
          .map(r => r.result.price!);

        const totalDates = new Set(results.map(r => r.result.checkInDate)).size;
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const availabilityRate = (results.filter(r => r.result.isAvailable).length / results.length) * 100;

        return {
          totalDates,
          averagePrice: Math.round(averagePrice / 100), // Convert from cents
          minPrice: Math.round(minPrice / 100),
          maxPrice: Math.round(maxPrice / 100),
          availabilityRate: Math.round(availabilityRate),
        };
      }),
  }),

  // Schedule Management
  schedules: router({
    // Update schedule for a configuration
    update: protectedProcedure
      .input(
        z.object({
          configId: z.number(),
          cronExpression: z.string(),
          timezone: z.string().default("Asia/Jerusalem"),
          isEnabled: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        const schedule = await db.getScanScheduleByConfigId(input.configId);

        if (schedule) {
          // Update existing schedule
          await db.updateScanSchedule(schedule.id, {
            cronExpression: input.cronExpression,
            timezone: input.timezone,
            isEnabled: input.isEnabled ? 1 : 0,
          });
        } else {
          // Create new schedule
          await db.createScanSchedule({
            scanConfigId: input.configId,
            cronExpression: input.cronExpression,
            timezone: input.timezone,
            isEnabled: input.isEnabled ? 1 : 0,
          });
        }

        return { success: true };
      }),

    // Toggle schedule enabled/disabled
    toggle: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .mutation(async ({ input }) => {
        const schedule = await db.getScanScheduleByConfigId(input.configId);
        if (!schedule) {
          throw new Error("Schedule not found");
        }

        await db.updateScanSchedule(schedule.id, {
          isEnabled: schedule.isEnabled ? 0 : 1,
        });

        return { success: true, isEnabled: !schedule.isEnabled };
      }),
  }),
});
