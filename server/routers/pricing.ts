import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getAllHotels,
  getLatestScanResultsForConfig,
  getScanConfigs,
  createPriceRecommendation,
  getPriceRecommendations,
  createPricingAlert,
  getPricingAlerts,
  markAlertAsRead,
  deleteAlert,
} from "../db";

/**
 * Pricing Engine Algorithm
 * 
 * This algorithm calculates optimal pricing recommendations based on:
 * 1. Competitor prices (market positioning)
 * 2. Price distribution analysis
 * 3. Historical trends
 * 4. Day of week patterns
 * 5. Seasonality
 */

interface PriceData {
  hotelId: number;
  hotelName: string;
  price: number;
  date: string;
  roomType: string;
  category: string;
}

interface MarketAnalysis {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  priceRange: number;
  competitorCount: number;
  targetPrice: number | null;
  targetPosition: number | null; // 1 = cheapest, N = most expensive
}

interface PricingRecommendation {
  hotelId: number;
  hotelName: string;
  date: string;
  roomType: string;
  currentPrice: number | null;
  recommendedPrice: number;
  confidence: number; // 0-100
  reasoning: string[];
  marketPosition: string;
  expectedRevenue: number;
  competitorAvgPrice: number;
  priceChange: number; // percentage
  strategy: string;
}

/**
 * Calculate market statistics for a specific date and room type
 */
function analyzeMarket(prices: PriceData[], targetHotelId: number): MarketAnalysis {
  const validPrices = prices.filter(p => p.price > 0);
  
  if (validPrices.length === 0) {
    return {
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      medianPrice: 0,
      priceRange: 0,
      competitorCount: 0,
      targetPrice: null,
      targetPosition: null,
    };
  }

  // Calculate statistics
  const priceValues = validPrices.map(p => p.price).sort((a, b) => a - b);
  const sum = priceValues.reduce((a, b) => a + b, 0);
  const avg = sum / priceValues.length;
  const median = priceValues[Math.floor(priceValues.length / 2)];
  const min = priceValues[0];
  const max = priceValues[priceValues.length - 1];

  // Find target hotel position
  const targetPrice = validPrices.find(p => p.hotelId === targetHotelId)?.price || null;
  let targetPosition = null;
  
  if (targetPrice) {
    targetPosition = priceValues.filter(p => p < targetPrice).length + 1;
  }

  return {
    averagePrice: Math.round(avg),
    minPrice: min,
    maxPrice: max,
    medianPrice: Math.round(median),
    priceRange: max - min,
    competitorCount: validPrices.length,
    targetPrice,
    targetPosition,
  };
}

/**
 * Generate pricing recommendation based on market analysis
 */
