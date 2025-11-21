import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { hotelsRouter } from "./routers/hotels";
import { scansRouter } from "./routers/scans";
import { exportRouter } from "./routers/export";
import { monitoringRouter } from "./routers/monitoring";
import { aiRouter } from "./routers/ai";
import { pricingRouter } from "./routers/pricing";
import { calendarRouter } from "./routers/calendar";
import { revenueRouter } from "./routers/revenue";
import { dynamicPricingRouter } from "./routers/dynamicPricing";
import { competitorIntelligenceRouter } from "./routers/competitorIntelligence";
import { abTestingRouter } from "./routers/abTesting";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Feature routers
  hotels: hotelsRouter,
  scans: scansRouter,
  export: exportRouter,
  monitoring: monitoringRouter,
  ai: aiRouter,
  pricing: pricingRouter,
  calendar: calendarRouter,
  revenue: revenueRouter,
  dynamicPricing: dynamicPricingRouter,
  competitorIntelligence: competitorIntelligenceRouter,
  abTesting: abTestingRouter,
});

export type AppRouter = typeof appRouter;
