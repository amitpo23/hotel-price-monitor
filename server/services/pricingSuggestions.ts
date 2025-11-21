import * as db from "../db";

/**
 * Pricing Suggestions Service
 * 
 * Automatically generates pricing adjustment recommendations based on competitor actions
 */

export interface PricingSuggestion {
  date: string;
  currentPrice: number;
  suggestedPrice: number;
  change: number;
  changePercent: number;
  reason: string;
  confidence: number; // 0-100
  expectedImpact: {
    occupancyChange: number; // Percentage points
    revenueChange: number; // Percentage
  };
  competitorContext: {
    avgCompetitorPrice: number;
    minCompetitorPrice: number;
    maxCompetitorPrice: number;
    yourRank: number;
    totalCompetitors: number;
  };
}

/**
 * Generate pricing suggestions based on competitor intelligence
 */
export async function generatePricingSuggestions(
  hotelId: number,
  startDate: string,
  endDate: string,
  roomType: "room_only" | "with_breakfast",
  strategy: "aggressive" | "balanced" | "conservative" = "balanced"
): Promise<PricingSuggestion[]> {
  const suggestions: PricingSuggestion[] = [];

  // Get our prices
  const ourPrices = await db.getHotelPricesForDateRange(hotelId, startDate, endDate, roomType);

  // Get competitor prices
  const competitorPrices = await db.getCompetitorAveragePrices(
    hotelId,
    startDate,
    endDate,
    roomType
  );

  // Get scan results for min/max
  const scanConfigs = await db.getScanConfigsByHotel(hotelId);
  if (!scanConfigs || scanConfigs.length === 0) return [];

  const latestScan = await db.getLatestScanForConfig(scanConfigs[0].id);
  if (!latestScan) return [];

  const scanResults = await db.getScanResults(latestScan.id);

  // Process each date
  for (const ourPrice of ourPrices) {
    const date = ourPrice.checkInDate;
    const currentPrice = ourPrice.price;

    // Find competitor data for this date
    const compPrice = competitorPrices.find((p: any) => p.checkInDate === date);
    if (!compPrice || !compPrice.avgPrice) continue;

    const dateResults = scanResults.filter(
      (r: any) => r.checkInDate === date && r.roomType === roomType && r.price
    );

    if (dateResults.length === 0) continue;

    const minCompPrice = Math.min(...dateResults.map((r: any) => r.price));
    const maxCompPrice = Math.max(...dateResults.map((r: any) => r.price));
    const avgCompPrice = compPrice.avgPrice;

    // Calculate rank
    const allPrices = [...dateResults.map((r: any) => r.price), currentPrice];
    allPrices.sort((a, b) => a - b);
    const rank = allPrices.indexOf(currentPrice) + 1;
    const totalCompetitors = allPrices.length;

    // Determine if we need to adjust
    const priceGap = ((currentPrice - avgCompPrice) / avgCompPrice) * 100;

    let suggestedPrice = currentPrice;
    let reason = "";
    let confidence = 0;
    let occupancyChange = 0;
    let revenueChange = 0;

    // Strategy: Aggressive - aim to be cheapest or close to it
    if (strategy === "aggressive") {
      if (currentPrice > minCompPrice) {
        // We're more expensive than the cheapest
        suggestedPrice = Math.round(minCompPrice * 0.98); // 2% below cheapest
        reason = "תחרותי: המחיר שלך גבוה מהמתחרה הזול ביותר. הורדה תגדיל תפוסה.";
        confidence = 85;
        occupancyChange = 15; // Expect 15% more occupancy
        revenueChange = 8; // Net 8% more revenue
      } else if (priceGap < -10) {
        // We're too cheap
        suggestedPrice = Math.round(minCompPrice * 1.02); // 2% above cheapest
        reason = "מחיר נמוך מדי: אתה זול ב-${Math.abs(priceGap).toFixed(1)}%. העלאה תגדיל רווח.";
        confidence = 75;
        occupancyChange = -5;
        revenueChange = 12;
      }
    }

    // Strategy: Balanced - stay close to average
    else if (strategy === "balanced") {
      if (priceGap > 10) {
        // We're significantly more expensive
        suggestedPrice = Math.round(avgCompPrice * 1.03); // 3% above average
        reason = `יקר מדי: אתה יקר ב-${priceGap.toFixed(1)}% מהממוצע. הורדה תשפר תחרותיות.`;
        confidence = 80;
        occupancyChange = 10;
        revenueChange = 5;
      } else if (priceGap < -10) {
        // We're significantly cheaper
        suggestedPrice = Math.round(avgCompPrice * 0.97); // 3% below average
        reason = `זול מדי: אתה זול ב-${Math.abs(priceGap).toFixed(1)}% מהממוצע. העלאה תגדיל רווח.`;
        confidence = 75;
        occupancyChange = -3;
        revenueChange = 8;
      } else if (rank > totalCompetitors / 2) {
        // We're in bottom half
        suggestedPrice = Math.round(avgCompPrice * 0.95); // 5% below average
        reason = `מיקום חלש: אתה במקום ${rank} מתוך ${totalCompetitors}. הורדה תשפר מיקום.`;
        confidence = 70;
        occupancyChange = 8;
        revenueChange = 4;
      }
    }

    // Strategy: Conservative - maintain premium position
    else if (strategy === "conservative") {
      if (priceGap > 20) {
        // We're way too expensive
        suggestedPrice = Math.round(avgCompPrice * 1.15); // 15% above average
        reason = `פער גדול מדי: אתה יקר ב-${priceGap.toFixed(1)}%. הורדה מתונה מומלצת.`;
        confidence = 70;
        occupancyChange = 5;
        revenueChange = 3;
      } else if (priceGap < 5 && priceGap > -5) {
        // We're too close to average - should be premium
        suggestedPrice = Math.round(avgCompPrice * 1.12); // 12% above average
        reason = "מיקום פרימיום: שמור על פער מחיר שמשקף ערך מוסף.";
        confidence = 65;
        occupancyChange = -2;
        revenueChange = 6;
      }
    }

    // Only add suggestion if there's a meaningful change
    const change = suggestedPrice - currentPrice;
    const changePercent = (change / currentPrice) * 100;

    if (Math.abs(changePercent) >= 2) {
      // At least 2% change
      suggestions.push({
        date,
        currentPrice,
        suggestedPrice,
        change,
        changePercent,
        reason,
        confidence,
        expectedImpact: {
          occupancyChange,
          revenueChange,
        },
        competitorContext: {
          avgCompetitorPrice: avgCompPrice,
          minCompetitorPrice: minCompPrice,
          maxCompetitorPrice: maxCompPrice,
          yourRank: rank,
          totalCompetitors,
        },
      });
    }
  }

  // Sort by expected revenue impact (descending)
  suggestions.sort((a, b) => b.expectedImpact.revenueChange - a.expectedImpact.revenueChange);

  return suggestions;
}

