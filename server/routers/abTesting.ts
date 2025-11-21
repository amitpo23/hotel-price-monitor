import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const abTestingRouter = router({
  // Get all A/B tests for a hotel
  getTests: protectedProcedure
    .input(z.object({ hotelId: z.number() }))
    .query(async ({ input }) => {
      return db.getABTests(input.hotelId);
    }),

  // Get a specific test with details
  getTest: protectedProcedure
    .input(z.object({ testId: z.number() }))
    .query(async ({ input }) => {
      const test = await db.getABTestById(input.testId);
      if (!test) throw new Error("Test not found");

      // Get events for this test
      const events = await db.getABTestEvents(input.testId);

      return {
        ...test,
        events,
      };
    }),

  // Create a new A/B test
  createTest: protectedProcedure
    .input(
      z.object({
        hotelId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        variantA: z.string(), // JSON string
        variantB: z.string(), // JSON string
        trafficSplit: z.number().min(0).max(100).default(50),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.createABTest({
        ...input,
        status: "draft",
        variantARevenue: 0,
        variantBRevenue: 0,
        variantABookings: 0,
        variantBBookings: 0,
        winner: "none",
        createdBy: ctx.user.id,
      });
    }),

  // Update test status
  updateTestStatus: protectedProcedure
    .input(
      z.object({
        testId: z.number(),
        status: z.enum(["draft", "running", "paused", "completed"]),
      })
    )
    .mutation(async ({ input }) => {
      return db.updateABTestStatus(input.testId, input.status);
    }),

  // Record an A/B test event
  recordEvent: protectedProcedure
    .input(
      z.object({
        testId: z.number(),
        variant: z.enum(["A", "B"]),
        eventType: z.enum(["view", "booking", "revenue"]),
        checkInDate: z.string(),
        roomType: z.enum(["room_only", "with_breakfast"]),
        price: z.number().optional(),
        revenue: z.number().optional(),
        sessionId: z.string().optional(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Record event
      await db.createABTestEvent(input);

      // Update test aggregates
      if (input.eventType === "booking") {
        await db.incrementABTestBookings(input.testId, input.variant);
      }

      if (input.eventType === "revenue" && input.revenue) {
        await db.incrementABTestRevenue(input.testId, input.variant, input.revenue);
      }

      return { success: true };
    }),

  // Calculate statistical significance
  calculateSignificance: protectedProcedure
    .input(z.object({ testId: z.number() }))
    .query(async ({ input }) => {
      const test = await db.getABTestById(input.testId);
      if (!test) throw new Error("Test not found");

      // Simple two-proportion z-test
      const nA = test.variantABookings;
      const nB = test.variantBBookings;
      const rA = test.variantARevenue / 100; // Convert to dollars
      const rB = test.variantBRevenue / 100;

      if (nA === 0 || nB === 0) {
        return {
          pValue: null,
          confidenceLevel: 0,
          isSignificant: false,
          recommendation: "אין מספיק נתונים לחישוב מובהקות סטטיסטית",
        };
      }

      // Calculate average revenue per booking
      const avgA = rA / nA;
      const avgB = rB / nB;

      // Calculate pooled standard deviation
      const varA = Math.pow(avgA * 0.3, 2); // Simplified variance estimation
      const varB = Math.pow(avgB * 0.3, 2);

      const seA = Math.sqrt(varA / nA);
      const seB = Math.sqrt(varB / nB);
      const seDiff = Math.sqrt(seA * seA + seB * seB);

      // Calculate z-score
      const zScore = (avgB - avgA) / seDiff;

      // Calculate p-value (simplified)
      const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

      // Confidence level
      const confidenceLevel = Math.round((1 - pValue) * 100);

      // Is significant at 95% confidence?
      const isSignificant = pValue < 0.05;

      let recommendation = "";
      if (isSignificant) {
        if (avgB > avgA) {
          recommendation = `גרסה B מנצחת! שיפור של ${(((avgB - avgA) / avgA) * 100).toFixed(1)}% בהכנסות ממוצעות.`;
        } else {
          recommendation = `גרסה A מנצחת! גרסה B גרועה ב-${(((avgA - avgB) / avgA) * 100).toFixed(1)}%.`;
        }
      } else {
        recommendation = "אין הבדל מובהק סטטיסטית. המשך את הבדיקה או הכרז על תיקו.";
      }

      return {
        pValue: Math.round(pValue * 10000) / 10000,
        confidenceLevel,
        isSignificant,
        recommendation,
        avgRevenueA: avgA,
        avgRevenueB: avgB,
        improvement: ((avgB - avgA) / avgA) * 100,
      };
    }),

  // Declare winner
  declareWinner: protectedProcedure
    .input(
      z.object({
        testId: z.number(),
        winner: z.enum(["variantA", "variantB", "inconclusive"]),
      })
    )
    .mutation(async ({ input }) => {
      // Update test
      await db.updateABTestWinner(input.testId, input.winner);

      // Mark as completed
      await db.updateABTestStatus(input.testId, "completed");

      return { success: true };
    }),

  // Get test results summary
  getTestResults: protectedProcedure
    .input(z.object({ testId: z.number() }))
    .query(async ({ input }) => {
      const test = await db.getABTestById(input.testId);
      if (!test) throw new Error("Test not found");

      const events = await db.getABTestEvents(input.testId);

      // Calculate metrics
      const viewsA = events.filter((e: any) => e.variant === "A" && e.eventType === "view").length;
      const viewsB = events.filter((e: any) => e.variant === "B" && e.eventType === "view").length;

      const bookingsA = test.variantABookings;
      const bookingsB = test.variantBBookings;

      const conversionA = viewsA > 0 ? (bookingsA / viewsA) * 100 : 0;
      const conversionB = viewsB > 0 ? (bookingsB / viewsB) * 100 : 0;

      const avgRevenueA = bookingsA > 0 ? test.variantARevenue / bookingsA : 0;
      const avgRevenueB = bookingsB > 0 ? test.variantBRevenue / bookingsB : 0;

      return {
        test,
        metrics: {
          variantA: {
            views: viewsA,
            bookings: bookingsA,
            revenue: test.variantARevenue,
            conversionRate: conversionA,
            avgRevenue: avgRevenueA,
          },
          variantB: {
            views: viewsB,
            bookings: bookingsB,
            revenue: test.variantBRevenue,
            conversionRate: conversionB,
            avgRevenue: avgRevenueB,
          },
        },
      };
    }),
});

/**
 * Normal CDF approximation (for z-score to p-value conversion)
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return z > 0 ? 1 - p : p;
}
