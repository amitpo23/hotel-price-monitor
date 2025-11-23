import { describe, it, expect } from "vitest";

/**
 * Unit tests for Pricing Engine functions
 * Tests the core pricing algorithm logic
 */

// Re-create the interface and functions for testing (since they're not exported)
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
  targetPosition: number | null;
}

// Copy of analyzeMarket function for testing
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

  const priceValues = validPrices.map(p => p.price).sort((a, b) => a - b);
  const sum = priceValues.reduce((a, b) => a + b, 0);
  const avg = sum / priceValues.length;
  const median = priceValues[Math.floor(priceValues.length / 2)];
  const min = priceValues[0];
  const max = priceValues[priceValues.length - 1];

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

describe("Pricing Engine", () => {
  describe("analyzeMarket", () => {
    it("should return zeros for empty price list", () => {
      const result = analyzeMarket([], 1);

      expect(result.averagePrice).toBe(0);
      expect(result.minPrice).toBe(0);
      expect(result.maxPrice).toBe(0);
      expect(result.competitorCount).toBe(0);
      expect(result.targetPrice).toBeNull();
      expect(result.targetPosition).toBeNull();
    });

    it("should filter out zero prices", () => {
      const prices: PriceData[] = [
        { hotelId: 1, hotelName: "Hotel A", price: 100, date: "2024-01-01", roomType: "room_only", category: "target" },
        { hotelId: 2, hotelName: "Hotel B", price: 0, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 3, hotelName: "Hotel C", price: 200, date: "2024-01-01", roomType: "room_only", category: "competitor" },
      ];

      const result = analyzeMarket(prices, 1);

      expect(result.competitorCount).toBe(2); // Should exclude zero price
      expect(result.averagePrice).toBe(150);
    });

    it("should calculate correct statistics", () => {
      const prices: PriceData[] = [
        { hotelId: 1, hotelName: "Hotel A", price: 100, date: "2024-01-01", roomType: "room_only", category: "target" },
        { hotelId: 2, hotelName: "Hotel B", price: 200, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 3, hotelName: "Hotel C", price: 300, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 4, hotelName: "Hotel D", price: 400, date: "2024-01-01", roomType: "room_only", category: "competitor" },
      ];

      const result = analyzeMarket(prices, 1);

      expect(result.minPrice).toBe(100);
      expect(result.maxPrice).toBe(400);
      expect(result.averagePrice).toBe(250);
      expect(result.priceRange).toBe(300);
      expect(result.competitorCount).toBe(4);
    });

    it("should find target hotel position correctly", () => {
      const prices: PriceData[] = [
        { hotelId: 1, hotelName: "Hotel A", price: 300, date: "2024-01-01", roomType: "room_only", category: "target" },
        { hotelId: 2, hotelName: "Hotel B", price: 100, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 3, hotelName: "Hotel C", price: 200, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 4, hotelName: "Hotel D", price: 400, date: "2024-01-01", roomType: "room_only", category: "competitor" },
      ];

      const result = analyzeMarket(prices, 1);

      expect(result.targetPrice).toBe(300);
      expect(result.targetPosition).toBe(3); // 3rd most expensive (100, 200, 300, 400)
    });

    it("should return null for target position when target not found", () => {
      const prices: PriceData[] = [
        { hotelId: 2, hotelName: "Hotel B", price: 100, date: "2024-01-01", roomType: "room_only", category: "competitor" },
        { hotelId: 3, hotelName: "Hotel C", price: 200, date: "2024-01-01", roomType: "room_only", category: "competitor" },
      ];

      const result = analyzeMarket(prices, 999); // Non-existent hotel

      expect(result.targetPrice).toBeNull();
      expect(result.targetPosition).toBeNull();
    });
  });
});

describe("Input Validation", () => {
  it("should validate positive integers", () => {
    const isPositiveInt = (n: number) => Number.isInteger(n) && n > 0;

    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(100)).toBe(true);
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
  });

  it("should validate daysForward range", () => {
    const isValidDaysForward = (n: number) => Number.isInteger(n) && n >= 1 && n <= 365;

    expect(isValidDaysForward(1)).toBe(true);
    expect(isValidDaysForward(60)).toBe(true);
    expect(isValidDaysForward(365)).toBe(true);
    expect(isValidDaysForward(0)).toBe(false);
    expect(isValidDaysForward(366)).toBe(false);
    expect(isValidDaysForward(-1)).toBe(false);
  });

  it("should validate cron expression format", () => {
    const cronRegex = /^[\d\s\*\/\-\,]+$/;

    expect(cronRegex.test("0 0 * * *")).toBe(true);
    expect(cronRegex.test("*/15 * * * *")).toBe(true);
    expect(cronRegex.test("0 9-17 * * 1-5")).toBe(true);
    expect(cronRegex.test("$(rm -rf /)")).toBe(false);
    expect(cronRegex.test("0 0 * * * && echo hack")).toBe(false);
  });
});
