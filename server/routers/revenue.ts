import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const revenueRouter = router({
  // Get KPIs for a hotel
  getKPIs: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        dateRange: z.enum(["7d", "30d", "90d", "1y"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, dateRange } = input;
      
      // Calculate date range
      const daysMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
      const days = daysMap[dateRange];
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      
      // Get revenue metrics
      const metrics = await db.getRevenueMetrics(hotelId, startDateStr, endDateStr);
      
      if (!metrics || metrics.length === 0) {
        return {
          revPAR: 0,
          adr: 0,
          occupancyRate: 0,
          totalRevenue: 0,
          revPARChange: 0,
          adrChange: 0,
          occupancyChange: 0,
          revenueChange: 0,
          totalRooms: 0,
          roomsSold: 0,
          roomsAvailable: 0,
          totalBookings: 0,
          cancellations: 0,
          noShows: 0,
          marketShare: 0,
          priceIndex: 100,
          breakEvenOccupancy: 70,
          breakEvenPrice: 40000,
        };
      }
      
      // Calculate averages
      const avgRevPAR = Math.round(
        metrics.reduce((sum: number, m: any) => sum + (m.revPAR || 0), 0) / metrics.length
      );
      const avgADR = Math.round(
        metrics.reduce((sum: number, m: any) => sum + (m.adr || 0), 0) / metrics.length
      );
      const avgOccupancy = Math.round(
        metrics.reduce((sum: number, m: any) => sum + (m.occupancyRate || 0), 0) / metrics.length
      );
      const totalRevenue = metrics.reduce((sum: number, m: any) => sum + (m.totalRevenue || 0), 0);
      
      // Calculate changes (compare to previous period)
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      
      const prevMetrics = await db.getRevenueMetrics(
        hotelId,
        prevStartDate.toISOString().split("T")[0],
        prevEndDate.toISOString().split("T")[0]
      );
      
      let revPARChange = 0;
      let adrChange = 0;
      let occupancyChange = 0;
      let revenueChange = 0;
      
      if (prevMetrics && prevMetrics.length > 0) {
        const prevAvgRevPAR = Math.round(
          prevMetrics.reduce((sum: number, m: any) => sum + (m.revPAR || 0), 0) / prevMetrics.length
        );
        const prevAvgADR = Math.round(
          prevMetrics.reduce((sum: number, m: any) => sum + (m.adr || 0), 0) / prevMetrics.length
        );
        const prevAvgOccupancy = Math.round(
          prevMetrics.reduce((sum: number, m: any) => sum + (m.occupancyRate || 0), 0) / prevMetrics.length
        );
        const prevTotalRevenue = prevMetrics.reduce((sum: number, m: any) => sum + (m.totalRevenue || 0), 0);
        
        if (prevAvgRevPAR > 0) revPARChange = ((avgRevPAR - prevAvgRevPAR) / prevAvgRevPAR) * 100;
        if (prevAvgADR > 0) adrChange = ((avgADR - prevAvgADR) / prevAvgADR) * 100;
        if (prevAvgOccupancy > 0) occupancyChange = ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy) * 100;
        if (prevTotalRevenue > 0) revenueChange = ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100;
      }
      
      // Aggregate other metrics
      const latestMetric = metrics[metrics.length - 1];
      
      return {
        revPAR: avgRevPAR,
        adr: avgADR,
        occupancyRate: avgOccupancy,
        totalRevenue,
        revPARChange,
        adrChange,
        occupancyChange,
        revenueChange,
        totalRooms: latestMetric?.totalRooms || 0,
        roomsSold: metrics.reduce((sum: number, m: any) => sum + (m.roomsSold || 0), 0),
        roomsAvailable: metrics.reduce((sum: number, m: any) => sum + (m.roomsAvailable || 0), 0),
        totalBookings: metrics.reduce((sum: number, m: any) => sum + (m.totalBookings || 0), 0),
        cancellations: metrics.reduce((sum: number, m: any) => sum + (m.cancellations || 0), 0),
        noShows: metrics.reduce((sum: number, m: any) => sum + (m.noShows || 0), 0),
        marketShare: latestMetric?.marketShare || 0,
        priceIndex: latestMetric?.priceIndex || 100,
        breakEvenOccupancy: 70, // Placeholder - should be calculated based on costs
        breakEvenPrice: 40000, // Placeholder - ₪400
      };
    }),

  // Get trends data
  getTrends: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        dateRange: z.enum(["7d", "30d", "90d", "1y"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, dateRange } = input;
      
      const daysMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
      const days = daysMap[dateRange];
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const metrics = await db.getRevenueMetrics(
        hotelId,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      );
      
      return metrics.map((m: any) => ({
        date: m.metricDate,
        revenue: m.totalRevenue / 100, // Convert to currency
        occupancy: m.occupancyRate,
        revPAR: m.revPAR / 100,
        adr: m.adr / 100,
      }));
    }),

  // Get forecast data
  getForecast: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, days } = input;
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      const forecasts = await db.getDemandForecasts(
        hotelId,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      );
      
      return forecasts.map((f: any) => ({
        date: f.forecastDate,
        forecastRevenue: f.recommendedPrice ? f.recommendedPrice * f.predictedOccupancy / 100 : 0,
        forecastOccupancy: f.predictedOccupancy,
        confidence: f.confidenceInterval,
        confidenceHigh: f.recommendedPrice ? (f.recommendedPrice * f.predictedOccupancy / 100) * 1.1 : 0,
        confidenceLow: f.recommendedPrice ? (f.recommendedPrice * f.predictedOccupancy / 100) * 0.9 : 0,
      }));
    }),

  // Get comparison data
  getComparison: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        dateRange: z.enum(["7d", "30d", "90d", "1y"]),
        comparisonType: z.enum(["previous", "yoy"]),
      })
    )
    .query(async ({ input }) => {
      const { hotelId, dateRange, comparisonType } = input;
      
      const daysMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
      const days = daysMap[dateRange];
      
      // Current period
      const currentEnd = new Date();
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - days);
      
      // Previous period
      let prevStart: Date, prevEnd: Date;
      
      if (comparisonType === "previous") {
        prevEnd = new Date(currentStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - days);
      } else {
        // Year over year
        prevStart = new Date(currentStart);
        prevStart.setFullYear(prevStart.getFullYear() - 1);
        prevEnd = new Date(currentEnd);
        prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      }
      
      // Get metrics for both periods
      const currentMetrics = await db.getRevenueMetrics(
        hotelId,
        currentStart.toISOString().split("T")[0],
        currentEnd.toISOString().split("T")[0]
      );
      
      const prevMetrics = await db.getRevenueMetrics(
        hotelId,
        prevStart.toISOString().split("T")[0],
        prevEnd.toISOString().split("T")[0]
      );
      
      // Calculate averages
      const calcAvg = (metrics: any[]) => {
        if (!metrics || metrics.length === 0) {
          return { revPAR: 0, adr: 0, occupancy: 0, revenue: 0 };
        }
        
        return {
          revPAR: Math.round(metrics.reduce((sum: number, m: any) => sum + (m.revPAR || 0), 0) / metrics.length),
          adr: Math.round(metrics.reduce((sum: number, m: any) => sum + (m.adr || 0), 0) / metrics.length),
          occupancy: Math.round(metrics.reduce((sum: number, m: any) => sum + (m.occupancyRate || 0), 0) / metrics.length),
          revenue: metrics.reduce((sum: number, m: any) => sum + (m.totalRevenue || 0), 0),
        };
      };
      
      const current = calcAvg(currentMetrics);
      const previous = calcAvg(prevMetrics);
      
      // Calculate changes
      const changes = {
        revPAR: previous.revPAR > 0 ? ((current.revPAR - previous.revPAR) / previous.revPAR) * 100 : 0,
        adr: previous.adr > 0 ? ((current.adr - previous.adr) / previous.adr) * 100 : 0,
        occupancy: previous.occupancy > 0 ? ((current.occupancy - previous.occupancy) / previous.occupancy) * 100 : 0,
        revenue: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0,
      };
      
      return { current, previous, changes };
    }),
});
