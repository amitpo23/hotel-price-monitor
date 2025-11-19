# Booking.com Price Scraping Findings

## Current Page Structure (Nov 2025)

### Price Display Format
- **Room prices are shown in SGD** (Singapore Dollars) with format: `S$ 476`
- Prices have strikethrough for original price: `S$ 560` → `S$ 476`
- Discount percentage shown as badge: `15% off`
- Deal type shown as green badge: `Late Escape Deal`

### Room Type Structure
Each room has:
1. **Room Name**: Link element (e.g., "Standard Double Room", "Executive Room")
2. **Price Section**: Contains:
   - Original price (strikethrough): `S$ 560`
   - Current price (bold): `S$ 476`
   - Info icon with tooltip
3. **Breakfast Info**:
   - "Breakfast S$ 48 (optional)" - for room only
   - "Breakfast included in the price" - for breakfast included
4. **Availability**: "We have 1 left" / "We have 2 left"

### HTML Selectors Found
- Room container: Table row `<tr>` with room details
- Room name: `<a>` link with room type name
- Price: Text format `S$ XXX` in the "Today's Price" column
- Breakfast: Green checkmark icon + text "Breakfast included" OR "Breakfast S$ XX (optional)"
- Availability: Red/orange dot + text "We have X left"

### Key Observations
1. Prices load dynamically but are present in initial HTML
2. Currency is SGD (need to convert or handle different currencies)
3. Breakfast can be:
   - Included in price
   - Optional (additional cost)
   - Not available
4. Room availability is clearly marked

### Recommended Scraping Strategy
1. Wait for table with class containing "room" or "availability"
2. Find all `<tr>` elements (room rows)
3. For each row:
   - Extract room name from `<a>` link
   - Extract price from "Today's Price" column (look for `S$ XXX` pattern)
   - Check for "Breakfast included" text vs "Breakfast S$ XX (optional)"
   - Extract availability from "We have X left" text
4. Parse price: Remove currency symbol, convert to number
5. Determine room type: Check if breakfast is included or optional

### Price Extraction Regex
- Pattern: `S\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)`
- Example matches: "S$ 476", "S$ 1,234", "S$ 545.50"
