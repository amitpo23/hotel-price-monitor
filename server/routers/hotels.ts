import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const hotelsRouter = router({
  // List all hotels for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getHotels(ctx.user.id);
  }),

  // Get all hotels (for selection in scan config)
  listAll: protectedProcedure.query(async () => {
    return db.getAllHotels();
  }),

  // Get a single hotel by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getHotelById(input.id);
    }),

  // Create a new hotel
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Hotel name is required"),
        bookingUrl: z.string()
          .url("Must be a valid URL")
          .refine(
            (url) => url.includes('booking.com'),
            { message: "Must be a valid Booking.com URL" }
          ),
        location: z.string().optional(),
        category: z.enum(["target", "competitor"]).default("competitor"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.createHotel({
        ...input,
        createdBy: ctx.user.id,
        isActive: 1,
      });
      return { success: true };
    }),

  // Update an existing hotel
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        bookingUrl: z.string()
          .url()
          .refine(
            (url) => url.includes('booking.com'),
            { message: "Must be a valid Booking.com URL" }
          )
          .optional(),
        location: z.string().optional(),
        category: z.enum(["target", "competitor"]).optional(),
        isActive: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateHotel(id, data);
      return { success: true };
    }),

  // Delete a hotel
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteHotel(input.id);
      return { success: true };
    }),
});
