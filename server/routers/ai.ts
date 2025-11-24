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
  {
    name: "search_web_for_trends",
    description: "Search the web for tourism trends, hotel demand forecasts, seasonal patterns, and market insights. Use this to find external information about travel trends, events, holidays, and market conditions.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query in Hebrew or English (e.g., 'Tel Aviv hotel demand summer 2025', 'תיירות ישראל חגים 2025')",
        },
        location: {
          type: "string",
          description: "Specific location/city to focus on (optional)",
        },
        timeframe: {
          type: "string",
          description: "Time period of interest (e.g., 'summer 2025', 'Passover 2025')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_market_competition",
    description: "Search for competitive intelligence about hotels in a specific area - their pricing strategies, occupancy rates, new openings, renovations, or market positioning.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City or area to analyze (e.g., 'Tel Aviv', 'Jerusalem', 'Eilat')",
        },
        hotelCategory: {
          type: "string",
          description: "Hotel category or star rating (e.g., '5-star', 'boutique', 'luxury')",
        },
        aspectToAnalyze: {
          type: "string",
          description: "Specific aspect to focus on (e.g., 'pricing', 'occupancy', 'new hotels', 'renovations', 'events')",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "get_seasonality_insights",
    description: "Get insights about seasonal patterns, holidays, events, and peak/low seasons that affect hotel demand and pricing. Includes Israeli holidays, international events, school vacations, etc.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location to analyze (e.g., 'Israel', 'Tel Aviv', 'Eilat')",
        },
        year: {
          type: "number",
          description: "Year to analyze (e.g., 2025)",
        },
        monthRange: {
          type: "string",
          description: "Specific months to focus on (e.g., 'June-August', 'December-January')",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "fetch_pricing_benchmarks",
    description: "Fetch industry pricing benchmarks, average daily rates (ADR), revenue per available room (RevPAR), and other hotel performance metrics from web sources.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location for benchmarks (e.g., 'Tel Aviv', 'Jerusalem')",
        },
        hotelType: {
          type: "string",
          description: "Type of hotel (e.g., '4-star', '5-star', 'boutique')",
        },
        metric: {
          type: "string",
          description: "Specific metric (e.g., 'ADR', 'RevPAR', 'occupancy rate')",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "check_upcoming_events",
    description: "Check for upcoming events, conferences, holidays, festivals, or other factors that might affect hotel demand in a specific location and time period.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location to check (e.g., 'Tel Aviv', 'Jerusalem', 'Eilat')",
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        eventType: {
          type: "string",
          description: "Type of events to focus on (e.g., 'conferences', 'festivals', 'holidays', 'sports')",
        },
      },
      required: ["location"],
    },
  },
  // ==================== OnlyNight Booking Functions ====================
  {
    name: "insert_hotel_opportunity",
    description: "Insert a hotel booking opportunity to reserve rooms. This is step 1 of the booking flow. Use this to create a new booking opportunity for specific dates and room requirements.",
    parameters: {
      type: "object",
      properties: {
        hotelId: {
          type: "number",
          description: "Hotel ID from search results",
        },
        startDateStr: {
          type: "string",
          description: "Check-in date in YYYY-MM-DD format",
        },
        endDateStr: {
          type: "string",
          description: "Check-out date in YYYY-MM-DD format",
        },
        boardId: {
          type: "number",
          description: "Board type ID (meal plan)",
        },
        categoryId: {
          type: "number",
          description: "Room category ID",
        },
        buyPrice: {
          type: "number",
          description: "Purchase price",
        },
        pushPrice: {
          type: "number",
          description: "Selling price",
        },
        maxRooms: {
          type: "number",
          description: "Maximum number of rooms to book (1-30)",
        },
        paxAdults: {
          type: "number",
          description: "Number of adults",
        },
        paxChildren: {
          type: "array",
          items: { type: "number" },
          description: "Ages of children (optional)",
        },
        reservationFullName: {
          type: "string",
          description: "Guest full name (optional)",
        },
      },
      required: ["hotelId", "startDateStr", "endDateStr", "boardId", "categoryId", "buyPrice", "pushPrice", "maxRooms", "paxAdults"],
    },
  },
  {
    name: "get_active_rooms",
    description: "Get currently active (booked) rooms. Use this to see current bookings and their status.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date filter (ISO datetime)",
        },
        endDate: {
          type: "string",
          description: "End date filter (ISO datetime)",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name",
        },
        city: {
          type: "string",
          description: "Filter by city",
        },
        hotelStars: {
          type: "number",
          description: "Filter by hotel star rating",
        },
      },
    },
  },
  {
    name: "get_sales_records",
    description: "Get historical sales records (sold rooms). Use this to analyze past bookings and revenue.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date filter",
        },
        endDate: {
          type: "string",
          description: "End date filter",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name",
        },
        city: {
          type: "string",
          description: "Filter by city",
        },
      },
    },
  },
  {
    name: "get_cancelled_rooms",
    description: "Get cancelled bookings. Use this to analyze cancellation patterns.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date filter",
        },
        endDate: {
          type: "string",
          description: "End date filter",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name",
        },
      },
    },
  },
  {
    name: "get_dashboard_stats",
    description: "Get dashboard statistics including bookings, revenue, and performance metrics.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Filter by city",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name",
        },
        hotelStars: {
          type: "number",
          description: "Filter by star rating",
        },
        reservationMonthDate: {
          type: "string",
          description: "Filter by reservation month",
        },
      },
    },
  },
  {
    name: "get_opportunities_list",
    description: "Get list of booking opportunities (pending bookings that haven't been confirmed yet).",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Filter by city",
        },
        hotelName: {
          type: "string",
          description: "Filter by hotel name",
        },
      },
    },
  },
  {
    name: "get_opportunity_details",
    description: "Get detailed information about a specific opportunity by its back office ID. This is step 2 of booking flow.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Back office ID of the opportunity",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "search_opportunity_hotels",
    description: "Search for available hotels for a specific opportunity. This is step 3 of booking flow.",
    parameters: {
      type: "object",
      properties: {
        opportiunityId: {
          type: "number",
          description: "Opportunity ID to search hotels for",
        },
      },
      required: ["opportiunityId"],
    },
  },
  {
    name: "confirm_booking",
    description: "Confirm and finalize a booking (manual book). This is step 4 (final step) of booking flow.",
    parameters: {
      type: "object",
      properties: {
        opportiunityId: {
          type: "number",
          description: "Opportunity ID to confirm",
        },
        code: {
          type: "string",
          description: "Confirmation code from hotel search",
        },
      },
      required: ["opportiunityId", "code"],
    },
  },
  {
    name: "update_room_price",
    description: "Update the push (selling) price for an active room booking.",
    parameters: {
      type: "object",
      properties: {
        preBookId: {
          type: "number",
          description: "Pre-booking ID",
        },
        pushPrice: {
          type: "number",
          description: "New selling price",
        },
      },
      required: ["preBookId", "pushPrice"],
    },
  },
  {
    name: "cancel_room_booking",
    description: "Cancel an active room booking by its pre-booking ID.",
    parameters: {
      type: "object",
      properties: {
        prebookId: {
          type: "number",
          description: "Pre-booking ID to cancel",
        },
      },
      required: ["prebookId"],
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

      case "search_web_for_trends": {
        console.log(`[AI] 🌐 Searching web for trends: ${args.query}`);
        
        try {
          // Build comprehensive search query
          let searchQuery = args.query;
          if (args.location) {
            searchQuery += ` ${args.location}`;
          }
          if (args.timeframe) {
            searchQuery += ` ${args.timeframe}`;
          }

          // Use WebSearch tool
          const { WebSearch } = await import('../_core/tools');
          const searchResults = await WebSearch.search(searchQuery);

          if (!searchResults || searchResults.length === 0) {
            return {
              success: false,
              message: "לא נמצאו תוצאות רלוונטיות. נסה לשנות את שאלת החיפוש.",
              query: searchQuery,
            };
          }

          // Format results for AI
          const formattedResults = searchResults.slice(0, 5).map((result: any) => ({
            title: result.title,
            snippet: result.snippet || result.description,
            url: result.url,
            source: result.source || new URL(result.url).hostname,
          }));

          return {
            success: true,
            query: searchQuery,
            resultsCount: searchResults.length,
            results: formattedResults,
            summary: `נמצאו ${searchResults.length} תוצאות רלוונטיות. הנה ${formattedResults.length} התוצאות המובילות:`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Web search error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בחיפוש באינטרנט. ייתכן שהשירות אינו זמין כרגע.",
          };
        }
      }

      case "analyze_market_competition": {
        console.log(`[AI] 🏨 Analyzing market competition for ${args.city}`);
        
        try {
          // Build search queries for different aspects
          const queries = [
            `${args.city} hotels ${args.hotelCategory || ''} ${args.aspectToAnalyze || 'market analysis'}`,
            `${args.city} hotel prices ${args.hotelCategory || ''} 2025`,
            `${args.city} hotel occupancy rates trends`,
          ];

          const { WebSearch } = await import('../_core/tools');
          const allResults: any[] = [];

          // Search for each query
          for (const query of queries) {
            try {
              const results = await WebSearch.search(query);
              if (results && results.length > 0) {
                allResults.push(...results.slice(0, 3));
              }
            } catch (err) {
              console.error(`[AI] Search failed for query: ${query}`, err);
            }
          }

          if (allResults.length === 0) {
            return {
              success: false,
              message: `לא נמצא מידע תחרותי עבור ${args.city}. נסה עיר אחרת או שנה את הקטגוריה.`,
              city: args.city,
            };
          }

          // Remove duplicates and format
          const uniqueResults = Array.from(
            new Map(allResults.map(r => [r.url, r])).values()
          ).slice(0, 6);

          const formattedResults = uniqueResults.map((result: any) => ({
            title: result.title,
            snippet: result.snippet || result.description,
            url: result.url,
            relevance: result.relevance || 'high',
          }));

          return {
            success: true,
            city: args.city,
            category: args.hotelCategory || 'כל הקטגוריות',
            aspect: args.aspectToAnalyze || 'ניתוח שוק כללי',
            resultsCount: formattedResults.length,
            results: formattedResults,
            summary: `נמצאו ${formattedResults.length} מקורות מידע רלוונטיים לגבי התחרות בשוק המלונאות ב-${args.city}.`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Market analysis error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בניתוח השוק. נסה שוב מאוחר יותר.",
          };
        }
      }

      case "get_seasonality_insights": {
        console.log(`[AI] 📅 Getting seasonality insights for ${args.location}`);
        
        try {
          const year = args.year || new Date().getFullYear();
          const location = args.location;

          // Build search queries for seasonality
          const queries = [
            `${location} tourism peak season ${year}`,
            `${location} hotel demand patterns ${year}`,
            `Israel holidays calendar ${year}`,
          ];

          if (args.monthRange) {
            queries.push(`${location} ${args.monthRange} ${year} tourism`);
          }

          const { WebSearch } = await import('../_core/tools');
          const allResults: any[] = [];

          for (const query of queries) {
            try {
              const results = await WebSearch.search(query);
              if (results && results.length > 0) {
                allResults.push(...results.slice(0, 2));
              }
            } catch (err) {
              console.error(`[AI] Seasonality search failed:`, err);
            }
          }

          // Also add known Israeli holidays context
          const israeliHolidays = {
            2025: [
              { name: "פסח", dates: "12-20 אפריל 2025", type: "חג מרכזי", demand: "גבוה מאוד" },
              { name: "שבועות", dates: "1-3 יוני 2025", type: "חג", demand: "בינוני-גבוה" },
              { name: "חופש הגדול", dates: "יולי-אוגוסט 2025", type: "חופשת קיץ", demand: "גבוה מאוד" },
              { name: "ראש השנה", dates: "22-24 ספטמבר 2025", type: "חג מרכזי", demand: "גבוה" },
              { name: "יום כיפור", dates: "1-2 אוקטובר 2025", type: "חג", demand: "נמוך" },
              { name: "סוכות", dates: "6-13 אוקטובר 2025", type: "חג מרכזי", demand: "גבוה" },
              { name: "חנוכה", dates: "14-22 דצמבר 2025", type: "חג", demand: "בינוני" },
            ],
          };

          const formattedResults = allResults.slice(0, 5).map((result: any) => ({
            title: result.title,
            snippet: result.snippet || result.description,
            url: result.url,
          }));

          return {
            success: true,
            location,
            year,
            monthRange: args.monthRange,
            holidays: israeliHolidays[year as keyof typeof israeliHolidays] || [],
            webResults: formattedResults,
            summary: `מידע עונתי עבור ${location} בשנת ${year}. נמצאו ${formattedResults.length} מקורות מידע וכן רשימת חגים ישראליים רלוונטיים.`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Seasonality insights error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת מידע עונתי.",
          };
        }
      }

      case "fetch_pricing_benchmarks": {
        console.log(`[AI] 💰 Fetching pricing benchmarks for ${args.location}`);
        
        try {
          const queries = [
            `${args.location} hotel ADR average daily rate ${args.hotelType || ''}`,
            `${args.location} hotel RevPAR revenue per available room`,
            `${args.location} ${args.hotelType || ''} hotel pricing trends 2025`,
          ];

          if (args.metric) {
            queries.unshift(`${args.location} hotel ${args.metric} ${args.hotelType || ''}`);
          }

          const { WebSearch } = await import('../_core/tools');
          const allResults: any[] = [];

          for (const query of queries) {
            try {
              const results = await WebSearch.search(query);
              if (results && results.length > 0) {
                allResults.push(...results.slice(0, 2));
              }
            } catch (err) {
              console.error(`[AI] Benchmark search failed:`, err);
            }
          }

          if (allResults.length === 0) {
            return {
              success: false,
              message: `לא נמצאו מדדי תמחור עבור ${args.location}. נסה מיקום אחר או בדוק מקורות מידע מקומיים.`,
              location: args.location,
            };
          }

          const formattedResults = allResults.slice(0, 5).map((result: any) => ({
            title: result.title,
            snippet: result.snippet || result.description,
            url: result.url,
            source: result.source || new URL(result.url).hostname,
          }));

          return {
            success: true,
            location: args.location,
            hotelType: args.hotelType || 'כל הסוגים',
            metric: args.metric || 'מדדים כלליים',
            resultsCount: formattedResults.length,
            results: formattedResults,
            summary: `נמצאו ${formattedResults.length} מקורות מידע לגבי מדדי תמחור ב-${args.location}.`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Pricing benchmarks error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת מדדי תמחור.",
          };
        }
      }

      case "check_upcoming_events": {
        console.log(`[AI] 🎉 Checking upcoming events for ${args.location}`);
        
        try {
          let searchQuery = `${args.location} upcoming events`;
          
          if (args.startDate && args.endDate) {
            const startYear = args.startDate.substring(0, 4);
            const startMonth = args.startDate.substring(5, 7);
            searchQuery += ` ${startYear}`;
          }

          if (args.eventType) {
            searchQuery += ` ${args.eventType}`;
          } else {
            searchQuery += ` conferences festivals holidays sports`;
          }

          const { WebSearch } = await import('../_core/tools');
          const results = await WebSearch.search(searchQuery);

          if (!results || results.length === 0) {
            return {
              success: false,
              message: `לא נמצאו אירועים קרובים עבור ${args.location}. נסה תאריכים אחרים או עיר אחרת.`,
              location: args.location,
            };
          }

          const formattedResults = results.slice(0, 8).map((result: any) => ({
            title: result.title,
            snippet: result.snippet || result.description,
            url: result.url,
            type: result.type || 'אירוע כללי',
          }));

          return {
            success: true,
            location: args.location,
            dateRange: args.startDate && args.endDate ? `${args.startDate} עד ${args.endDate}` : 'לא צוין',
            eventType: args.eventType || 'כל סוגי האירועים',
            resultsCount: formattedResults.length,
            events: formattedResults,
            summary: `נמצאו ${formattedResults.length} אירועים רלוונטיים ב-${args.location} שעלולים להשפיע על הביקוש למלונות.`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Events check error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בחיפוש אירועים.",
          };
        }
      }

      // ==================== OnlyNight Booking Functions ====================
      
      case "insert_hotel_opportunity": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const oppParams = {
            hotelId: args.hotelId,
            startDateStr: args.startDateStr,
            endDateStr: args.endDateStr,
            boardId: args.boardId,
            categoryId: args.categoryId,
            buyPrice: args.buyPrice,
            pushPrice: args.pushPrice,
            maxRooms: args.maxRooms,
            userId: userId,
            paxAdults: args.paxAdults,
            paxChildren: args.paxChildren || [],
            reservationFullName: args.reservationFullName || "",
            ratePlanCode: args.ratePlanCode,
            invTypeCode: args.invTypeCode,
            stars: args.stars,
            destinationId: args.destinationId,
            locationRange: args.locationRange,
            providerId: args.providerId,
          };

          const apiResponse = await onlyNightApi.insertOpportunity(oppParams);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי ליצור הזדמנות הזמנה.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: `הזדמנות הזמנה נוצרה בהצלחה למלון ${args.hotelId} לתאריכים ${args.startDateStr} - ${args.endDateStr}`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Insert opportunity error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה ביצירת הזדמנות הזמנה.",
          };
        }
      }

      case "get_active_rooms": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const params = {
            startDate: args.startDate,
            endDate: args.endDate,
            hotelName: args.hotelName,
            city: args.city,
            hotelStars: args.hotelStars,
            roomBoard: args.roomBoard,
            roomCategory: args.roomCategory,
            provider: args.provider,
          };

          const apiResponse = await onlyNightApi.getRoomsActive(params);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף חדרים פעילים.",
            };
          }

          const rooms = apiResponse.data || [];
          return {
            success: true,
            totalRooms: rooms.length,
            rooms: rooms.slice(0, 20), // Limit to 20 results
            message: `נמצאו ${rooms.length} חדרים פעילים`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get active rooms error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת חדרים פעילים.",
          };
        }
      }

      case "get_sales_records": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const params = {
            startDate: args.startDate,
            endDate: args.endDate,
            hotelName: args.hotelName,
            city: args.city,
            hotelStars: args.hotelStars,
            roomBoard: args.roomBoard,
            roomCategory: args.roomCategory,
            provider: args.provider,
          };

          const apiResponse = await onlyNightApi.getRoomsSales(params);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף רשומות מכירות.",
            };
          }

          const sales = apiResponse.data || [];
          return {
            success: true,
            totalSales: sales.length,
            sales: sales.slice(0, 20),
            message: `נמצאו ${sales.length} רשומות מכירה`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get sales records error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת רשומות מכירות.",
          };
        }
      }

      case "get_cancelled_rooms": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const params = {
            startDate: args.startDate,
            endDate: args.endDate,
            hotelName: args.hotelName,
            city: args.city,
            roomBoard: args.roomBoard,
            roomCategory: args.roomCategory,
          };

          const apiResponse = await onlyNightApi.getRoomsCancel(params);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף רשומות ביטולים.",
            };
          }

          const cancelled = apiResponse.data || [];
          return {
            success: true,
            totalCancelled: cancelled.length,
            cancelled: cancelled.slice(0, 20),
            message: `נמצאו ${cancelled.length} ביטולים`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get cancelled rooms error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת רשומות ביטולים.",
          };
        }
      }

      case "get_dashboard_stats": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const params = {
            city: args.city,
            hotelName: args.hotelName,
            hotelStars: args.hotelStars,
            reservationMonthDate: args.reservationMonthDate,
            checkInMonthDate: args.checkInMonthDate,
            provider: args.provider,
          };

          const apiResponse = await onlyNightApi.getDashboardInfo(params);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף נתוני דשבורד.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: "נתוני דשבורד נשלפו בהצלחה",
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get dashboard stats error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת נתוני דשבורד.",
          };
        }
      }

      case "get_opportunities_list": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const params = {
            city: args.city,
            hotelName: args.hotelName,
            hotelStars: args.hotelStars,
          };

          const apiResponse = await onlyNightApi.getOpportunities(params);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף הזדמנויות.",
            };
          }

          const opportunities = apiResponse.data || [];
          return {
            success: true,
            totalOpportunities: opportunities.length,
            opportunities: opportunities.slice(0, 20),
            message: `נמצאו ${opportunities.length} הזדמנויות`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get opportunities list error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת הזדמנויות.",
          };
        }
      }

      case "get_opportunity_details": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const apiResponse = await onlyNightApi.getOpportunitiesByBackOfficeId({ id: args.id });

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לשלוף פרטי הזדמנות.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: `פרטי הזדמנות ${args.id} נשלפו בהצלחה`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Get opportunity details error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בשליפת פרטי הזדמנות.",
          };
        }
      }

      case "search_opportunity_hotels": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const apiResponse = await onlyNightApi.getOpportunitiesHotelSearch({ 
            opportiunityId: args.opportiunityId 
          });

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לחפש מלונות זמינים להזדמנות.",
            };
          }

          const hotels = apiResponse.data || [];
          return {
            success: true,
            totalHotels: hotels.length,
            hotels: hotels.slice(0, 20),
            message: `נמצאו ${hotels.length} מלונות זמינים`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Search opportunity hotels error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בחיפוש מלונות להזדמנות.",
          };
        }
      }

      case "confirm_booking": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const apiResponse = await onlyNightApi.manualBook({
            opportiunityId: args.opportiunityId,
            code: args.code,
          });

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לאשר את ההזמנה.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: `ההזמנה אושרה בהצלחה! מספר הזדמנות: ${args.opportiunityId}`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Confirm booking error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה באישור ההזמנה.",
          };
        }
      }

      case "update_room_price": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const apiResponse = await onlyNightApi.updatePushPrice({
            preBookId: args.preBookId,
            pushPrice: args.pushPrice,
          });

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לעדכן את מחיר המכירה.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: `מחיר המכירה עודכן בהצלחה ל-₪${args.pushPrice}`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Update room price error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בעדכון מחיר המכירה.",
          };
        }
      }

      case "cancel_room_booking": {
        try {
          const onlyNightApi = getOnlyNightApi();
          
          const apiResponse = await onlyNightApi.cancelRoomActive(args.prebookId);

          if (!apiResponse.success) {
            return {
              error: apiResponse.error,
              message: "לא הצלחתי לבטל את ההזמנה.",
            };
          }

          return {
            success: true,
            data: apiResponse.data,
            message: `ההזמנה בוטלה בהצלחה. מספר הזמנה: ${args.prebookId}`,
          };
        } catch (error: any) {
          console.error(`[AI] ❌ Cancel booking error:`, error);
          return {
            success: false,
            error: error.message,
            message: "שגיאה בביטול ההזמנה.",
          };
        }
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
          content: `You are an AI assistant for a hotel Revenue Management System (RMS). You help hotel managers analyze pricing data, compare with competitors, make pricing decisions, and understand market trends.

You have access to the following data sources:
1. **Internal Database:**
   - Hotel pricing information from Booking.com
   - Competitor pricing analysis
   - Historical pricing trends
   - Room types: room_only (without breakfast) and with_breakfast

2. **Real-time External Data:**
   - OnlyNight API for live hotel prices and availability
   - Historical booking archive data

3. **Market Intelligence (NEW):**
   - Web search for tourism trends and demand forecasts
   - Competitive market analysis for specific locations
   - Seasonal patterns and holiday calendars
   - Industry pricing benchmarks (ADR, RevPAR, occupancy rates)
   - Upcoming events that affect hotel demand

When answering questions:
1. Be concise and data-driven
2. Always include specific numbers and comparisons
3. Provide actionable insights based on both internal data and market trends
4. Format currency as ₪ (Israeli Shekel)
5. If asked about recommendations, explain your reasoning with supporting data
6. When discussing market trends, cite external sources when available
7. Consider seasonal factors, holidays, and events in your analysis
8. Compare internal pricing with market benchmarks when relevant

**How to use your tools:**
- For historical data: Use query_hotel_prices, compare_competitors, get_price_statistics
- For live prices: Use search_instant_prices (OnlyNight API)
- For market trends: Use search_web_for_trends
- For competition: Use analyze_market_competition
- For seasonality: Use get_seasonality_insights
- For benchmarks: Use fetch_pricing_benchmarks
- For events: Use check_upcoming_events

**OnlyNight Booking Flow (NEW):**
You now have full booking capabilities! Follow this 4-step flow:
1. insert_hotel_opportunity - Create booking opportunity
2. get_opportunity_details - Get opportunity back office ID
3. search_opportunity_hotels - Search available hotels for the opportunity
4. confirm_booking - Finalize the booking with confirmation code

**Additional booking tools:**
- get_active_rooms - View current bookings
- get_sales_records - View sales history
- get_cancelled_rooms - View cancellations
- cancel_room_booking - Cancel a booking
- update_room_price - Update selling price
- get_dashboard_stats - View statistics
- get_opportunities_list - List all opportunities

**Example queries you can handle:**
- "What are the tourism trends for Tel Aviv summer 2025?"
- "How does our pricing compare to market benchmarks?"
- "Are there any major events in Jerusalem next month that could affect demand?"
- "What's the expected occupancy rate for Eilat during Passover?"
- "Show me competitive analysis for 5-star hotels in Tel Aviv"
- "Book me a hotel in Tel Aviv for next week" (NEW - Full booking support!)
- "Show me my active bookings" (NEW)
- "Cancel booking ID 12345" (NEW)

Use the available functions to provide comprehensive, data-backed answers.`,
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
