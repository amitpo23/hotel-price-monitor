#!/usr/bin/env python3
"""
Booking.com Price Scraper using Playwright
This is the original working approach that successfully collected prices
"""

import sys
import json
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
import time

def scrape_hotel_prices(hotel_url, start_date_str, days_forward, room_types):
    """
    Scrape hotel prices from Booking.com
    
    Args:
        hotel_url: Full Booking.com hotel URL
        start_date_str: Start date in YYYY-MM-DD format
        days_forward: Number of days to check
        room_types: List of room types ['room_only', 'with_breakfast']
    
    Returns:
        List of price results
    """
    results = []
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Set viewport and user agent
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        
        for day_offset in range(days_forward):
            check_in = start_date + timedelta(days=day_offset)
            check_out = check_in + timedelta(days=1)
            
            check_in_str = check_in.strftime('%Y-%m-%d')
            check_out_str = check_out.strftime('%Y-%m-%d')
            
            print(f"[PythonScraper] Checking date: {check_in_str}", file=sys.stderr)
            
            try:
                # Build URL
                url = f"{hotel_url}?checkin={check_in_str}&checkout={check_out_str}&group_adults=2&no_rooms=1"
                
                # Navigate to page
                page.goto(url, wait_until='networkidle', timeout=30000)
                time.sleep(3)  # Wait for dynamic content
                
                # Get page text
                page_text = page.inner_text('body')
                
                # Look for prices (various currency formats)
                import re
                price_patterns = [
                    r'SGD\s*[\d,]+',
                    r'ILS\s*[\d,]+',
                    r'₪\s*[\d,]+',
                    r'\$\s*[\d,]+',
                    r'€\s*[\d,]+',
                ]
                
                prices = []
                for pattern in price_patterns:
                    matches = re.findall(pattern, page_text)
                    for match in matches:
                        # Extract numeric value
                        num_str = re.sub(r'[^\d]', '', match)
                        if num_str:
                            price = int(num_str)
                            if 50 < price < 10000:  # Reasonable hotel price range
                                prices.append(price)
                
                # Check availability
                is_available = len(prices) > 0 and \
                              'sold out' not in page_text.lower() and \
                              'not available' not in page_text.lower()
                
                if is_available and prices:
                    min_price = min(prices)
                    has_breakfast = 'breakfast included' in page_text.lower() or \
                                  'with breakfast' in page_text.lower()
                    
                    print(f"[PythonScraper] Found {len(prices)} prices, min: {min_price}", file=sys.stderr)
                    
                    # Add results for requested room types
                    for room_type in room_types:
                        if room_type == 'room_only':
                            results.append({
                                'date': check_in_str,
                                'roomType': 'room_only',
                                'price': min_price,
                                'available': True
                            })
                        elif room_type == 'with_breakfast':
                            if has_breakfast:
                                breakfast_price = int(min_price * 1.15)
                                results.append({
                                    'date': check_in_str,
                                    'roomType': 'with_breakfast',
                                    'price': breakfast_price,
                                    'available': True
                                })
                            else:
                                results.append({
                                    'date': check_in_str,
                                    'roomType': 'with_breakfast',
                                    'price': 0,
                                    'available': False
                                })
                else:
                    print(f"[PythonScraper] No prices found for {check_in_str}", file=sys.stderr)
                    for room_type in room_types:
                        results.append({
                            'date': check_in_str,
                            'roomType': room_type,
                            'price': 0,
                            'available': False
                        })
                
                # Small delay between requests
                time.sleep(1)
                
            except Exception as e:
                print(f"[PythonScraper] Error scraping {check_in_str}: {str(e)}", file=sys.stderr)
                for room_type in room_types:
                    results.append({
                        'date': check_in_str,
                        'roomType': room_type,
                        'price': 0,
                        'available': False
                    })
        
        browser.close()
    
    return results

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: booking_scraper.py <hotel_url> <start_date> <days_forward> <room_types_json>", file=sys.stderr)
        sys.exit(1)
    
    hotel_url = sys.argv[1]
    start_date = sys.argv[2]
    days_forward = int(sys.argv[3])
    room_types = json.loads(sys.argv[4])
    
    print(f"[PythonScraper] Starting scrape: {hotel_url}, {days_forward} days from {start_date}", file=sys.stderr)
    
    results = scrape_hotel_prices(hotel_url, start_date, days_forward, room_types)
    
    # Output results as JSON to stdout
    print(json.dumps(results))
    print(f"[PythonScraper] Completed: {len(results)} results", file=sys.stderr)
