import * as db from "../db";

/**
 * Dynamic Pricing Engine
 * 
 * Automatically adjusts hotel prices based on:
 * - Demand (occupancy, booking velocity)
 * - Competitor prices
 * - Forecasts (predicted demand)
 * - Time-based rules (day of week, seasonality)
 * - Revenue optimization goals
 */

export interface PricingContext {
  hotelId: number;
  checkInDate: string;
  roomType: "room_only" | "with_breakfast";
  currentPrice: number | null;
  basePrice: number; // Base price to start from
}

export interface PricingFactors {
  demandFactor: number; // Multiplier based on demand (0.8 - 1.5)
  competitorFactor: number; // Multiplier based on competitors (0.9 - 1.2)
  timeFactor: number; // Multiplier based on time/seasonality (0.8 - 1.3)
  forecastFactor: number; // Multiplier based on forecast (0.9 - 1.4)
}

export interface PricingResult {
  recommendedPrice: number;
  factors: PricingFactors;
  appliedRules: string[];
  confidence: number; // 0-100
  reasoning: string;
}

/**
 * Main pricing engine function
 */
export async function calculateOptimalPrice(
  context: PricingContext
): Promise<PricingResult> {
  const { hotelId, checkInDate, roomType, currentPrice, basePrice } = context;

  // Get all active pricing rules for this hotel
  const rules = await db.getPricingRules(hotelId);

  // Calculate individual factors
  const demandFactor = await calculateDemandFactor(hotelId, checkInDate);
  const competitorFactor = await calculateCompetitorFactor(hotelId, checkInDate, roomType);
  const timeFactor = await calculateTimeFactor(checkInDate);
  const forecastFactor = await calculateForecastFactor(hotelId, checkInDate);

  const factors: PricingFactors = {
    demandFactor,
    competitorFactor,
    timeFactor,
    forecastFactor,
  };

  // Apply rules in priority order
  let price = basePrice;
  const appliedRules: string[] = [];
  let totalWeight = 0;

  for (const rule of rules) {
    const ruleResult = await applyPricingRule(rule, context, factors);
    if (ruleResult.applies) {
      price = ruleResult.adjustedPrice;
      appliedRules.push(rule.name);
      totalWeight += rule.priority;
    }
  }

  // If no rules applied, use factor-based pricing
  if (appliedRules.length === 0) {
    const combinedFactor =
      demandFactor * 0.4 +
      competitorFactor * 0.3 +
      forecastFactor * 0.2 +
      timeFactor * 0.1;

    price = Math.round(basePrice * combinedFactor);
    appliedRules.push("Default factor-based pricing");
  }

  // Apply min/max constraints
  const minPrice = basePrice * 0.7; // Never go below 70% of base
  const maxPrice = basePrice * 2.0; // Never go above 200% of base

  price = Math.max(minPrice, Math.min(maxPrice, price));

  // Calculate confidence based on data availability
  const confidence = calculateConfidence(factors, appliedRules.length);

  // Generate reasoning
  const reasoning = generateReasoning(factors, appliedRules, price, basePrice);

  return {
    recommendedPrice: price,
    factors,
    appliedRules,
    confidence,
    reasoning,
  };
}

/**
 * Calculate demand factor based on current occupancy and booking velocity
 */
async function calculateDemandFactor(
  hotelId: number,
  checkInDate: string
): Promise<number> {
  // Get occupancy data for the date
  const occupancyData = await db.getOccupancyData(
    hotelId,
    checkInDate,
    checkInDate
  );

  if (!occupancyData || occupancyData.length === 0) {
    // No data, assume moderate demand
    return 1.0;
  }

  const occupancy = occupancyData[0];
  const occupancyRate = occupancy.occupancyRate;

  // High occupancy = higher prices
  if (occupancyRate >= 90) return 1.5; // Very high demand
  if (occupancyRate >= 80) return 1.3;
  if (occupancyRate >= 70) return 1.15;
  if (occupancyRate >= 60) return 1.0;
  if (occupancyRate >= 50) return 0.95;
  if (occupancyRate >= 40) return 0.9;
  return 0.8; // Low demand

}

/**
 * Calculate competitor factor based on competitor prices
 */