/**
 * Apply pricing suggestions
 */
export async function applyPricingSuggestions(
  hotelId: number,
  suggestions: Array<{ date: string; price: number }>,
  roomType: "room_only" | "with_breakfast",
  userId: number
): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;

  for (const suggestion of suggestions) {
    try {
      // Get current price
      const currentPrice = await db.getHotelPrice(hotelId, suggestion.date, roomType);

      // Update price
      await db.upsertHotelPrice({
        hotelId,
        checkInDate: suggestion.date,
        roomType,
        price: suggestion.price,
        pricingStrategy: "competitor_based",
        setBy: userId,
      });

      // Record history
      if (currentPrice) {
        await db.createPriceHistory({
          hotelId,
          checkInDate: suggestion.date,
          roomType,
          oldPrice: currentPrice.price,
          newPrice: suggestion.price,
          changeAmount: suggestion.price - currentPrice.price,
          changePercent: Math.round(
            ((suggestion.price - currentPrice.price) / currentPrice.price) * 10000
          ),
          changeReason: "competitor_suggestion",
          changedBy: userId,
        });
      }

      applied++;
    } catch (error) {
      console.error(`Failed to apply suggestion for ${suggestion.date}:`, error);
      failed++;
    }
  }

  return { applied, failed };
}

/**
 * Track suggestion acceptance rate
 */
export async function trackSuggestionAcceptance(
  hotelId: number,
  suggestionId: string,
  accepted: boolean
): Promise<void> {
  // In a real system, you'd store suggestions in DB with IDs
  // and track acceptance rates for ML improvement
  console.log(`Suggestion ${suggestionId} for hotel ${hotelId}: ${accepted ? "accepted" : "rejected"}`);
}
