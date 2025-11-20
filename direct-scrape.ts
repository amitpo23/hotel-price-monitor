#!/usr/bin/env tsx
/**
 * Direct Scraper - Bypasses scan service and writes directly to DB
 * This is a workaround to prove the Python scraper works
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as db from './server/db';
import { drizzle } from 'drizzle-orm/mysql2';
import { scans, scanResults } from './drizzle/schema';

const execAsync = promisify(exec);

async function main() {
  console.log('🚀 Direct Scraper Starting...\n');

  // Get hotels
  const hotels = await db.getHotels(1);
  console.log(`Found ${hotels.length} hotels\n`);

  const hotel = hotels[0];
  console.log(`Scraping: ${hotel.name}`);
  console.log(`URL: ${hotel.bookingUrl}\n`);

  // Run Python scraper
  const scriptPath = '/home/ubuntu/hotel-price-monitor/server/scripts/booking_scraper.py';
  const startDate = '2025-11-21';
  const days = 7;
  const roomTypes = '["room_only"]';

  const command = `python3 "${scriptPath}" "${hotel.bookingUrl}" "${startDate}" ${days} '${roomTypes}'`;
  
  console.log('Running scraper...');
  console.log(`Command: ${command}\n`);

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    if (stderr) {
      console.error('Stderr:', stderr);
    }

    // Parse JSON output (last line)
    const lines = stdout.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    
    console.log('Raw output last line:', jsonLine, '\n');
    
    const results = JSON.parse(jsonLine);
    console.log(`✅ Got ${results.length} results\n`);

    // Create a scan record using Drizzle
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error('Database not available');
    }

    // Get first real scan config
    const configs = await db.getScanConfigs(1);
    if (configs.length === 0) {
      throw new Error('No scan configs found. Please create one first.');
    }
    const configId = configs[0].id;
    console.log(`Using scan config ID: ${configId}\n`);

    const now = new Date();
    const [insertResult] = await dbInstance.insert(scans).values({
      scanConfigId: configId,
      status: 'completed',
      totalHotels: 1,
      completedHotels: 1,
      startedAt: now,
      completedAt: now,
    });
    
    const scanId = Number(insertResult.insertId);
    console.log(`✅ Created scan record: ${scanId}\n`);

    // Insert results
    const resultsToInsert = results
      .filter((r: any) => r.available && r.price)
      .map((r: any) => ({
        scanId,
        hotelId: hotel.id,
        checkInDate: r.date, // Already in YYYY-MM-DD format
        roomType: r.roomType,
        price: Math.round(r.price * 100),
        isAvailable: 1,
      }));

    if (resultsToInsert.length > 0) {
      await dbInstance.insert(scanResults).values(resultsToInsert);
      console.log(`✅ Inserted ${resultsToInsert.length} results into database\n`);
    }

    console.log(`🎉 SUCCESS! Check the Results page - Scan ID: ${scanId}\n`);
    console.log(`📊 Price range: ₪${Math.min(...results.map((r: any) => r.price))} - ₪${Math.max(...results.map((r: any) => r.price))}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stdout) console.log('Stdout:', error.stdout);
    if (error.stderr) console.error('Stderr:', error.stderr);
    process.exit(1);
  }
}

main();
