import { chromium, Browser, Page } from "playwright";

interface ScrapeResult {
  checkInDate: string;
  roomType: "room_only" | "with_breakfast";
  price: number | null; // Price in cents (ILS)
  isAvailable: boolean;
}

interface ScrapeOptions {
  hotelUrl: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomType: "room_only" | "with_breakfast";
}

/**
 * Extract hotel ID from Booking.com URL
 * Example: https://www.booking.com/hotel/il/scarlet-hotel.html -> scarlet-hotel
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
 * Scrape price for a specific hotel and date
 */
export async function scrapeHotelPrice(options: ScrapeOptions): Promise<ScrapeResult> {
  const { hotelUrl, checkInDate, checkOutDate, roomType } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser in headless mode
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    // Set viewport and user agent to avoid detection
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Build search URL with dates
    const hotelId = extractHotelId(hotelUrl);
    const checkin = formatDate(checkInDate);
    const checkout = formatDate(checkOutDate);
    
    const searchUrl = `https://www.booking.com/hotel/il/${hotelId}.html?checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1`;

    console.log(`[Scraper] Navigating to: ${searchUrl}`);

    // Navigate to hotel page with dates
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);

    // Try to find price elements
    // Note: Booking.com structure changes frequently, these selectors may need updates
    const priceSelectors = [
      '[data-testid="price-and-discounted-price"]',
      '.prco-valign-middle-helper',
      '.bui-price-display__value',
      '.prco-inline-block-maker-helper',
    ];

    let priceText: string | null = null;
    let isAvailable = false;

    for (const selector of priceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          priceText = await element.textContent();
          if (priceText && priceText.trim()) {
            isAvailable = true;
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Check for "sold out" or "not available" messages
    const unavailableSelectors = [
      'text=/sold out/i',
      'text=/not available/i',
      'text=/no availability/i',
    ];

    for (const selector of unavailableSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          isAvailable = false;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    // Parse price if available
    let priceInCents: number | null = null;

    if (isAvailable && priceText) {
      // Extract numeric value from price text
      // Example formats: "₪ 1,234", "ILS 1234", "1,234"
      const numericMatch = priceText.match(/[\d,]+/);
      if (numericMatch) {
        const priceValue = parseFloat(numericMatch[0].replace(/,/g, ""));
        if (!isNaN(priceValue)) {
          priceInCents = Math.round(priceValue * 100); // Convert to cents
        }
      }
    }

    console.log(`[Scraper] Result: Available=${isAvailable}, Price=${priceInCents ? priceInCents / 100 : "N/A"} ILS`);

    return {
      checkInDate: formatDate(checkInDate),
      roomType,
      price: priceInCents,
      isAvailable,
    };
  } catch (error) {
    console.error(`[Scraper] Error scraping ${hotelUrl}:`, error);
    
    // Return unavailable result on error
    return {
      checkInDate: formatDate(checkInDate),
      roomType,
      price: null,
      isAvailable: false,
    };
  } finally {
    // Clean up
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

/**
 * Scrape prices for multiple dates
 */
export async function scrapeHotelPrices(
  hotelUrl: string,
  startDate: Date,
  daysForward: number,
  roomTypes: ("room_only" | "with_breakfast")[]
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  console.log(`[Scraper] Starting scan for ${hotelUrl} - ${daysForward} days, ${roomTypes.length} room types`);

  for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
    const checkInDate = new Date(startDate);
    checkInDate.setDate(checkInDate.getDate() + dayOffset);

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1); // 1 night stay

    for (const roomType of roomTypes) {
      try {
        const result = await scrapeHotelPrice({
          hotelUrl,
          checkInDate,
          checkOutDate,
          roomType,
        });

        results.push(result);

        // Add delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[Scraper] Failed to scrape ${hotelUrl} for ${checkInDate}:`, error);
        
        // Add failed result
        results.push({
          checkInDate: formatDate(checkInDate),
          roomType,
          price: null,
          isAvailable: false,
        });
      }
    }
  }

  console.log(`[Scraper] Completed scan: ${results.length} results`);
  return results;
}