function generateRecommendation(
  market: MarketAnalysis,
  targetHotel: { id: number; name: string; category: string },
  date: string,
  roomType: string
): PricingRecommendation {
  const reasoning: string[] = [];
  let recommendedPrice: number;
  let confidence = 70; // Base confidence
  let strategy = "competitive";
  let marketPosition = "competitive";

  // Strategy 1: If no current price, recommend market average
  if (!market.targetPrice) {
    recommendedPrice = market.averagePrice;
    reasoning.push("אין מחיר נוכחי - ממליץ על ממוצע השוק");
    confidence = 60;
    strategy = "market_entry";
  }
  // Strategy 2: Target hotel (your hotel) - aim for competitive but profitable pricing
  else if (targetHotel.category === "target") {
    const currentPrice = market.targetPrice;
    
    // Check market position
    if (market.targetPosition && market.competitorCount > 1) {
      const positionPercentile = (market.targetPosition / market.competitorCount) * 100;
      
      if (positionPercentile <= 33) {
        // You're in the cheapest third - can increase price
        recommendedPrice = Math.round(market.averagePrice * 0.95); // 5% below average
        reasoning.push("אתה מתומחר נמוך מהשוק - אפשר להעלות מחיר");
        reasoning.push(`מיקום נוכחי: ${market.targetPosition} מתוך ${market.competitorCount}`);
        strategy = "price_increase";
        marketPosition = "below_market";
        confidence = 85;
      } else if (positionPercentile >= 67) {
        // You're in the most expensive third - might want to decrease
        recommendedPrice = Math.round(market.averagePrice * 1.05); // 5% above average
        reasoning.push("אתה יקר מהשוק - שקול להוריד מעט");
        reasoning.push(`מיקום נוכחי: ${market.targetPosition} מתוך ${market.competitorCount}`);
        strategy = "price_decrease";
        marketPosition = "premium";
        confidence = 80;
      } else {
        // You're in the middle - maintain competitive position
        recommendedPrice = Math.round(market.medianPrice);
        reasoning.push("מיקום תחרותי טוב - שמור על המחיר");
        strategy = "maintain";
        marketPosition = "competitive";
        confidence = 90;
      }
    } else {
      // Not enough data - use market average
      recommendedPrice = market.averagePrice;
      reasoning.push("נתונים מוגבלים - ממליץ על ממוצע השוק");
      confidence = 65;
    }

    // Additional adjustments based on day of week
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
    
    if (isWeekend) {
      recommendedPrice = Math.round(recommendedPrice * 1.15); // 15% premium for weekends
      reasoning.push("סוף שבוע - תוספת של 15%");
      confidence += 5;
    }

    // Price gap analysis
    const priceGap = market.averagePrice - currentPrice;
    const gapPercentage = Math.abs((priceGap / currentPrice) * 100);
    
    if (gapPercentage > 15) {
      reasoning.push(`פער מחיר משמעותי: ${gapPercentage.toFixed(0)}% מהממוצע`);
    }
  }
  // Strategy 3: Competitor analysis - identify opportunities
  else {
    recommendedPrice = market.targetPrice || market.averagePrice;
    reasoning.push("מתחרה - ניטור בלבד");
    confidence = 50;
  }

  // Calculate expected revenue (simplified)
  // Assumption: Higher prices mean lower occupancy, but higher revenue per room
  const baseOccupancy = 0.75; // 75% base occupancy
  const priceElasticity = 0.3; // 30% elasticity
  
  const priceChangeRatio = recommendedPrice / (market.targetPrice || market.averagePrice);
  const occupancyAdjustment = 1 - ((priceChangeRatio - 1) * priceElasticity);
  const expectedOccupancy = Math.max(0.3, Math.min(1, baseOccupancy * occupancyAdjustment));
  const expectedRevenue = Math.round(recommendedPrice * expectedOccupancy);

  reasoning.push(`תפוסה צפויה: ${Math.round(expectedOccupancy * 100)}%`);
  reasoning.push(`הכנסה צפויה לחדר: ₪${expectedRevenue}`);

  // Calculate price change percentage
  const priceChange = market.targetPrice 
    ? Math.round(((recommendedPrice - market.targetPrice) / market.targetPrice) * 100)
    : 0;

  return {
    hotelId: targetHotel.id,
    hotelName: targetHotel.name,
    date,
    roomType,
    currentPrice: market.targetPrice,
    recommendedPrice,
    confidence,
    reasoning,
    marketPosition,
    expectedRevenue,
    competitorAvgPrice: market.averagePrice,
    priceChange,
    strategy,
  };
}

/**
 * Detect significant market changes and create alerts
 */
async function detectMarketChanges(
  currentData: PriceData[],
  previousData: PriceData[],
  userId: number
): Promise<void> {
  // Group by hotel and compare
  const currentByHotel = currentData.reduce((acc, p) => {
    if (!acc[p.hotelId]) acc[p.hotelId] = [];
    acc[p.hotelId].push(p);
    return acc;
  }, {} as Record<number, PriceData[]>);

  const previousByHotel = previousData.reduce((acc, p) => {
    if (!acc[p.hotelId]) acc[p.hotelId] = [];
    acc[p.hotelId].push(p);
    return acc;
  }, {} as Record<number, PriceData[]>);

  for (const [hotelId, currentPrices] of Object.entries(currentByHotel)) {
    const prevPrices = previousByHotel[hotelId] || [];
    
    if (prevPrices.length === 0) continue;

    const avgCurrent = currentPrices.reduce((sum, p) => sum + p.price, 0) / currentPrices.length;
    const avgPrevious = prevPrices.reduce((sum, p) => sum + p.price, 0) / prevPrices.length;
    
    const change = ((avgCurrent - avgPrevious) / avgPrevious) * 100;

    // Alert on significant changes (>10%)
    if (Math.abs(change) > 10) {
      const alertType = change > 0 ? "price_increase" : "price_drop";
      const severity = Math.abs(change) > 20 ? "high" : "medium";
      
      await createPricingAlert({
        userId,
        alertType,
        severity,
        title: `${currentPrices[0].hotelName}: שינוי מחיר של ${change.toFixed(0)}%`,
        message: `המחיר הממוצע של ${currentPrices[0].hotelName} ${change > 0 ? 'עלה' : 'ירד'} ב-${Math.abs(change).toFixed(0)}% (מ-₪${Math.round(avgPrevious)} ל-₪${Math.round(avgCurrent)})`,
        metadata: JSON.stringify({
          hotelId: parseInt(hotelId),
          previousPrice: Math.round(avgPrevious),
          currentPrice: Math.round(avgCurrent),
          changePercent: change,
        }),
      });
    }
  }
}

