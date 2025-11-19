import { chromium, Browser, Page } from 'playwright';

export interface ScrapedPrice {
  date: Date;
  roomType: 'room_only' | 'with_breakfast';
  price: number;
  available: boolean;
}

/**
 * Scrape hotel prices from Booking.com for multiple dates
 * V4 - Simplified approach using Playwright's built-in text extraction
 */
export async function scrapeHotelPricesV4(
  hotelUrl: string,
  startDate: Date,
  daysForward: number,
  roomTypes: ('room_only' | 'with_breakfast')[]
): Promise<ScrapedPrice[]> {
  console.log(`[ScraperV4] Starting scrape for ${hotelUrl}`);
  console.log(`[ScraperV4] Date range: ${daysForward} days from ${startDate.toISOString().split('T')[0]}`);
  
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results: ScrapedPrice[] = [];
  
  try {
    const page: Page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    // Iterate through each date
    for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
      const checkIn = new Date(startDate);
      checkIn.setDate(checkIn.getDate() + dayOffset);
      
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);

      const checkInStr = checkIn.toISOString().split('T')[0];
      const checkOutStr = checkOut.toISOString().split('T')[0];

      console.log(`[ScraperV4] Checking date: ${checkInStr}`);

      try {
        // Build URL with dates
        const url = `${hotelUrl}?checkin=${checkInStr}&checkout=${checkOutStr}&group_adults=2&no_rooms=1`;
        
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // Wait for price elements to load
        await page.waitForTimeout(3000);

        // Extract all text content
        const pageText = await page.textContent('body') || '';
        
        // Look for price patterns (SGD, ILS, USD, EUR, etc.)
        const priceMatches = pageText.match(/(?:SGD|ILS|USD|EUR|₪|\$|€)\s*[\d,]+/g) || [];
        
        // Check if page shows "sold out" or "not available"
        const isAvailable = !pageText.toLowerCase().includes('sold out') && 
                           !pageText.toLowerCase().includes('not available') &&
                           priceMatches.length > 0;

        if (isAvailable && priceMatches.length > 0) {
          // Extract numeric prices
          const prices = priceMatches
            .map(p => {
              const numStr = p.replace(/[^\d]/g, '');
              return parseInt(numStr, 10);
            })
            .filter(p => p > 50 && p < 10000); // Filter reasonable hotel prices

          if (prices.length > 0) {
            // Use the minimum price found (usually room only)
            const minPrice = Math.min(...prices);
            
            // Check for breakfast mentions
            const hasBreakfast = pageText.toLowerCase().includes('breakfast included') ||
                                pageText.toLowerCase().includes('with breakfast');

            // Add results for requested room types
            for (const roomType of roomTypes) {
              if (roomType === 'room_only') {
                results.push({
                  date: checkIn,
                  roomType: 'room_only',
                  price: minPrice,
                  available: true
                });
              } else if (roomType === 'with_breakfast' && hasBreakfast) {
                // Estimate breakfast price (usually 10-20% more)
                const breakfastPrice = Math.round(minPrice * 1.15);
                results.push({
                  date: checkIn,
                  roomType: 'with_breakfast',
                  price: breakfastPrice,
                  available: true
                });
              } else if (roomType === 'with_breakfast' && !hasBreakfast) {
                // No breakfast available, mark as unavailable
                results.push({
                  date: checkIn,
                  roomType: 'with_breakfast',
                  price: 0,
                  available: false
                });
              }
            }

            console.log(`[ScraperV4] Found prices for ${checkInStr}: ${prices.join(', ')}`);
          } else {
            console.log(`[ScraperV4] No valid prices found for ${checkInStr}`);
            // Add unavailable entries
            for (const roomType of roomTypes) {
              results.push({
                date: checkIn,
                roomType,
                price: 0,
                available: false
              });
            }
          }
        } else {
          console.log(`[ScraperV4] Room not available for ${checkInStr}`);
          // Add unavailable entries
          for (const roomType of roomTypes) {
            results.push({
              date: checkIn,
              roomType,
              price: 0,
              available: false
            });
          }
        }

        // Small delay between requests
        await page.waitForTimeout(1000);

      } catch (error: any) {
        console.error(`[ScraperV4] Error scraping ${checkInStr}:`, error.message);
        // Add unavailable entries on error
        for (const roomType of roomTypes) {
          results.push({
            date: checkIn,
            roomType,
            price: 0,
            available: false
          });
        }
      }
    }

  } finally {
    await browser.close();
  }

  console.log(`[ScraperV4] Completed: ${results.length} results collected`);
  return results;
}
