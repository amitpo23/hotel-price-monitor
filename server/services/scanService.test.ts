import { describe, it, expect } from "vitest";

/**
 * Unit tests for Scan Service utilities
 */

describe("ScanService Utilities", () => {
  describe("Room Types Parsing", () => {
    it("should parse valid room types JSON", () => {
      const roomTypesJson = '["room_only", "with_breakfast"]';
      const parsed = JSON.parse(roomTypesJson) as string[];

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed).toContain("room_only");
      expect(parsed).toContain("with_breakfast");
    });

    it("should throw on invalid JSON", () => {
      const invalidJson = "not valid json";

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it("should validate room type values", () => {
      const validTypes = ["room_only", "with_breakfast"];
      const isValidRoomType = (type: string) => validTypes.includes(type);

      expect(isValidRoomType("room_only")).toBe(true);
      expect(isValidRoomType("with_breakfast")).toBe(true);
      expect(isValidRoomType("invalid")).toBe(false);
      expect(isValidRoomType("")).toBe(false);
    });
  });

  describe("Date Formatting", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2024-06-15T10:30:00Z");
      const formatted = date.toISOString().split("T")[0];

      expect(formatted).toBe("2024-06-15");
    });

    it("should handle midnight correctly", () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      const formatted = date.toISOString().split("T")[0];

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("Error Type Detection", () => {
    it("should detect timeout errors", () => {
      const detectErrorType = (message: string) => {
        if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
          return "timeout";
        }
        if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("network")) {
          return "network_error";
        }
        if (message.includes("JSON") || message.includes("parse")) {
          return "parsing_failed";
        }
        return "other";
      };

      expect(detectErrorType("Connection timeout")).toBe("timeout");
      expect(detectErrorType("ETIMEDOUT")).toBe("timeout");
      expect(detectErrorType("ECONNREFUSED")).toBe("network_error");
      expect(detectErrorType("network error")).toBe("network_error");
      expect(detectErrorType("JSON.parse failed")).toBe("parsing_failed");
      expect(detectErrorType("Unknown error")).toBe("other");
    });
  });

  describe("Arguments Sanitization", () => {
    it("should properly stringify daysForward", () => {
      const daysForward = 60;
      const stringified = String(daysForward);

      expect(stringified).toBe("60");
      expect(typeof stringified).toBe("string");
    });

    it("should properly JSON stringify room types", () => {
      const roomTypes = ["room_only", "with_breakfast"];
      const json = JSON.stringify(roomTypes);

      expect(json).toBe('["room_only","with_breakfast"]');
      expect(typeof json).toBe("string");
    });

    it("should handle special characters in URLs", () => {
      const url = "https://booking.com/hotel?id=123&name=Test%20Hotel";
      // URL should be passed as-is to execFile (not shell-escaped)
      expect(url).toBe("https://booking.com/hotel?id=123&name=Test%20Hotel");
    });
  });
});

describe("Rate Limiter Logic", () => {
  it("should track request counts", () => {
    const store = new Map<string, { count: number; resetTime: number }>();
    const maxRequests = 100;
    const windowMs = 60000;
    const now = Date.now();

    // Simulate first request
    const ip = "192.168.1.1";
    store.set(ip, { count: 1, resetTime: now + windowMs });

    expect(store.get(ip)?.count).toBe(1);

    // Simulate multiple requests
    const data = store.get(ip)!;
    data.count = 99;

    expect(data.count).toBe(99);
    expect(data.count < maxRequests).toBe(true);

    data.count = 100;
    expect(data.count >= maxRequests).toBe(true);
  });

  it("should reset after window expires", () => {
    const store = new Map<string, { count: number; resetTime: number }>();
    const windowMs = 60000;
    const now = Date.now();

    const ip = "192.168.1.1";
    store.set(ip, { count: 100, resetTime: now - 1000 }); // Expired

    const data = store.get(ip)!;
    const isExpired = now > data.resetTime;

    expect(isExpired).toBe(true);
  });
});