export const pricingRouter = router({
  // Get pricing recommendations for target hotel
  getRecommendations: publicProcedure
    .input(
      z.object({
        scanConfigId: z.number(),
        roomType: z.enum(["room_only", "with_breakfast"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      const hotels = await getAllHotels();
      const results = await getLatestScanResultsForConfig(input.scanConfigId);

      if (results.length === 0) {
        return { recommendations: [], summary: null };
      }

      // Find target hotel
      const targetHotel = hotels.find(h => h.category === "target");
      if (!targetHotel) {
        throw new Error("No target hotel configured");
      }

      // Group results by date and room type
      const groupedResults = results.reduce((acc, r) => {
        const key = `${r.result.checkInDate}-${r.result.roomType}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push({
          hotelId: r.hotel.id,
          hotelName: r.hotel.name,
          price: r.result.price || 0,
          date: r.result.checkInDate,
          roomType: r.result.roomType,
          category: r.hotel.category,
        });
        return acc;
      }, {} as Record<string, PriceData[]>);

      // Generate recommendations for each date/roomType combination
      const recommendations: PricingRecommendation[] = [];

      for (const [key, prices] of Object.entries(groupedResults)) {
        const [date, roomType] = key.split("-");
        
        // Filter by room type if specified
        if (input.roomType && roomType !== input.roomType) continue;

        const market = analyzeMarket(prices, targetHotel.id);
        const recommendation = generateRecommendation(
          market,
          targetHotel,
          date,
          roomType
        );

        recommendations.push(recommendation);

        // Save recommendation to database
        await createPriceRecommendation({
          hotelId: targetHotel.id,
          checkInDate: date,
          roomType: roomType as any,
          currentPrice: recommendation.currentPrice,
          recommendedPrice: recommendation.recommendedPrice,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning.join(" | "),
          marketPosition: recommendation.marketPosition,
          expectedRevenue: recommendation.expectedRevenue,
          competitorAvgPrice: recommendation.competitorAvgPrice,
        });
      }

      // Calculate summary statistics
      const summary = {
        totalRecommendations: recommendations.length,
        averageConfidence: Math.round(
          recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
        ),
        priceIncreaseOpportunities: recommendations.filter(r => r.priceChange > 0).length,
        priceDecreaseWarnings: recommendations.filter(r => r.priceChange < 0).length,
        potentialRevenueIncrease: recommendations.reduce((sum, r) => {
          if (r.currentPrice && r.priceChange > 0) {
            return sum + (r.recommendedPrice - r.currentPrice);
          }
          return sum;
        }, 0),
      };

      return {
        recommendations: recommendations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        summary,
      };
    }),

  // Get market analysis and competitor comparison
  getMarketAnalysis: publicProcedure
    .input(
      z.object({
        scanConfigId: z.number(),
        date: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      const hotels = await getAllHotels();
      const results = await getLatestScanResultsForConfig(input.scanConfigId);

      // Find target hotel
      const targetHotel = hotels.find(h => h.category === "target");
      if (!targetHotel) {
        throw new Error("No target hotel configured");
      }

      // Filter by date if specified
      let filteredResults = results;
      if (input.date) {
        filteredResults = results.filter(r => r.result.checkInDate === input.date);
      }

      // Group by hotel
      const byHotel = filteredResults.reduce((acc, r) => {
        if (!acc[r.hotel.id]) {
          acc[r.hotel.id] = {
            hotelId: r.hotel.id,
            hotelName: r.hotel.name,
            category: r.hotel.category,
            prices: [],
            avgPrice: 0,
          };
        }
        if (r.result.price) {
          acc[r.hotel.id].prices.push(r.result.price);
        }
        return acc;
      }, {} as Record<number, any>);

      // Calculate averages
      const hotelAnalysis = Object.values(byHotel).map((h: any) => {
        const avg = h.prices.length > 0
          ? Math.round(h.prices.reduce((a: number, b: number) => a + b, 0) / h.prices.length)
          : 0;
        return { ...h, avgPrice: avg };
      });

      // Sort by price
      hotelAnalysis.sort((a, b) => a.avgPrice - b.avgPrice);

      // Calculate market statistics
      const validPrices = hotelAnalysis.filter(h => h.avgPrice > 0);
      const marketAvg = validPrices.length > 0
        ? Math.round(validPrices.reduce((sum, h) => sum + h.avgPrice, 0) / validPrices.length)
        : 0;

      const targetAnalysis = hotelAnalysis.find(h => h.hotelId === targetHotel.id);
      const targetPosition = targetAnalysis 
        ? validPrices.findIndex(h => h.hotelId === targetHotel.id) + 1
        : null;

      return {
        hotelAnalysis,
        marketAverage: marketAvg,
        targetHotel: targetAnalysis,
        targetPosition,
        totalHotels: validPrices.length,
      };
    }),

  // Get pricing alerts
  getAlerts: publicProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getPricingAlerts(ctx.user.id, input.unreadOnly);
    }),

  // Mark alert as read
  markAlertRead: publicProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      await markAlertAsRead(input.alertId);
      return { success: true };
    }),

  // Delete alert
  deleteAlert: publicProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAlert(input.alertId);
      return { success: true };
    }),
});
