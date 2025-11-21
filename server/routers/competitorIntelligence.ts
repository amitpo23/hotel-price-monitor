import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const competitorIntelligenceRouter = router({
  // Get competitor alerts
  getAlerts: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      return db.getCompetitorAlerts(input.hotelId, input.unreadOnly);
    }),

  // Mark alert as read
  markAlertRead: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      return db.markCompetitorAlertRead(input.alertId);
    }),

  // Get competitor prices for date range
  getCompetitorPrices: protectedProcedure
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

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Get our prices
      const ourPrices = await db.getHotelPricesForDateRange(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );

      // Get competitor average prices
      const competitorPrices = await db.getCompetitorAveragePrices(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );

      // Get latest scan for min/max prices
      const hotel = await db.getHotelById(hotelId);
      if (!hotel) return [];

      const scanConfigs = await db.getScanConfigsByHotel(hotelId);
      if (!scanConfigs || scanConfigs.length === 0) return [];

      const latestScan = await db.getLatestScanForConfig(scanConfigs[0].id);
      if (!latestScan) return [];

      const scanResults = await db.getScanResults(latestScan.id);

      // Combine data
      const result = [];
      const dates = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }

      for (const date of dates) {
        const ourPrice = ourPrices.find((p: any) => p.checkInDate === date);
        const compPrice = competitorPrices.find((p: any) => p.checkInDate === date);

        // Get min/max from scan results for this date
        const dateResults = scanResults.filter(
          (r: any) => r.checkInDate === date && r.roomType === roomType && r.price
        );

        const minPrice =
          dateResults.length > 0
            ? Math.min(...dateResults.map((r: any) => r.price))
            : null;
        const maxPrice =
          dateResults.length > 0
            ? Math.max(...dateResults.map((r: any) => r.price))
            : null;

        const yourPrice = ourPrice?.price || null;
        const avgCompetitorPrice = compPrice?.avgPrice || null;

        const priceGap =
          yourPrice && avgCompetitorPrice
            ? ((yourPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100
            : 0;

        result.push({
          date,
          yourPrice,
          avgCompetitorPrice,
          minCompetitorPrice: minPrice,
          maxCompetitorPrice: maxPrice,
          priceGap,
        });
      }

      return result;
    }),

  // Get market position
  getMarketPosition: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        roomType: z.enum(["room_only", "with_breakfast"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, roomType } = input;

      const today = new Date().toISOString().split("T")[0];

      // Get our price
      const ourPrice = await db.getHotelPrice(hotelId, today, roomType);

      if (!ourPrice) {
        return {
          rank: null,
          totalCompetitors: 0,
          avgPriceGap: 0,
          activeCompetitors: 0,
          competitivenessScore: 0,
        };
      }

      // Get competitor prices
      const competitorPrices = await db.getCompetitorAveragePrices(
        hotelId,
        today,
        today,
        roomType
      );

      if (!competitorPrices || competitorPrices.length === 0) {
        return {
          rank: 1,
          totalCompetitors: 1,
          avgPriceGap: 0,
          activeCompetitors: 0,
          competitivenessScore: 50,
        };
      }

      const avgCompPrice = competitorPrices[0].avgPrice;

      // Get all competitor prices to calculate rank
      const scanConfigs = await db.getScanConfigsByHotel(hotelId);
      if (!scanConfigs || scanConfigs.length === 0) {
        return {
          rank: 1,
          totalCompetitors: 1,
          avgPriceGap: 0,
          activeCompetitors: 0,
          competitivenessScore: 50,
        };
      }

      const latestScan = await db.getLatestScanForConfig(scanConfigs[0].id);
      if (!latestScan) {
        return {
          rank: 1,
          totalCompetitors: 1,
          avgPriceGap: 0,
          activeCompetitors: 0,
          competitivenessScore: 50,
        };
      }

      const scanResults = await db.getScanResults(latestScan.id);
      const todayResults = scanResults.filter(
        (r: any) => r.checkInDate === today && r.roomType === roomType && r.price
      );

      // Add our price to the list
      const allPrices = [...todayResults.map((r: any) => r.price), ourPrice.price];
      allPrices.sort((a, b) => a - b);

      const rank = allPrices.indexOf(ourPrice.price) + 1;
      const totalCompetitors = allPrices.length;
      const activeCompetitors = todayResults.length;

      const avgPriceGap = avgCompPrice
        ? ((ourPrice.price - avgCompPrice) / avgCompPrice) * 100
        : 0;

      // Calculate competitiveness score (0-100)
      // Lower rank = higher score
      const rankScore = ((totalCompetitors - rank + 1) / totalCompetitors) * 50;

      // Price gap score (closer to average = higher score)
      const gapScore = Math.max(0, 50 - Math.abs(avgPriceGap));

      const competitivenessScore = Math.round(rankScore + gapScore);

      return {
        rank,
        totalCompetitors,
        avgPriceGap,
        activeCompetitors,
        competitivenessScore,
      };
    }),

  // Get price gap analysis
  getPriceGapAnalysis: protectedProcedure
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

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Get our prices
      const ourPrices = await db.getHotelPricesForDateRange(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );

      // Get competitor average prices
      const competitorPrices = await db.getCompetitorAveragePrices(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );

      // Combine
      const result = [];

      for (const ourPrice of ourPrices) {
        const compPrice = competitorPrices.find(
          (p: any) => p.checkInDate === ourPrice.checkInDate
        );

        if (compPrice && compPrice.avgPrice) {
          const priceGap = ((ourPrice.price - compPrice.avgPrice) / compPrice.avgPrice) * 100;

          result.push({
            date: ourPrice.checkInDate,
            yourPrice: ourPrice.price,
            avgCompetitorPrice: compPrice.avgPrice,
            priceGap,
          });
        }
      }

      return result;
    }),

  // Create price change alert
  createAlert: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        competitorHotelId: z.number(),
        alertType: z.enum([
          "price_drop",
          "price_increase",
          "significant_gap",
          "new_competitor",
        ]),
        message: z.string(),
        details: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createCompetitorAlert({
        ...input,
        isRead: 0,
      });
    }),
});
