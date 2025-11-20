import { chromium } from 'playwright';

interface ScrapeResult {
  date: string;
  room_only: number | null;
  with_breakfast: number | null;
  room_type: string | null;
  available: boolean;
}

/**
 * Scrape hotel prices from Booking.com
 * @param hotelUrl - Full Booking.com hotel URL
 * @param checkInDate - Check-in date in YYYY-MM-DD format
 * @param nights - Number of nights (default: 1)
 * @param roomTypes - Array of room types to filter ['room_only', 'with_breakfast']
 * @returns Array of scrape results
 */
export async function scrapeBookingPrices(
  hotelUrl: string,
  checkInDate: string,
  nights: number = 1,
  roomTypes: string[] = ['room_only', 'with_breakfast']
): Promise<ScrapeResult[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Build URL with date parameters
    const url = new URL(hotelUrl);
    url.searchParams.set('checkin', checkInDate);
    
    // Calculate checkout date
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    const checkOutStr = checkOut.toISOString().split('T')[0];
    url.searchParams.set('checkout', checkOutStr);
    
    url.searchParams.set('group_adults', '2');
    url.searchParams.set('no_rooms', '1');
    url.searchParams.set('group_children', '0');

    console.log(`[Scraper] Navigating to: ${url.toString()}`);

    // Navigate to the page
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for room listings to load
    await page.waitForTimeout(5000);

    // Try to close any popups
    try {
      const closeButton = page.locator('button[aria-label="Dismiss sign-in info."], button[aria-label*="Close"]').first();
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await closeButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Ignore if no popup
    }

    // Find all room blocks using data-block-id attribute
    const roomBlocks = page.locator('[data-block-id]');
    const count = await roomBlocks.count();
    
    console.log(`[Scraper] Found ${count} room blocks`);

    const results: ScrapeResult[] = [];
    let foundRoomOnly = false;
    let foundWithBreakfast = false;

    for (let i = 0; i < count && (!foundRoomOnly || !foundWithBreakfast); i++) {
      const block = roomBlocks.nth(i);
      
      try {
        // Get room type name
        const roomNameEl = block.locator('.hprt-roomtype-link, a[data-room-name-link]').first();
        const roomName = await roomNameEl.textContent({ timeout: 2000 }).catch(() => null);

        // Get price - try multiple selectors
        const priceEl = block.locator('.prco-valign-middle-helper, [data-testid="price-and-discounted-price"], .bui-price-display__value').first();
        const priceText = await priceEl.textContent({ timeout: 2000 }).catch(() => null);

        if (!priceText) {
          console.log(`[Scraper] No price found for room ${i}`);
          continue;
        }

        // Extract numeric price (handles formats like "S$ 218", "₪ 355", "$218")
        const priceMatch = priceText.match(/[\d,]+/);
        if (!priceMatch) {
          console.log(`[Scraper] Could not parse price: ${priceText}`);
          continue;
        }

        const price = parseFloat(priceMatch[0].replace(/,/g, ''));

        // Check if breakfast is included by looking at the entire row text
        const rowText = await block.textContent();
        const hasBreakfast = rowText?.toLowerCase().includes('breakfast') || false;

        const roomType = hasBreakfast ? 'with_breakfast' : 'room_only';

        // Only add if this room type is requested and we haven't found it yet
        if (roomTypes.includes(roomType)) {
          if (roomType === 'room_only' && !foundRoomOnly) {
            results.push({
              date: checkInDate,
              room_only: price,
              with_breakfast: null,
              room_type: roomName || 'Standard Room',
              available: true
            });
            foundRoomOnly = true;
            console.log(`[Scraper] Found room_only: ${price} (${roomName})`);
          } else if (roomType === 'with_breakfast' && !foundWithBreakfast) {
            results.push({
              date: checkInDate,
              room_only: null,
              with_breakfast: price,
              room_type: roomName || 'Standard Room',
              available: true
            });
            foundWithBreakfast = true;
            console.log(`[Scraper] Found with_breakfast: ${price} (${roomName})`);
          }
        }
      } catch (err) {
        console.error(`[Scraper] Error processing room block ${i}:`, err);
      }
    }

    // If no results found, mark as unavailable
    if (results.length === 0) {
      console.log(`[Scraper] No rooms found, marking as unavailable`);
      results.push({
        date: checkInDate,
        room_only: null,
        with_breakfast: null,
        room_type: null,
        available: false
      });
    }

    await context.close();
    return results;

  } finally {
    await browser.close();
  }
}

// CLI interface for backward compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: pnpm exec tsx bookingScraper.ts <hotel_url> <check_in_date> <nights> [room_types]');
    process.exit(1);
  }

  const [hotelUrl, checkInDate, nightsStr, roomTypesStr] = args;
  const nights = parseInt(nightsStr, 10);
  const roomTypes = roomTypesStr ? JSON.parse(roomTypesStr) : ['room_only', 'with_breakfast'];

  scrapeBookingPrices(hotelUrl, checkInDate, nights, roomTypes)
    .then(results => {
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(err => {
      console.error('Scraping failed:', err);
      process.exit(1);
    });
}