async function calculateCompetitorFactor(
  hotelId: number,
  checkInDate: string,
  roomType: "room_only" | "with_breakfast"
): Promise<number> {
  // Get our current price
  const ourPrice = await db.getHotelPrice(hotelId, checkInDate, roomType);

  if (!ourPrice) {
    return 1.0; // No price set, neutral factor
  }

  // Get competitor average
  const competitorPrices = await db.getCompetitorAveragePrices(
    hotelId,
    checkInDate,
    checkInDate,
    roomType
  );

  if (!competitorPrices || competitorPrices.length === 0) {
    return 1.0; // No competitor data
  }

  const avgCompetitorPrice = competitorPrices[0].avgPrice;

  if (!avgCompetitorPrice) {
    return 1.0;
  }

  // Calculate price gap
  const priceGap = ((ourPrice.price - avgCompetitorPrice) / avgCompetitorPrice) * 100;

  // If we're significantly more expensive, suggest lowering
  if (priceGap > 20) return 0.9; // Lower price
  if (priceGap > 10) return 0.95;
  if (priceGap > 5) return 0.98;

  // If we're cheaper, we can raise prices
  if (priceGap < -20) return 1.2; // Raise price
  if (priceGap < -10) return 1.15;
  if (priceGap < -5) return 1.1;

  return 1.0; // Competitive pricing
}

/**
 * Calculate time factor based on day of week and seasonality
 */
async function calculateTimeFactor(checkInDate: string): Promise<number> {
  const date = new Date(checkInDate);
  const dayOfWeek = date.getDay();

  // Weekend pricing (Friday, Saturday)
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    return 1.3; // 30% premium for weekends
  }

  // Thursday (pre-weekend)
  if (dayOfWeek === 4) {
    return 1.15;
  }

  // Weekdays
  return 1.0;
}

/**
 * Calculate forecast factor based on predicted demand
 */
async function calculateForecastFactor(
  hotelId: number,
  checkInDate: string
): Promise<number> {
  const forecasts = await db.getDemandForecasts(hotelId, checkInDate, checkInDate);

  if (!forecasts || forecasts.length === 0) {
    return 1.0; // No forecast data
  }

  const forecast = forecasts[0];
  const predictedOccupancy = forecast.predictedOccupancy;

  // High predicted occupancy = higher prices
  if (predictedOccupancy >= 90) return 1.4;
  if (predictedOccupancy >= 80) return 1.25;
  if (predictedOccupancy >= 70) return 1.1;
  if (predictedOccupancy >= 60) return 1.0;
  if (predictedOccupancy >= 50) return 0.95;
  return 0.9;
}

/**
 * Apply a specific pricing rule
 */
async function applyPricingRule(
  rule: any,
  context: PricingContext,
  factors: PricingFactors
): Promise<{ applies: boolean; adjustedPrice: number }> {
  const { checkInDate, basePrice } = context;

  // Parse conditions
  const conditions = JSON.parse(rule.conditions);
  const actions = JSON.parse(rule.actions);

  // Check if rule applies
  let applies = true;

  // Check date range
  if (conditions.startDate && checkInDate < conditions.startDate) {
    applies = false;
  }
  if (conditions.endDate && checkInDate > conditions.endDate) {
    applies = false;
  }

  // Check day of week
  if (conditions.daysOfWeek) {
    const dayOfWeek = new Date(checkInDate).getDay();
    if (!conditions.daysOfWeek.includes(dayOfWeek)) {
      applies = false;
    }
  }

  // Check occupancy threshold
  if (conditions.minOccupancy && factors.demandFactor < conditions.minOccupancy / 100) {
    applies = false;
  }

  if (!applies) {
    return { applies: false, adjustedPrice: basePrice };
  }

  // Apply actions
  let adjustedPrice = basePrice;

  if (actions.priceAdjustment) {
    const adjustment = actions.priceAdjustment;

    if (adjustment.includes("%")) {
      // Percentage adjustment
      const percent = parseFloat(adjustment.replace("%", ""));
      adjustedPrice = Math.round(basePrice * (1 + percent / 100));
    } else if (adjustment.includes("+")) {
      // Absolute addition
      const amount = parseFloat(adjustment.replace("+", "")) * 100; // Convert to cents
      adjustedPrice = basePrice + amount;
    } else if (adjustment.includes("-")) {
      // Absolute subtraction
      const amount = parseFloat(adjustment.replace("-", "")) * 100;
      adjustedPrice = basePrice - amount;
    } else {
      // Fixed price
      adjustedPrice = parseFloat(adjustment) * 100;
    }
  }

  // Apply min/max from rule
  if (actions.minPrice) {
    adjustedPrice = Math.max(adjustedPrice, actions.minPrice * 100);
  }
  if (actions.maxPrice) {
    adjustedPrice = Math.min(adjustedPrice, actions.maxPrice * 100);
  }

  return { applies: true, adjustedPrice };
}

/**
 * Calculate confidence score
 */
