#!/usr/bin/env tsx
/**
 * Test Advanced Scraper Engine
 * This demonstrates the new advanced scraping capabilities
 */

import { getScraperEngine, ScraperEngine } from './server/services/scraper';
import type { ScraperConfig, ScraperContext, ScraperResult } from './server/services/scraper';

async function main() {
  console.log('🧪 Testing Advanced Scraper Engine\n');

  // Example hotel URL (replace with actual URL)
  const hotelUrl = 'https://www.booking.com/hotel/il/dan-tel-aviv.html';
  
  console.log('📋 Test 1: Basic Scraping with Default Config');
  console.log('=' .repeat(80));
  
  try {
    // Create basic configuration
    const config = ScraperEngine.createDefaultConfig(
      hotelUrl,
      7,  // 7 days forward
      ['room_only', 'with_breakfast']
    );

    console.log('\n✅ Configuration created:');
    console.log(`   - Fetcher: ${config.fetcherType}`);
    console.log(`   - Days forward: ${config.daysForward}`);
    console.log(`   - Room types: ${config.roomTypes.join(', ')}`);
    console.log(`   - Retry enabled: ${config.retry ? 'Yes' : 'No'}`);
    console.log(`   - Change detection: ${config.changeDetection?.enabled ? 'Yes' : 'No'}`);

    // Create context
    const context: ScraperContext = {
      config,
      startDate: new Date(),
      hotel: {
        id: 1,
        name: 'Test Hotel',
        bookingUrl: hotelUrl
      }
    };

    // Execute scraping
    console.log('\n🚀 Starting scrape...\n');
    const engine = getScraperEngine();
    const results = await engine.scrape(config, context);

    console.log('\n📊 Results Summary:');
    console.log(`   - Total results: ${results.length}`);
    
    const withPrice = results.filter(r => r.price !== null);
    console.log(`   - Results with price: ${withPrice.length}`);

    if (withPrice.length > 0) {
      const prices = withPrice.map(r => r.price!);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      console.log(`   - Price range: ${minPrice}-${maxPrice} ${results[0].currency}`);
      console.log(`   - Average price: ${Math.round(avgPrice)} ${results[0].currency}`);
    }

    // Show sample results
    console.log('\n📝 Sample Results (first 3):');
    results.slice(0, 3).forEach((result, idx) => {
      console.log(`   ${idx + 1}. Date: ${result.date}`);
      console.log(`      - Room type: ${result.roomType}`);
      console.log(`      - Price: ${result.price ? `${result.price} ${result.currency}` : 'N/A'}`);
      console.log(`      - Available: ${result.available ? 'Yes' : 'No'}`);
      console.log(`      - Attempts: ${result.attempts}`);
      console.log(`      - Duration: ${result.scrapeDuration}ms`);
    });

  } catch (error: any) {
    console.error('\n❌ Test 1 failed:', error.message);
    console.error(error.stack);
  }

  console.log('\n\n📋 Test 2: Scraping with Browser Steps');
  console.log('='.repeat(80));

  try {
    // Create config with browser steps
    const config = ScraperEngine.createBookingComConfig(
      hotelUrl,
      3,  // 3 days for quick test
      true // Enable browser steps
    );

    console.log('\n✅ Configuration with Browser Steps:');
    console.log(`   - Browser steps enabled: Yes`);
    console.log(`   - Number of steps: ${config.browserSteps?.length || 0}`);

    if (config.browserSteps) {
      console.log('\n🎬 Browser Steps:');
      config.browserSteps.forEach((step, idx) => {
        console.log(`   ${idx + 1}. ${step.type} - ${step.description || 'No description'}`);
      });
    }

    console.log('\n⏭️  Skipping execution (demonstration only)');

  } catch (error: any) {
    console.error('\n❌ Test 2 failed:', error.message);
  }

  console.log('\n\n📋 Test 3: Configuration with Proxy (Demo)');
  console.log('='.repeat(80));

  try {
    // Create config with proxy (not actually used, just for demonstration)
    const config = ScraperEngine.createConfigWithProxy(
      hotelUrl,
      'proxy.example.com:8080',
      'http',
      'username',
      'password'
    );

    console.log('\n✅ Configuration with Proxy:');
    console.log(`   - Proxy enabled: ${config.proxy?.enabled ? 'Yes' : 'No'}`);
    console.log(`   - Proxy type: ${config.proxy?.type}`);
    console.log(`   - Proxy URL: ${config.proxy?.url}`);
    console.log(`   - Rotation interval: ${config.proxy?.rotationInterval} requests`);

    console.log('\n⏭️  Skipping execution (demonstration only)');

  } catch (error: any) {
    console.error('\n❌ Test 3 failed:', error.message);
  }

  console.log('\n\n📋 Test 4: Configuration with JSON Extraction (Demo)');
  console.log('='.repeat(80));

  try {
    // Create config with JSON extraction
    const config = ScraperEngine.createConfigWithJsonExtraction(
      hotelUrl,
      '$.offers[0].price'
    );

    console.log('\n✅ Configuration with JSON Extraction:');
    console.log(`   - JSON extraction enabled: Yes`);
    console.log(`   - JSONPath: ${config.jsonExtractor?.path}`);
    console.log(`   - Type: ${config.jsonExtractor?.type}`);

    console.log('\n⏭️  Skipping execution (demonstration only)');

  } catch (error: any) {
    console.error('\n❌ Test 4 failed:', error.message);
  }

  console.log('\n\n✅ All tests completed!\n');
  console.log('📖 For full documentation, see README_ADVANCED_SCRAPER.md\n');
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
