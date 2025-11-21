import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { generateDemandForecast } from "../services/demandForecasting";

export const calendarRouter = router({
  // Get price data for a specific month
  getMonthData: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        month: z.string(), // YYYY-MM format
        roomType: z.enum(["room_only", "with_breakfast"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, month, roomType } = input;
      
      // Parse month to get start and end dates
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      
      // Get hotel prices for the month
      const prices = await db.getHotelPricesForDateRange(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );
      
      // Get competitor average prices for the same dates
      const competitorPrices = await db.getCompetitorAveragePrices(
        hotelId,
        startDateStr,
        endDateStr,
        roomType
      );
      
      // Get demand forecasts
      let forecasts = await db.getDemandForecastsForDateRange(
        hotelId,
        startDateStr,
        endDateStr
      );
      
      // If no forecasts, try to generate them
      if (forecasts.length === 0) {
        try {
          await generateDemandForecast(hotelId, startDateStr, endDateStr);
          forecasts = await db.getDemandForecastsForDateRange(
            hotelId,
            startDateStr,
            endDateStr
          );
        } catch (error) {
          console.error("Failed to generate forecasts:", error);
        }
      }
      
      // Combine data
      const daysInMonth = endDate.getDate();
      const result = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthNum - 1, day);
        const dateStr = date.toISOString().split("T")[0];
        
        const priceData = prices.find((p: any) => p.checkInDate === dateStr);
        const competitorData = competitorPrices.find((c: any) => c.checkInDate === dateStr);
        const forecastData = forecasts.find((f: any) => f.forecastDate === dateStr);
        
        const price = priceData?.price || null;
        const competitorAvgPrice = competitorData?.avgPrice || null;
        
        let priceGap = 0;
        let isCompetitive = true;
        
        if (price && competitorAvgPrice) {
          priceGap = Math.round(((price - competitorAvgPrice) / competitorAvgPrice) * 100);
          isCompetitive = priceGap <= 5;
        }
        
        result.push({
          date: dateStr,
          price,
          competitorAvgPrice,
          priceGap,
          isCompetitive,
          availability: priceData?.isAvailable !== 0,
          forecast: forecastData ? {
            predictedOccupancy: forecastData.predictedOccupancy,
            confidence: forecastData.confidence,
            demandLevel: forecastData.demandLevel,
          } : null,
        });
      }
      
      return result;
    }),

  // Update price for a specific date
  updatePrice: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        date: z.string(), // YYYY-MM-DD
        roomType: z.enum(["room_only", "with_breakfast"]),
        price: z.number(), // Price in cents
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hotelId, date, roomType, price } = input;
      
      // Get current price to track history
      const currentPrice = await db.getHotelPrice(hotelId, date, roomType);
      
      // Update or insert price
      await db.upsertHotelPrice({
        hotelId,
        checkInDate: date,
        roomType,
        price,
        pricingStrategy: "manual",
        setBy: ctx.user.id,
      });
      
      // Record price change in history
      if (currentPrice) {
        await db.createPriceHistory({
          hotelId,
          checkInDate: date,
          roomType,
          oldPrice: currentPrice.price,
          newPrice: price,
          changeAmount: price - currentPrice.price,
          changePercent: Math.round(((price - currentPrice.price) / currentPrice.price) * 10000),
          changeReason: "manual",
          changedBy: ctx.user.id,
        });
      }
      
      return { success: true };
    }),

  // Bulk copy prices from one date to a range
  bulkCopyPrices: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        sourceDate: z.string(), // YYYY-MM-DD
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(), // YYYY-MM-DD
        roomType: z.enum(["room_only", "with_breakfast"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hotelId, sourceDate, startDate, endDate, roomType } = input;
      
      // Get source price
      const sourcePrice = await db.getHotelPrice(hotelId, sourceDate, roomType);
      
      if (!sourcePrice) {
        throw new Error("Source date has no price set");
      }
      
      // Generate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }
      
      // Update all dates
      for (const date of dates) {
        const currentPrice = await db.getHotelPrice(hotelId, date, roomType);
        
        await db.upsertHotelPrice({
          hotelId,
          checkInDate: date,
          roomType,
          price: sourcePrice.price,
          pricingStrategy: "manual",
          setBy: ctx.user.id,
        });
        
        // Record history
        if (currentPrice) {
          await db.createPriceHistory({
            hotelId,
            checkInDate: date,
            roomType,
            oldPrice: currentPrice.price,
            newPrice: sourcePrice.price,
            changeAmount: sourcePrice.price - currentPrice.price,
            changePercent: Math.round(((sourcePrice.price - currentPrice.price) / currentPrice.price) * 10000),
            changeReason: "bulk_update",
            changedBy: ctx.user.id,
          });
        }
      }
      
      return { success: true, updatedDates: dates.length };
    }),

  // Apply pricing template to date range
  applyTemplate: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        templateId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        roomType: z.enum(["room_only", "with_breakfast"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hotelId, templateId, startDate, endDate, roomType } = input;
      
      // Get template
      const template = await db.getPricingTemplate(templateId);
      
      if (!template) {
        throw new Error("Template not found");
      }
      
      // Parse template adjustments
      const adjustments = JSON.parse(template.priceAdjustments);
      
      // Generate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const dayOfWeek = d.getDay();
        
        // Get base price (from previous day or default)
        const currentPrice = await db.getHotelPrice(hotelId, dateStr, roomType);
        const basePrice = currentPrice?.price || 50000; // Default ₪500
        
        // Apply adjustment based on day of week
        const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayOfWeek];
        const adjustment = adjustments[dayName] || adjustments.weekday || "+0%";
        
        // Parse adjustment (e.g., "+20%", "-10%", "500")
        let newPrice = basePrice;
        if (adjustment.includes("%")) {
          const percent = parseFloat(adjustment.replace("%", ""));
          newPrice = Math.round(basePrice * (1 + percent / 100));
        } else {
          newPrice = parseInt(adjustment) * 100; // Convert to cents
        }
        
        // Update price
        await db.upsertHotelPrice({
          hotelId,
          checkInDate: dateStr,
          roomType,
          price: newPrice,
          pricingStrategy: "rule-based",
          setBy: ctx.user.id,
        });
        
        // Record history
        if (currentPrice) {
          await db.createPriceHistory({
            hotelId,
            checkInDate: dateStr,
            roomType,
            oldPrice: currentPrice.price,
            newPrice,
            changeAmount: newPrice - currentPrice.price,
            changePercent: Math.round(((newPrice - currentPrice.price) / currentPrice.price) * 10000),
            changeReason: "rule-based",
            changedBy: ctx.user.id,
          });
        }
      }
      
      return { success: true };
    }),
});
