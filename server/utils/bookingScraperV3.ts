import { chromium, Browser, Page } from 'playwright';

export interface ScrapedPrice {
  date: string;
  roomType: 'room_only' | 'with_breakfast';
  price: number | null;
  currency: string;
  available: boolean;
}

export class BookingScraperV3 {
  private browser: Browser | null = null;

  async initialize() {
    console.log('[ScraperV3] Initializing browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeHotelPrices(
    hotelUrl: string,
    startDate: Date,
    daysForward: number,
    roomTypes: ('room_only' | 'with_breakfast')[]
  ): Promise<ScrapedPrice[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const results: ScrapedPrice[] = [];
    const page = await this.browser.newPage();

    try {
      // Extract hotel ID from URL
      const hotelId = this.extractHotelId(hotelUrl);
      if (!hotelId) {
        throw new Error(`Could not extract hotel ID from URL: ${hotelUrl}`);
      }

      console.log(`[ScraperV3] Scraping hotel: ${hotelId}`);
      console.log(`[ScraperV3] Date range: ${startDate.toISOString().split('T')[0]} + ${daysForward} days`);

      // Iterate through each date
      for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
        const checkIn = new Date(startDate);
        checkIn.setDate(checkIn.getDate() + dayOffset);
        
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 1);

        const checkInStr = checkIn.toISOString().split('T')[0];
        const checkOutStr = checkOut.toISOString().split('T')[0];

        console.log(`[ScraperV3] Checking date: ${checkInStr}`);

        // Build URL with date parameters
        const url = `https://www.booking.com/hotel/il/${hotelId}.html?checkin=${checkInStr}&checkout=${checkOutStr}&group_adults=2&no_rooms=1`;

        try {
          // Navigate to the page
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Wait for room table to load
          await page.waitForSelector('table, [data-block-id], .hprt-table', { timeout: 10000 }).catch(() => {
            console.log('[ScraperV3] Room table not found, trying alternative selectors');
          });

          // Additional wait for dynamic content
          await page.waitForTimeout(2000);

          // Extract all prices from the page
          const priceData = await page.evaluate(() => {
            const rooms: Array<{
              name: string;
              price: string | null;
              hasBreakfast: boolean;
            }> = [];

            // Try multiple strategies to find room data
            
            // Strategy 1: Look for table rows with room data
            const tableRows = document.querySelectorAll('tr[data-block-id]');
            if (tableRows.length > 0) {
              tableRows.forEach(row => {
                const nameEl = row.querySelector('a[data-room-name-en]') || row.querySelector('.hprt-roomtype-link');
                const priceEl = row.querySelector('.bui-price-display__value') || row.querySelector('[data-bui-price]');
                const breakfastEl = row.textContent || '';
                
                const name = nameEl?.textContent?.trim() || '';
                const priceText = priceEl?.textContent?.trim() || null;
                const hasBreakfast = breakfastEl.toLowerCase().includes('breakfast included');

                if (name && priceText) {
                  rooms.push({ name, price: priceText, hasBreakfast });
                }
              });
            }

            // Strategy 2: Look for price display elements directly
            if (rooms.length === 0) {
              const priceElements = document.querySelectorAll('.bui-price-display__value, [class*="price"]');
              const breakfastElements = document.querySelectorAll('[class*="breakfast"], [data-breakfast]');
              
              priceElements.forEach((priceEl, idx) => {
                const priceText = priceEl.textContent?.trim() || null;
                const breakfastText = breakfastElements[idx]?.textContent || '';
                const hasBreakfast = breakfastText.toLowerCase().includes('included');
                
                if (priceText && priceText.match(/\d/)) {
                  rooms.push({
                    name: `Room ${idx + 1}`,
                    price: priceText,
                    hasBreakfast
                  });
                }
              });
            }

            // Strategy 3: Extract all text and find price patterns
            if (rooms.length === 0) {
              const bodyText = document.body.innerText;
              const priceMatches = bodyText.match(/S\$\s*\d+/g) || [];
              const uniquePrices = Array.from(new Set(priceMatches));
              
              uniquePrices.slice(0, 5).forEach((priceText, idx) => {
                rooms.push({
                  name: `Room ${idx + 1}`,
                  price: priceText,
                  hasBreakfast: false
                });
              });
            }

            return rooms;
          });

          console.log(`[ScraperV3] Found ${priceData.length} rooms for ${checkInStr}`);

          // Process each room found
          for (const room of priceData) {
            const price = this.parsePrice(room.price);
            
            if (price !== null) {
              // Add room_only result
              if (roomTypes.includes('room_only') && !room.hasBreakfast) {
                results.push({
                  date: checkInStr,
                  roomType: 'room_only',
                  price: price,
                  currency: 'ILS',
                  available: true
                });
              }

              // Add with_breakfast result
              if (roomTypes.includes('with_breakfast') && room.hasBreakfast) {
                results.push({
                  date: checkInStr,
                  roomType: 'with_breakfast',
                  price: price,
                  currency: 'ILS',
                  available: true
                });
              }
            }
          }

          // If no prices found, mark as unavailable
          if (priceData.length === 0) {
            for (const roomType of roomTypes) {
              results.push({
                date: checkInStr,
                roomType,
                price: null,
                currency: 'ILS',
                available: false
              });
            }
          }

        } catch (error) {
          console.error(`[ScraperV3] Error scraping date ${checkInStr}:`, error);
          // Add unavailable entries for this date
          for (const roomType of roomTypes) {
            results.push({
              date: checkInStr,
              roomType,
              price: null,
              currency: 'ILS',
              available: false
            });
          }
        }

        // Rate limiting - wait between requests
        await page.waitForTimeout(1000);
      }

    } finally {
      await page.close();
    }

    return results;
  }

  private extractHotelId(url: string): string | null {
    // Extract hotel ID from URLs like:
    // https://www.booking.com/hotel/il/debrah-brown-tel-aviv.html
    // https://www.booking.com/hotel/il/scarlet-hotel.html
    const match = url.match(/\/hotel\/[a-z]{2}\/([^.?]+)/);
    return match ? match[1] : null;
  }

  private parsePrice(priceText: string | null): number | null {
    if (!priceText) return null;

    // Remove currency symbols and extract number
    // Handles formats like: "S$ 476", "₪476", "$476", "476"
    const cleaned = priceText.replace(/[^\d.,]/g, '');
    const number = parseFloat(cleaned.replace(/,/g, ''));

    return isNaN(number) ? null : number;
  }
}

export async function scrapeHotelPricesV3(
  hotelUrl: string,
  startDate: Date,
  daysForward: number,
  roomTypes: ('room_only' | 'with_breakfast')[]
): Promise<ScrapedPrice[]> {
  const scraper = new BookingScraperV3();
  try {
    await scraper.initialize();
    return await scraper.scrapeHotelPrices(hotelUrl, startDate, daysForward, roomTypes);
  } finally {
    await scraper.close();
  }
}
