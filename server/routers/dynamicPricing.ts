import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { executePricingEngine, calculateOptimalPrice } from "../services/dynamicPricingEngine";

export const dynamicPricingRouter = router({
  // Get all pricing rules for a hotel
  getRules: protectedProcedure
    .input(z.object({ hotelId: z.number() }))
    .query(async ({ input }) => {
      return db.getPricingRules(input.hotelId);
    }),

  // Create a new pricing rule
  createRule: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        ruleType: z.enum(["demand_based", "competitor_based", "time_based", "occupancy_based", "event_based"]),
        conditions: z.string(), // JSON string
        actions: z.string(), // JSON string
        priority: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.createPricingRule({
        ...input,
        isActive: 1,
        timesApplied: 0,
        createdBy: ctx.user.id,
      });
    }),

  // Update a pricing rule
  updateRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        conditions: z.string().optional(),
        actions: z.string().optional(),
        priority: z.number().optional(),
        isActive: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { ruleId, ...updates } = input;
      return db.updatePricingRule(ruleId, updates);
    }),

  // Delete a pricing rule
  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.number() }))
    .mutation(async ({ input }) => {
      return db.deletePricingRule(input.ruleId);
    }),

  // Calculate optimal price for a specific date (preview)
  calculatePrice: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        checkInDate: z.string(),
        roomType: z.enum(["room_only", "with_breakfast"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, checkInDate, roomType } = input;

      // Get current price
      const currentPriceData = await db.getHotelPrice(hotelId, checkInDate, roomType);
      const currentPrice = currentPriceData?.price || null;

      // Get base price
      const basePrice = currentPrice || 50000; // Default ₪500

      const result = await calculateOptimalPrice({
        hotelId,
        checkInDate,
        roomType,
        currentPrice,
        basePrice,
      });

      return {
        currentPrice,
        recommendedPrice: result.recommendedPrice,
        change: currentPrice
          ? ((result.recommendedPrice - currentPrice) / currentPrice) * 100
          : 0,
        factors: result.factors,
        appliedRules: result.appliedRules,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };
    }),

  // Run pricing engine for a date range
  runEngine: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        roomType: z.enum(["room_only", "with_breakfast"]),
        autoApply: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hotelId, startDate, endDate, roomType, autoApply } = input;

      const result = await executePricingEngine(
        hotelId,
        startDate,
        endDate,
        roomType,
        autoApply,
        ctx.user.id
      );

      return result;
    }),

  // Get pricing recommendations for next 30 days
  getRecommendations: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        roomType: z.enum(["room_only", "with_breakfast"]),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, roomType, days } = input;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const result = await executePricingEngine(
        hotelId,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
        roomType,
        false
      );

      return result;
    }),

  // Apply recommended prices for selected dates
  applyRecommendations: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        dates: z.array(z.string()),
        roomType: z.enum(["room_only", "with_breakfast"]),
        prices: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hotelId, dates, roomType, prices } = input;

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const newPrice = prices[i];

        // Get current price
        const currentPrice = await db.getHotelPrice(hotelId, date, roomType);

        // Update price
        await db.upsertHotelPrice({
          hotelId,
          checkInDate: date,
          roomType,
          price: newPrice,
          pricingStrategy: "dynamic",
          setBy: ctx.user.id,
        });

        // Record history
        if (currentPrice) {
          await db.createPriceHistory({
            hotelId,
            checkInDate: date,
            roomType,
            oldPrice: currentPrice.price,
            newPrice,
            changeAmount: newPrice - currentPrice.price,
            changePercent: Math.round(((newPrice - currentPrice.price) / currentPrice.price) * 10000),
            changeReason: "dynamic_rule",
            changedBy: ctx.user.id,
          });
        }
      }

      return { success: true, updatedDates: dates.length };
    }),

  // Get pricing statistics
  getStats: protectedProcedure
    .input(z.object({ hotelId: z.number() }))
    .query(async ({ input }) => {
      const rules = await db.getPricingRules(input.hotelId);

      const totalRules = rules.length;
      const activeRules = rules.filter((r: any) => r.isActive === 1).length;
      const totalApplications = rules.reduce((sum: number, r: any) => sum + (r.timesApplied || 0), 0);

      // Get recent price changes from dynamic pricing
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const priceHistory = await db.getPriceHistory(
        input.hotelId,
        startDate.toISOString().split("T")[0],
        "room_only",
        100
      );

      const dynamicChanges = priceHistory.filter((h: any) => h.changeReason === "dynamic_rule");

      return {
        totalRules,
        activeRules,
        totalApplications,
        recentDynamicChanges: dynamicChanges.length,
        avgPriceChange:
          dynamicChanges.length > 0
            ? Math.round(
                dynamicChanges.reduce((sum: number, h: any) => sum + Math.abs(h.changePercent), 0) /
                  dynamicChanges.length /
                  100
              )
            : 0,
      };
    }),
});