function calculateConfidence(factors: PricingFactors, rulesApplied: number): number {
  let confidence = 50; // Base confidence

  // More rules applied = higher confidence
  confidence += rulesApplied * 10;

  // Having all factors = higher confidence
  if (factors.demandFactor !== 1.0) confidence += 10;
  if (factors.competitorFactor !== 1.0) confidence += 10;
  if (factors.forecastFactor !== 1.0) confidence += 10;
  if (factors.timeFactor !== 1.0) confidence += 5;

  return Math.min(100, confidence);
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  factors: PricingFactors,
  appliedRules: string[],
  recommendedPrice: number,
  basePrice: number
): string {
  const parts: string[] = [];

  const priceChange = ((recommendedPrice - basePrice) / basePrice) * 100;

  if (priceChange > 5) {
    parts.push(`מחיר מומלץ גבוה ב-${priceChange.toFixed(1)}% מהמחיר הבסיסי`);
  } else if (priceChange < -5) {
    parts.push(`מחיר מומלץ נמוך ב-${Math.abs(priceChange).toFixed(1)}% מהמחיר הבסיסי`);
  } else {
    parts.push("מחיר מומלץ קרוב למחיר הבסיסי");
  }

  // Demand
  if (factors.demandFactor > 1.2) {
    parts.push("ביקוש גבוה מאוד");
  } else if (factors.demandFactor > 1.0) {
    parts.push("ביקוש גבוה");
  } else if (factors.demandFactor < 0.9) {
    parts.push("ביקוש נמוך");
  }

  // Competitors
  if (factors.competitorFactor > 1.1) {
    parts.push("מחירנו נמוך מהמתחרים");
  } else if (factors.competitorFactor < 0.95) {
    parts.push("מחירנו גבוה מהמתחרים");
  }

  // Forecast
  if (factors.forecastFactor > 1.2) {
    parts.push("תחזית ביקוש גבוהה");
  } else if (factors.forecastFactor < 0.95) {
    parts.push("תחזית ביקוש נמוכה");
  }

  // Time
  if (factors.timeFactor > 1.2) {
    parts.push("סוף שבוע");
  }

  // Rules
  if (appliedRules.length > 0) {
    parts.push(`הוחלו ${appliedRules.length} כללי תמחור`);
  }

  return parts.join(" • ");
}

/**
 * Execute pricing engine for a hotel and date range
 */
export async function executePricingEngine(
  hotelId: number,
  startDate: string,
  endDate: string,
  roomType: "room_only" | "with_breakfast",
  autoApply: boolean = false,
  userId?: number
): Promise<{
  results: Array<{
    date: string;
    currentPrice: number | null;
    recommendedPrice: number;
    change: number;
    reasoning: string;
  }>;
  summary: {
    totalDays: number;
    changesRecommended: number;
    avgPriceChange: number;
  };
}> {
  const results = [];
  let totalChange = 0;
  let changesRecommended = 0;

  // Get base price (use average of existing prices or default)
  const existingPrices = await db.getHotelPricesForDateRange(
    hotelId,
    startDate,
    endDate,
    roomType
  );

  const basePrice =
    existingPrices.length > 0
      ? Math.round(
          existingPrices.reduce((sum: number, p: any) => sum + p.price, 0) /
            existingPrices.length
        )
      : 50000; // Default ₪500

  // Generate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }

  // Calculate optimal price for each date
  for (const date of dates) {
    const currentPriceData = await db.getHotelPrice(hotelId, date, roomType);
    const currentPrice = currentPriceData?.price || null;

    const context: PricingContext = {
      hotelId,
      checkInDate: date,
      roomType,
      currentPrice,
      basePrice: currentPrice || basePrice,
    };

    const pricingResult = await calculateOptimalPrice(context);

    const change = currentPrice
      ? ((pricingResult.recommendedPrice - currentPrice) / currentPrice) * 100
      : 0;

    results.push({
      date,
      currentPrice,
      recommendedPrice: pricingResult.recommendedPrice,
      change,
      reasoning: pricingResult.reasoning,
    });

    if (Math.abs(change) > 2) {
      // Significant change
      changesRecommended++;
      totalChange += Math.abs(change);
    }

    // Auto-apply if requested
    if (autoApply && Math.abs(change) > 2) {
      await db.upsertHotelPrice({
        hotelId,
        checkInDate: date,
        roomType,
        price: pricingResult.recommendedPrice,
        pricingStrategy: "dynamic",
        setBy: userId,
      });

      // Record history
      if (currentPrice) {
        await db.createPriceHistory({
          hotelId,
          checkInDate: date,
          roomType,
          oldPrice: currentPrice,
          newPrice: pricingResult.recommendedPrice,
          changeAmount: pricingResult.recommendedPrice - currentPrice,
          changePercent: Math.round(change * 100),
          changeReason: "dynamic_rule",
          changedBy: userId,
        });
      }
    }
  }

  return {
    results,
    summary: {
      totalDays: dates.length,
      changesRecommended,
      avgPriceChange: changesRecommended > 0 ? totalChange / changesRecommended : 0,
    },
  };
}
