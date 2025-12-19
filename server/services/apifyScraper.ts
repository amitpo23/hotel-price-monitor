import { ApifyClient } from 'apify-client';

interface ApifyScraperResult {
  date: string;
  roomType: 'room_only' | 'with_breakfast';
  price: number;
  available: boolean;
}

interface ApifyBookingResult {
  name?: string;
  price?: {
    value: number;
    currency: string;
  };
  availableRooms?: Array<{
    name: string;
    price: number;
    available: boolean;
  }>;
  checkIn?: string;
  checkOut?: string;
}

/**
 * Scrape hotel prices using Apify as fallback when Playwright fails
 * This is used when the primary Python Playwright scraper fails
 * Requires APIFY_TOKEN environment variable to be set
 */
export async function scrapeWithApify(
  hotelUrl: string,
  startDate: string,
  daysForward: number,
  roomTypes: ('room_only' | 'with_breakfast')[]
): Promise<ApifyScraperResult[]> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[ApifyScraper] 🔄 FALLBACK TO APIFY`);
  console.log(`[ApifyScraper] URL: ${hotelUrl}`);
  console.log(`[ApifyScraper] Start date: ${startDate}`);
  console.log(`[ApifyScraper] Days forward: ${daysForward}`);
  console.log(`[ApifyScraper] Room types: ${roomTypes.join(", ")}`);
  console.log(`${"=".repeat(80)}\n`);

  // Validate environment variables
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    const error = new Error(
      'APIFY_TOKEN environment variable is not set. ' +
      'Get your token from: https://console.apify.com/account/integrations'
    );
    console.error(`[ApifyScraper] ❌ ${error.message}`);
    throw error;
  }

  const actorId = process.env.APIFY_BOOKING_ACTOR_ID || 'dtrungtin/booking-scraper';
  console.log(`[ApifyScraper] 🎭 Using Apify actor: ${actorId}`);

  // Initialize Apify client
  const client = new ApifyClient({
    token: apifyToken,
  });

  // Prepare results array
  const allResults: ApifyScraperResult[] = [];

  // We'll run multiple scans - one for each day
  for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
    const checkInDate = new Date(startDate);
    checkInDate.setDate(checkInDate.getDate() + dayOffset);
    const checkInStr = checkInDate.toISOString().split('T')[0];
    
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1); // 1 night stay
    const checkOutStr = checkOutDate.toISOString().split('T')[0];

    console.log(`[ApifyScraper] 📅 Scanning day ${dayOffset + 1}/${daysForward}: ${checkInStr}`);

    try {
      // Configure Apify actor input
      const input = {
        search: hotelUrl,
        startUrls: [{ url: hotelUrl }],
        checkIn: checkInStr,
        checkOut: checkOutStr,
        rooms: 1,
        adults: 2,
        children: 0,
        currency: 'ILS',
        language: 'en-gb',
        maxItems: 1, // We only need one result per day
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'], // Use residential proxies for better success rate
        },
      };

      console.log(`[ApifyScraper] 🏃 Running Apify actor...`);
      const runStartTime = Date.now();
      
      const run = await client.actor(actorId).call(input, {
        timeout: 300, // 5 minutes timeout
        memory: 256, // MB
      });

      const runDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
      console.log(`[ApifyScraper] ⏱️  Actor completed in ${runDuration}s`);
      console.log(`[ApifyScraper] Run ID: ${run.id}`);
      console.log(`[ApifyScraper] Status: ${run.status}`);
      console.log(`[ApifyScraper] Stats: ${JSON.stringify(run.stats)}`);

      if (run.status !== 'SUCCEEDED') {
        console.error(`[ApifyScraper] ⚠️  Actor run failed with status: ${run.status}`);
        console.error(`[ApifyScraper] Error: ${run.statusMessage}`);
        continue; // Skip this day
      }

      // Fetch results from dataset
      console.log(`[ApifyScraper] 📥 Fetching results from dataset ${run.defaultDatasetId}...`);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      console.log(`[ApifyScraper] ✅ Received ${items.length} items from Apify`);

      if (items.length === 0) {
        console.warn(`[ApifyScraper] ⚠️  No results for ${checkInStr}, marking as unavailable`);
        for (const roomType of roomTypes) {
          allResults.push({
            date: checkInStr,
            roomType,
            price: 0,
            available: false,
          });
        }
        continue;
      }

      // Process first item (hotel data)
      const hotelData = items[0] as ApifyBookingResult;
      console.log(`[ApifyScraper] 🏨 Hotel: ${hotelData.name || 'Unknown'}`);
      console.log(`[ApifyScraper] 💰 Price: ${hotelData.price?.currency} ${hotelData.price?.value}`);

      // Extract prices for each room type
      for (const roomType of roomTypes) {
        const price = hotelData.price?.value || 0;
        const available = price > 0;

        allResults.push({
          date: checkInStr,
          roomType,
          price,
          available,
        });

        console.log(`[ApifyScraper] 📊 ${checkInStr} | ${roomType}: ${price} (${available ? 'available' : 'unavailable'})`);
      }

    } catch (error) {
      console.error(`[ApifyScraper] ❌ Error scanning ${checkInStr}:`, error);
      console.error(`[ApifyScraper] Error message:`, error instanceof Error ? error.message : String(error));
      
      // Add unavailable results for this day
      for (const roomType of roomTypes) {
        allResults.push({
          date: checkInStr,
          roomType,
          price: 0,
          available: false,
        });
      }
    }

    // Add delay between requests to avoid rate limiting
    if (dayOffset < daysForward - 1) {
      console.log(`[ApifyScraper] ⏳ Waiting 2 seconds before next scan...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`[ApifyScraper] ✅ APIFY FALLBACK COMPLETED`);
  console.log(`[ApifyScraper] Total results: ${allResults.length}`);
  console.log(`[ApifyScraper] Available prices: ${allResults.filter(r => r.available).length}`);
  console.log(`${"=".repeat(80)}\n`);

  return allResults;
}

/**
 * Check if Apify is properly configured
 */
export function isApifyConfigured(): boolean {
  const token = process.env.APIFY_TOKEN;
  const enabled = process.env.ENABLE_APIFY_FALLBACK !== 'false';
  
  if (!token) {
    console.warn(`[ApifyScraper] ⚠️  APIFY_TOKEN not set - fallback disabled`);
    return false;
  }

  if (!enabled) {
    console.log(`[ApifyScraper] 🔕 Apify fallback is disabled via ENABLE_APIFY_FALLBACK`);
    return false;
  }

  return true;
}
