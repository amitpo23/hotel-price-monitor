#!/usr/bin/env python3
"""
Booking.com Price Scraper
Uses Playwright to scrape hotel prices for multiple dates and room types
Output format matches scanService.ts expectations
"""

import sys
import json
import asyncio
import logging
from datetime import datetime, timedelta
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [SCRAPER] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

async def scrape_hotel_prices(hotel_url: str, start_date_str: str, days_forward: int, room_types: list):
    """
    Scrape hotel prices from Booking.com for multiple dates

    Args:
        hotel_url: Base Booking.com hotel URL
        start_date_str: Start date in YYYY-MM-DD format
        days_forward: Number of days to scan forward
        room_types: List of room types to filter (e.g., ['room_only', 'with_breakfast'])

    Returns:
        List of price results with date, roomType, price, available
    """
    logger.info(f"Starting scrape for hotel: {hotel_url}")
    logger.info(f"Date range: {start_date_str} + {days_forward} days forward")
    logger.info(f"Room types requested: {room_types}")

    results = []
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')

    async with async_playwright() as p:
        # Launch browser in headless mode
        logger.info("Launching browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        try:
            # Iterate through dates
            logger.info(f"Starting to scrape {days_forward} dates...")
            for day_offset in range(days_forward):
                check_in = start_date + timedelta(days=day_offset)
                check_out = check_in + timedelta(days=1)

                check_in_str = check_in.strftime('%Y-%m-%d')
                check_out_str = check_out.strftime('%Y-%m-%d')

                logger.info(f"Scraping date {day_offset + 1}/{days_forward}: {check_in_str}")

                # Build URL with date parameters
                url = f"{hotel_url}?checkin={check_in_str}&checkout={check_out_str}&group_adults=2&group_children=0&no_rooms=1"

                page = await context.new_page()

                try:
                    # Navigate to page
                    logger.info(f"Navigating to: {url}")
                    await page.goto(url, wait_until='networkidle', timeout=30000)
                    logger.info(f"Page loaded successfully")
                    
                    # Wait for price elements to load
                    await asyncio.sleep(2)
                    
                    # Check if hotel is available
                    no_availability = await page.locator('text=/no availability|sold out|not available/i').count() > 0

                    if no_availability:
                        logger.warning(f"No availability found for {check_in_str}")
                        # Add unavailable entry for each requested room type
                        for room_type in room_types:
                            results.append({
                                'date': check_in_str,
                                'roomType': room_type,
                                'price': 0,
                                'available': False
                            })
                        await page.close()
                        continue
                    
                    # Track which room types we found
                    found_room_types = set()
                    
                    # Extract room prices
                    # Try multiple selectors for price elements
                    price_selectors = [
                        '[data-testid="price-and-discounted-price"]',
                        '.prco-valign-middle-helper',
                        '.bui-price-display__value',
                        '.prco-text-nowrap-helper',
                        'span[aria-hidden="true"]'
                    ]
                    
                    room_blocks = await page.locator('[data-testid="property-card-container"], .hprt-table-row, [data-block-id]').all()

                    if not room_blocks:
                        # Try alternative structure
                        room_blocks = await page.locator('.room-block, .hprt-table tbody tr').all()

                    logger.info(f"Found {len(room_blocks)} room blocks on page")

                    for room_block in room_blocks[:10]:  # Limit to first 10 rooms
                        try:
                            # Get room description
                            room_desc_elem = room_block.locator('.hprt-roomtype-icon-link, [data-testid="title"], .room-name')
                            room_desc = await room_desc_elem.first.inner_text() if await room_desc_elem.count() > 0 else ""
                            room_desc = room_desc.lower()
                            
                            # Determine room type based on description
                            has_breakfast = any(keyword in room_desc for keyword in ['breakfast', 'ארוחת בוקר', 'כולל ארוחה'])
                            room_type = 'with_breakfast' if has_breakfast else 'room_only'
                            
                            # Skip if not in requested room types
                            if room_type not in room_types:
                                continue
                            
                            # Skip if we already found this room type for this date
                            if room_type in found_room_types:
                                continue
                            
                            # Extract price
                            price_text = None
                            for selector in price_selectors:
                                price_elem = room_block.locator(selector)
                                if await price_elem.count() > 0:
                                    price_text = await price_elem.first.inner_text()
                                    if price_text and any(c.isdigit() for c in price_text):
                                        break
                            
                            if not price_text:
                                continue
                            
                            # Parse price (remove currency symbols and commas)
                            price_clean = ''.join(c for c in price_text if c.isdigit() or c == '.')
                            if not price_clean:
                                continue
                            
                            price = float(price_clean)

                            logger.info(f"Found price: {price} ILS for {room_type} on {check_in_str}")

                            results.append({
                                'date': check_in_str,
                                'roomType': room_type,
                                'price': price,
                                'available': True
                            })

                            found_room_types.add(room_type)

                        except Exception as e:
                            # Skip this room block if extraction fails
                            logger.debug(f"Error processing room block: {str(e)}")
                            continue
                    
                    # If no prices found for requested room types, mark as unavailable
                    for room_type in room_types:
                        if room_type not in found_room_types:
                            logger.warning(f"No price found for {room_type} on {check_in_str}, marking as unavailable")
                            results.append({
                                'date': check_in_str,
                                'roomType': room_type,
                                'price': 0,
                                'available': False
                            })

                except PlaywrightTimeout:
                    logger.error(f"Timeout loading page for {check_in_str}")
                    for room_type in room_types:
                        results.append({
                            'date': check_in_str,
                            'roomType': room_type,
                            'price': 0,
                            'available': False
                        })
                except Exception as e:
                    logger.error(f"Error scraping {check_in_str}: {str(e)}")
                    for room_type in room_types:
                        results.append({
                            'date': check_in_str,
                            'roomType': room_type,
                            'price': 0,
                            'available': False
                        })
                finally:
                    await page.close()
                
                # Small delay between requests
                await asyncio.sleep(1)
        
        finally:
            await browser.close()
            logger.info("Browser closed")

    logger.info(f"Scraping completed. Total results: {len(results)}")
    return results


async def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 5:
        logger.error("Insufficient arguments provided")
        print(json.dumps([]))
        sys.exit(0)

    hotel_url = sys.argv[1]
    start_date_str = sys.argv[2]
    days_forward = int(sys.argv[3])
    room_types = json.loads(sys.argv[4])

    logger.info("=" * 60)
    logger.info("BOOKING SCRAPER STARTED")
    logger.info("=" * 60)

    try:
        results = await scrape_hotel_prices(hotel_url, start_date_str, days_forward, room_types)
        # Output as JSON array (not wrapped in success object)
        logger.info(f"Successfully scraped {len(results)} results")
        logger.info("=" * 60)
        print(json.dumps(results))
    except Exception as e:
        # On error, output empty array
        logger.error(f"Fatal error in main: {str(e)}")
        logger.error("=" * 60)
        print(json.dumps([]))
        sys.exit(0)


if __name__ == '__main__':
    asyncio.run(main())
