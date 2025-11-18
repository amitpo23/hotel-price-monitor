import { chromium, Browser, Page } from "playwright";

interface ScrapeResult {
  checkInDate: string;
  roomType: "room_only" | "with_breakfast";
  price: number | null; // Price in cents (ILS)
  isAvailable: boolean;
  roomDescription?: string; // Room type description from page
}

interface ScrapeOptions {
  hotelUrl: string;
  checkInDate: Date;
  checkOutDate: Date;
}

/**
 * Extract hotel ID from Booking.com URL
 */
function extractHotelId(url: string): string {
  const match = url.match(/\/hotel\/[a-z]{2}\/([^.]+)/);
  return match ? match[1] : "";
}

/**
 * Format date for Booking.com (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Detect if a room description includes breakfast
 */
function hasBreakfast(description: string): boolean {
  const breakfastKeywords = [
    "breakfast",
    "ארוחת בוקר",
    "morning meal",
    "continental breakfast",
    "buffet breakfast",
    "american breakfast",
    "includes breakfast",
    "with breakfast",
    "bed & breakfast",
    "b&b",
  ];

  const lowerDesc = description.toLowerCase();
  return breakfastKeywords.some((keyword) => lowerDesc.includes(keyword.toLowerCase()));
}

/**
 * Scrape all available room types for a specific hotel and date
 */
export async function scrapeHotelPricesV2(
  hotelUrl: string,
  checkInDate: Date,
  checkOutDate: Date
): Promise<ScrapeResult[]> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  const results: ScrapeResult[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    const hotelId = extractHotelId(hotelUrl);
    const checkin = formatDate(checkInDate);
    const checkout = formatDate(checkOutDate);
    
    const searchUrl = `https://www.booking.com/hotel/il/${hotelId}.html?checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1`;

    console.log(`[ScraperV2] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Try to find room type containers
    const roomSelectors = [
      '[data-testid="room-card"]',
      '.hprt-table-row',
      '.room-item',
      '[data-room-id]',
    ];

    let roomElements: any[] = [];
    for (const selector of roomSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements && elements.length > 0) {
          roomElements = elements;
          console.log(`[ScraperV2] Found ${elements.length} rooms using selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (roomElements.length === 0) {
      console.log("[ScraperV2] No room elements found, trying fallback price extraction");
      
      // Fallback: try to get at least one price
      const priceSelectors = [
        '[data-testid="price-and-discounted-price"]',
        '.prco-valign-middle-helper',
        '.bui-price-display__value',
      ];

      let priceText: string | null = null;
      for (const selector of priceSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            priceText = await element.textContent();
            if (priceText && priceText.trim()) {
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (priceText) {
        const numericMatch = priceText.match(/[\d,]+/);
        if (numericMatch) {
          const priceValue = parseFloat(numericMatch[0].replace(/,/g, ""));
          if (!isNaN(priceValue)) {
            results.push({
              checkInDate: formatDate(checkInDate),
              roomType: "room_only", // Default fallback
              price: Math.round(priceValue * 100),
              isAvailable: true,
              roomDescription: "Standard Room",
            });
          }
        }
      }
    } else {
      // Process each room type
      for (const roomElement of roomElements) {
        try {
          // Get room description
          const descriptionSelectors = [
            '[data-testid="room-name"]',
            '.hprt-roomtype-name',
            '.room-name',
            'h3',
          ];

          let roomDescription = "";
          for (const selector of descriptionSelectors) {
            try {
              const descElement = await roomElement.$(selector);
              if (descElement) {
                const text = await descElement.textContent();
                if (text && text.trim()) {
                  roomDescription = text.trim();
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }

          // Get price
          const priceSelectors = [
            '[data-testid="price-and-discounted-price"]',
            '.bui-price-display__value',
            '.prco-valign-middle-helper',
          ];

          let priceText: string | null = null;
          for (const selector of priceSelectors) {
            try {
              const priceElement = await roomElement.$(selector);
              if (priceElement) {
                priceText = await priceElement.textContent();
                if (priceText && priceText.trim()) {
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }

          if (priceText && roomDescription) {
            const numericMatch = priceText.match(/[\d,]+/);
            if (numericMatch) {
              const priceValue = parseFloat(numericMatch[0].replace(/,/g, ""));
              if (!isNaN(priceValue)) {
                const includesBreakfast = hasBreakfast(roomDescription);
                
                results.push({
                  checkInDate: formatDate(checkInDate),
                  roomType: includesBreakfast ? "with_breakfast" : "room_only",
                  price: Math.round(priceValue * 100),
                  isAvailable: true,
                  roomDescription,
                });

                console.log(`[ScraperV2] Found room: ${roomDescription} - ${priceValue} ILS - Breakfast: ${includesBreakfast}`);
              }
            }
          }
        } catch (error) {
          console.error("[ScraperV2] Error processing room element:", error);
          continue;
        }
      }
    }

    // If no results found, mark as unavailable
    if (results.length === 0) {
      results.push({
        checkInDate: formatDate(checkInDate),
        roomType: "room_only",
        price: null,
        isAvailable: false,
      });
    }

    console.log(`[ScraperV2] Completed: ${results.length} room types found`);
    return results;
  } catch (error) {
    console.error(`[ScraperV2] Error scraping ${hotelUrl}:`, error);
    
    return [{
      checkInDate: formatDate(checkInDate),
      roomType: "room_only",
      price: null,
      isAvailable: false,
    }];
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

/**
 * Scrape prices for multiple dates with automatic breakfast detection
 */
export async function scrapeHotelPricesMultiDate(
  hotelUrl: string,
  startDate: Date,
  daysForward: number
): Promise<ScrapeResult[]> {
  const allResults: ScrapeResult[] = [];

  console.log(`[ScraperV2] Starting multi-date scan for ${hotelUrl} - ${daysForward} days`);

  for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
    const checkInDate = new Date(startDate);
    checkInDate.setDate(checkInDate.getDate() + dayOffset);

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);

    try {
      const dayResults = await scrapeHotelPricesV2(hotelUrl, checkInDate, checkOutDate);
      allResults.push(...dayResults);

      // Delay between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[ScraperV2] Failed for date ${formatDate(checkInDate)}:`, error);
      
      allResults.push({
        checkInDate: formatDate(checkInDate),
        roomType: "room_only",
        price: null,
        isAvailable: false,
      });
    }
  }

  console.log(`[ScraperV2] Multi-date scan completed: ${allResults.length} total results`);
  return allResults;
}
