import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import OpenAI from "openai";
import {
  createChatConversation,
  getChatConversations,
  createChatMessage,
  getChatMessages,
  deleteChatConversation,
  getAllHotels,
  getScanResults,
  getLatestScanResultsForConfig,
  getScanConfigs,
  getScansForConfig,
} from "../db";
import { getOnlyNightApi } from "../services/onlyNightApi";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// AI function definitions for OpenAI function calling
const functions = [
  {
    name: "query_hotel_prices",
    description: "Query hotel prices from the database. Can filter by hotel name, date range, and room type.",
    parameters: {
      type: "object",
      properties: {
        hotelName: {
          type: "string",
          description: "Name of the hotel to search for (partial match supported)",
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        roomType: {
          type: "string",
          enum: ["room_only", "with_breakfast"],
          description: "Type of room",
        },
      },
    },
  },
  {
    name: "compare_competitors",
    description: "Compare prices between multiple hotels for specific dates",
    parameters: {
      type: "object",
      properties: {
        hotelNames: {
          type: "array",
          items: { type: "string" },
          description: "Array of hotel names to compare",
        },
        date: {
          type: "string",
          description: "Date to compare in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "get_price_statistics",
    description: "Get statistical analysis of prices (average, min, max, trends)",
    parameters: {
      type: "object",
      properties: {
        hotelName: {
          type: "string",
          description: "Hotel name to analyze",
        },
        period: {
          type: "string",
          enum: ["7days", "30days", "60days"],
          description: "Time period to analyze",
        },
      },
    },
  },
  {
    name: "find_best_rates",
    description: "Find hotels with the best rates for specific criteria",
    parameters: {
      type: "object",
      properties: {
        dateRange: {
          type: "object",
          properties: {
            start: { type: "string" },
            end: { type: "string" },
          },
        },
        roomType: {
          type: "string",
          enum: ["room_only", "with_breakfast"],
        },
      },
    },
  },
  {
    name: "search_instant_prices",
    description: "Search for real-time hotel prices from OnlyNight API. Use this to get live pricing for any hotel, city, or dates. Returns actual bookable offers with prices.",
    parameters: {
      type: "object",
      properties: {
        dateFrom: {
          type: "string",
          description: "Check-in date in YYYY-MM-DD format (required)",
        },
        dateTo: {
          type: "string",
          description: "Check-out date in YYYY-MM-DD format (required)",
        },
        hotelName: {
          type: "string",
          description: "Hotel name to search for (optional)",
        },
        city: {
          type: "string",
          description: "City name (optional)",
        },
        adults: {
          type: "number",
          description: "Number of adults (default: 2)",
        },
        stars: {
          type: "number",
          description: "Hotel star rating filter (1-5)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 50)",
        },
      },
      required: ["dateFrom", "dateTo"],
    },
  },
  {
    name: "get_room_archive",
    description: "Retrieve historical room booking data from archive. Use this to analyze past bookings, pricing history, and booking patterns.",
    parameters: {
      type: "object",
      properties: {
        stayFrom: {
          type: "string",
          description: "Start date for stay period filter (ISO datetime or YYYY-MM-DD)",
        },
        stayTo: {
          type: "string",
          description: "End date for stay period filter (ISO datetime or YYYY-MM-DD)",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name (partial match)",
        },
        city: {
          type: "string",
          description: "Filter by city name",
        },
        minPrice: {
          type: "number",
          description: "Minimum price filter",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price filter",
        },
        roomBoard: {
          type: "string",
          description: "Room board type (e.g., 'BB' for bed & breakfast)",
        },
        pageNumber: {
          type: "number",
          description: "Page number for pagination (default: 1)",
        },
        pageSize: {
          type: "number",
          description: "Results per page (default: 50)",
        },
      },
    },
  },
];

// Function to execute AI functions
async function executeFunction(functionName: string, args: any, userId: number) {
  console.log(`[AI] 🤖 Executing function: ${functionName}`, args);

  try {
    const hotels = await getAllHotels();

    switch (functionName) {
      case "query_hotel_prices": {
        // Find hotel by name
        let targetHotel = null;
        if (args.hotelName) {
          targetHotel = hotels.find(h =>
            h.name.toLowerCase().includes(args.hotelName.toLowerCase())
          );
        }

        // Get scan configs for this user
        const configs = await getScanConfigs(userId);
        if (!configs.length) {
          return { error: "No scan configurations found" };
        }

        // Get latest scan results
        const results = await getLatestScanResultsForConfig(configs[0].id);

        // Filter results
        let filteredResults = results;
        if (targetHotel) {
          filteredResults = results.filter(r => r.hotel.id === targetHotel.id);
        }
        if (args.startDate) {
          filteredResults = filteredResults.filter(r => r.result.checkInDate >= args.startDate);
        }
        if (args.endDate) {
          filteredResults = filteredResults.filter(r => r.result.checkInDate <= args.endDate);
        }
        if (args.roomType) {
          filteredResults = filteredResults.filter(r => r.result.roomType === args.roomType);
        }

        // Format results
        const formattedResults = filteredResults.map(r => ({
          hotel: r.hotel.name,
          date: r.result.checkInDate,
          roomType: r.result.roomType,
          price: r.result.price ? `₪${r.result.price}` : "N/A",
          available: r.result.isAvailable === 1,
        }));

        return {
          total: formattedResults.length,
          results: formattedResults.slice(0, 20), // Limit to 20 results
        };
      }

      case "compare_competitors": {
        const configs = await getScanConfigs(userId);
        if (!configs.length) {
          return { error: "No scan configurations found" };
        }

        const results = await getLatestScanResultsForConfig(configs[0].id);

        // Filter by date
        const dateResults = results.filter(r => r.result.checkInDate === args.date);

        // Group by hotel
        const comparison = dateResults.reduce((acc: any, r) => {
          const hotelName = r.hotel.name;
          if (!acc[hotelName]) {
            acc[hotelName] = {
              hotel: hotelName,
              prices: {},
            };
          }
          acc[hotelName].prices[r.result.roomType] = r.result.price ? `₪${r.result.price}` : "N/A";
          return acc;
        }, {});

        return {
          date: args.date,
          comparison: Object.values(comparison),
        };
      }

      case "get_price_statistics": {
        const configs = await getScanConfigs(userId);
        if (!configs.length) {
          return { error: "No scan configurations found" };
        }

        const results = await getLatestScanResultsForConfig(configs[0].id);

        let targetResults = results;
        if (args.hotelName) {
          const targetHotel = hotels.find(h =>
            h.name.toLowerCase().includes(args.hotelName.toLowerCase())
          );
          if (targetHotel) {
            targetResults = results.filter(r => r.hotel.id === targetHotel.id);
          }
        }

        // Calculate statistics
        const prices = targetResults
          .filter(r => r.result.price)
          .map(r => r.result.price!);

        if (prices.length === 0) {
          return { error: "No price data available" };
        }

        const stats = {
          count: prices.length,
          average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          min: Math.min(...prices),
          max: Math.max(...prices),
          hotel: args.hotelName || "All hotels",
        };

        return stats;
      }

      case "find_best_rates": {
        const configs = await getScanConfigs(userId);
        if (!configs.length) {
          return { error: "No scan configurations found" };
        }

        const results = await getLatestScanResultsForConfig(configs[0].id);

        let filteredResults = results.filter(r => r.result.price);

        if (args.dateRange) {
          filteredResults = filteredResults.filter(
            r =>
              r.result.checkInDate >= args.dateRange.start &&
              r.result.checkInDate <= args.dateRange.end
          );
        }

        if (args.roomType) {
          filteredResults = filteredResults.filter(r => r.result.roomType === args.roomType);
        }

        // Sort by price
        filteredResults.sort((a, b) => (a.result.price || 0) - (b.result.price || 0));

        const bestRates = filteredResults.slice(0, 10).map(r => ({
          hotel: r.hotel.name,
          date: r.result.checkInDate,
          roomType: r.result.roomType,
          price: `₪${r.result.price}`,
        }));

        return { bestRates };
      }

      case "search_instant_prices": {
        // Call OnlyNight API for real-time price search
        const onlyNightApi = getOnlyNightApi();
        
        const searchParams = {
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
          hotelName: args.hotelName,
          city: args.city,
          adults: args.adults || 2,
          paxChildren: args.paxChildren,
          stars: args.stars,
          limit: args.limit || 50,
        };

        const apiResponse = await onlyNightApi.searchInstantPrices(searchParams);

        if (!apiResponse.success) {
          return {
            error: apiResponse.error || "Failed to search instant prices",
            message: "לא הצלחתי לחפש מחירים. ייתכן שה-API לא זמין או שאין תוצאות.",
          };
        }

        // Format results for AI
        const results = apiResponse.data?.results || [];
        if (results.length === 0) {
          return {
            message: "לא נמצאו מלונות זמינים עבור התאריכים והקריטריונים המבוקשים.",
            searchParams,
          };
        }

        const formattedResults = results.slice(0, 15).map((r: any) => ({
          hotelName: r.hotelName || "לא ידוע",
          city: r.city || args.city,
          stars: r.stars || "N/A",
          price: r.price?.amount || "N/A",
          currency: r.price?.currency || "ILS",
          roomCategory: r.category || "סטנדרט",
          roomBasis: r.roomBasis || "לא צוין",
          availability: r.availability || "זמין",
        }));

        return {
          success: true,
          totalResults: results.length,
          results: formattedResults,
          searchParams,
          summary: onlyNightApi.formatSearchResults(apiResponse.data),
        };
      }

      case "get_room_archive": {
        // Call OnlyNight API for archived room data
        const onlyNightApi = getOnlyNightApi();

        const archiveParams = {
          stayFrom: args.stayFrom,
          stayTo: args.stayTo,
          hotelName: args.hotelName,
          city: args.city,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          roomBoard: args.roomBoard,
          roomCategory: args.roomCategory,
          minUpdatedAt: args.minUpdatedAt,
          maxUpdatedAt: args.maxUpdatedAt,
          pageNumber: args.pageNumber || 1,
          pageSize: args.pageSize || 50,
        };

        const apiResponse = await onlyNightApi.getRoomArchiveData(archiveParams);

        if (!apiResponse.success) {
          return {
            error: apiResponse.error || "Failed to fetch archive data",
            message: "לא הצלחתי לשלוף נתונים מהארכיון. ייתכן שה-API לא זמין.",
          };
        }

        const items = apiResponse.data?.items || [];
        if (items.length === 0) {
          return {
            message: "לא נמצאו רשומות בארכיון עבור הקריטריונים המבוקשים.",
            archiveParams,
          };
        }

        // Format archive data for AI
        const formattedItems = items.slice(0, 20).map((item: any) => ({
          hotelName: item.hotelName || "לא ידוע",
          checkInDate: item.checkInDate || "לא צוין",
          checkOutDate: item.checkOutDate || "לא צוין",
          price: item.price || "N/A",
          roomBoard: item.roomBoard || "לא צוין",
          roomCategory: item.roomCategory || "לא צוין",
          guests: item.guests || "לא צוין",
          provider: item.provider || "לא ידוע",
          bookingDate: item.createdAt || item.updatedAt,
        }));

        return {
          success: true,
          totalItems: apiResponse.data?.totalItems || items.length,
          pageNumber: args.pageNumber || 1,
          pageSize: args.pageSize || 50,
          items: formattedItems,
          archiveParams,
          summary: onlyNightApi.formatArchiveData(apiResponse.data),
        };
      }

      default:
        return { error: "Unknown function" };
    }
  } catch (error) {
    console.error(`[AI] ❌ Error executing function ${functionName}:`, error);
    return { error: String(error) };
  }
}

export const aiRouter = router({
  // Create new conversation
  createConversation: publicProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const result = await createChatConversation(ctx.user.id, input.title);
      return { id: result[0].insertId };
    }),

  // Get all conversations
  getConversations: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return getChatConversations(ctx.user.id);
  }),

  // Get messages for a conversation
  getMessages: publicProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input }) => {
      return getChatMessages(input.conversationId);
    }),

  // Send message and get AI response
  sendMessage: publicProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      // Save user message
      await createChatMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
      });

      // Get conversation history
      const history = await getChatMessages(input.conversationId);

      // Prepare messages for OpenAI
      const messages: any[] = [
        {
          role: "system",
          content: `You are an AI assistant for a hotel Revenue Management System (RMS). You help hotel managers analyze pricing data, compare with competitors, and make pricing decisions.

You have access to the following data:
- Hotel pricing information from Booking.com
- Competitor pricing analysis
- Historical pricing trends
- Room types: room_only (without breakfast) and with_breakfast

When answering questions:
1. Be concise and data-driven
2. Always include specific numbers and comparisons
3. Provide actionable insights
4. Format currency as ₪ (Israeli Shekel)
5. If asked about recommendations, explain your reasoning

Use the available functions to query the database when needed.`,
        },
        ...history.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
      ];

      try {
        // Call OpenAI with function calling
        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages,
          functions,
          function_call: "auto",
          temperature: 0.7,
          max_tokens: 1000,
        });

        const assistantMessage = response.choices[0].message;

        // Check if AI wants to call a function
        if (assistantMessage.function_call) {
          const functionName = assistantMessage.function_call.name;
          const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

          console.log(`[AI] 🔧 Function call: ${functionName}`, functionArgs);

          // Execute the function
          const functionResult = await executeFunction(functionName, functionArgs, ctx.user.id);

          // Call OpenAI again with function result
          const secondResponse = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
              ...messages,
              {
                role: "assistant",
                content: null,
                function_call: assistantMessage.function_call,
              },
              {
                role: "function",
                name: functionName,
                content: JSON.stringify(functionResult),
              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          });

          const finalMessage = secondResponse.choices[0].message.content || "אני לא הצלחתי לקבל תשובה.";

          // Save assistant response with metadata
          await createChatMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: finalMessage,
            metadata: JSON.stringify({
              functionCall: functionName,
              functionArgs,
              functionResult,
            }),
          });

          return {
            message: finalMessage,
            metadata: {
              functionCall: functionName,
              functionResult,
            },
          };
        } else {
          // No function call, just save the response
          const aiResponse = assistantMessage.content || "אני לא הצלחתי לקבל תשובה.";

          await createChatMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: aiResponse,
          });

          return { message: aiResponse };
        }
      } catch (error) {
        console.error("[AI] ❌ OpenAI error:", error);
        const errorMessage = "מצטער, אירעה שגיאה. אנא נסה שוב.";
        await createChatMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: errorMessage,
        });
        return { message: errorMessage, error: String(error) };
      }
    }),

  // Delete conversation
  deleteConversation: publicProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      await deleteChatConversation(input.conversationId);
      return { success: true };
    }),
});
