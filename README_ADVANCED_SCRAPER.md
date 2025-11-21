# 🚀 Advanced Scraper Engine

## Overview

המנוע המתקדם לסריקת מחירי מלונות מבוסס על האדריכלות של **changedetection.io** ומוסיף יכולות רבות לשיפור אמינות, מהירות ועוצמה של הסריקה.

## 🎯 תכונות עיקריות

### 1. **אסטרטגיות Scraping מרובות**
- ✅ **Playwright** - דפדפן מלא עם תמיכה ב-JavaScript (ברירת מחדל)
- 🚧 **HTTP Client** - מהיר לדפים סטטיים (לעתיד)
- 🚧 **Puppeteer** - אלטרנטיבה ל-Playwright (לעתיד)

### 2. **Browser Steps - אוטומציה של פעולות דפדפן**
מנגנון להקלטת והפעלת פעולות אינטראקטיביות:
- **Click** - לחיצה על אלמנטים
- **Fill** - מילוי טפסים
- **Select** - בחירה מרשימות נפתחות
- **Wait** - המתנה לזמן מסוים
- **WaitForSelector** - המתנה לאלמנט
- **ExecuteJs** - הרצת קוד JavaScript מותאם
- **Screenshot** - צילום מסך

#### דוגמה:
```typescript
const steps: BrowserStep[] = [
  {
    type: 'click',
    selector: 'input[name="checkin"]',
    description: 'לחץ על שדה תאריך כניסה'
  },
  {
    type: 'fill',
    selector: 'input[name="checkin"]',
    value: '2025-12-01',
    description: 'הזן תאריך כניסה'
  },
  {
    type: 'waitForSelector',
    selector: '.room-block',
    timeout: 15000,
    description: 'המתן לחדרים'
  }
];
```

#### צעדים מוכנים מראש:
```typescript
// לאתר Booking.com
const steps = BrowserStepsExecutor.getCompleteBookingFlow(
  '2025-12-01', // Check-in
  '2025-12-02', // Check-out
  2             // Adults
);

// רק קבלת עוגיות
const cookieSteps = BrowserStepsExecutor.getAcceptCookiesSteps();

// סגירת פופאפים
const closeSteps = BrowserStepsExecutor.getClosePopupsSteps();
```

### 3. **Proxy Rotation - תמיכה בפרוקסים מרובים**
תמיכה מלאה בספקי proxy מובילים:
- **Bright Data** - הספק המוביל עולמית
- **Oxylabs** - פרוקסים רזידנציאליים
- **HTTP/SOCKS5** - פרוקסים סטנדרטיים

#### תצורה:
```typescript
const config: ProxyConfig = {
  enabled: true,
  type: 'brightdata',
  url: 'brd.superproxy.io:22225',
  username: 'your-username',
  password: 'your-password',
  country: 'il', // ישראל
  rotationInterval: 10 // סובב אחרי 10 בקשות
};
```

#### משתני סביבה:
```bash
PROXY_TYPE=brightdata
PROXY_URL=brd.superproxy.io:22225
PROXY_USERNAME=your-username
PROXY_PASSWORD=your-password
PROXY_COUNTRY=il
PROXY_ROTATION_INTERVAL=10
```

### 4. **Smart Retry - ניסיון חוזר חכם**
לוגיקת retry מתקדמת עם:
- **Exponential Backoff** - עיכוב מתגבר
- **Jitter** - אקראיות למניעת "thundering herd"
- **זיהוי Bot Detection** - זיהוי חסימות ו-CAPTCHA
- **ניסיון חוזר על שגיאות רשת** - ETIMEDOUT, ECONNREFUSED וכו'

#### תצורה:
```typescript
const retryConfig: RetryConfig = {
  maxAttempts: 5,
  initialDelay: 2000,      // 2 שניות
  maxDelay: 60000,         // 60 שניות מקסימום
  backoffMultiplier: 2,    // כפול פי 2 בכל פעם
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504]
};
```

### 5. **JSON Extraction - חילוץ מ-JSON מוטמע**
חילוץ מחירים מתוך JSON מוטמע בדף (כמו `<script type="application/ld+json">`):

#### JSONPath Examples:
```typescript
// מחיר פשוט
'$.price'

// מחיר ממערך
'$.offers[0].price'

// מחיר מתוך רשימת חדרים
'$.rooms[*].price'

// מחיר מ-structured data
'$.offers.priceSpecification.price'
```

#### שימוש:
```typescript
const config: ScraperConfig = {
  // ... תצורות אחרות
  jsonExtractor: {
    path: '$.offers.price',
    type: 'jsonpath'
  }
};
```

### 6. **Change Detection - גילוי שינויים חכם**
גילוי אוטומטי של שינויי מחיר עם התראות:

```typescript
const changeDetection: ChangeDetectionConfig = {
  enabled: true,
  ignoreWhitespace: true,
  minimumChange: 5,        // התריע רק על שינוי של 5% ומעלה
  notifyOnDecrease: true,  // התריע על ירידת מחיר
  notifyOnIncrease: true,  // התריע על עליית מחיר
  threshold: 50            // התריע רק אם השינוי מעל ₪50
};
```

### 7. **Screenshot Capture - צילומי מסך אוטומטיים**
צילום מסך של הדף לתיעוד:

```typescript
const screenshot: ScreenshotConfig = {
  enabled: true,
  fullPage: false,        // רק את החלק הנראה
  onlyOnChange: true,     // רק כשיש שינוי מחיר
  format: 'png',
  quality: 80             // איכות (רק ל-JPEG)
};
```

### 8. **Anti-Bot Measures - מניעת חסימות**
- **Stealth Mode** - הסתרת navigator.webdriver
- **User-Agent Rotation** - סיבוב UA
- **Custom Headers** - כותרות מותאמות
- **Cookies Management** - ניהול עוגיות
- **Viewport Randomization** - גודל מסך משתנה
- **Rate Limiting** - הגבלת קצב בקשות

## 📖 שימוש

### שימוש בסיסי

```typescript
import { getScraperEngine, ScraperEngine } from './services/scraper';

// צור תצורה
const config = ScraperEngine.createDefaultConfig(
  'https://booking.com/hotel/dan-tel-aviv.html',
  60,  // 60 ימים קדימה
  ['room_only', 'with_breakfast']
);

// צור context
const context: ScraperContext = {
  config,
  startDate: new Date(),
  hotel: {
    id: 1,
    name: 'מלון דן תל אביב',
    bookingUrl: 'https://booking.com/hotel/dan-tel-aviv.html'
  }
};

// הפעל סריקה
const engine = getScraperEngine();
const results = await engine.scrape(config, context);

console.log(`נמצאו ${results.length} תוצאות`);
```

### שימוש עם Browser Steps

```typescript
const config = ScraperEngine.createBookingComConfig(
  hotelUrl,
  60,
  true // אפשר browser steps
);

// או הוסף צעדים ידנית
config.browserSteps = [
  ...BrowserStepsExecutor.getAcceptCookiesSteps(),
  {
    type: 'click',
    selector: '#search-button',
    description: 'לחץ על כפתור חיפוש'
  }
];
```

### שימוש עם Proxy

```typescript
const config = ScraperEngine.createConfigWithProxy(
  hotelUrl,
  'brd.superproxy.io:22225',
  'brightdata',
  'your-username',
  'your-password'
);
```

### שימוש עם JSON Extraction

```typescript
const config = ScraperEngine.createConfigWithJsonExtraction(
  hotelUrl,
  '$.offers[0].price'  // JSONPath למחיר
);
```

### שימוש ב-Advanced Scan Service

```typescript
import { executeAdvancedScan } from './services/advancedScanService';

const progress = await executeAdvancedScan(configId, {
  useAdvancedScraper: true,
  enableBrowserSteps: true,
  enableProxyRotation: true,
  enableJsonExtraction: true,
  enableChangeDetection: true,
  enableScreenshots: false
});

console.log(`Scan ID: ${progress.scanId}`);
```

## 🔧 תצורה

### משתני סביבה

הוסף ל-`.env`:

```bash
# Proxy Configuration
PROXY_TYPE=brightdata           # או http, socks5, oxylabs
PROXY_URL=brd.superproxy.io:22225
PROXY_USERNAME=your-username
PROXY_PASSWORD=your-password
PROXY_COUNTRY=il                # קוד מדינה
PROXY_ROTATION_INTERVAL=10      # סובב אחרי N בקשות

# Scraper Settings
SCRAPER_DELAY_BETWEEN_REQUESTS=1000  # מילישניות
SCRAPER_CONCURRENT_REQUESTS=1        # בקשות במקביל
SCRAPER_ENABLE_SCREENSHOTS=false     # צילומי מסך
SCRAPER_ENABLE_CHANGE_DETECTION=true # גילוי שינויים
```

## 🏗️ ארכיטקטורה

```
server/services/scraper/
├── ScraperEngine.ts              # מנוע ראשי
├── types.ts                      # הגדרות טייפ
├── index.ts                      # ייצוא נקי
├── strategies/
│   └── PlaywrightStrategy.ts    # אסטרטגיית Playwright
├── utils/
│   ├── retryHandler.ts          # ניסיון חוזר חכם
│   ├── proxyManager.ts          # ניהול פרוקסים
│   ├── jsonExtractor.ts         # חילוץ JSON
│   └── browserSteps.ts          # הפעלת צעדי דפדפן
```

## 🔄 השוואה: Python Scraper vs Advanced Scraper

| תכונה | Python Scraper | Advanced Scraper |
|-------|---------------|------------------|
| **JavaScript Support** | ✅ | ✅ |
| **Browser Steps** | ❌ | ✅ |
| **Proxy Rotation** | ❌ | ✅ (Bright Data, Oxylabs) |
| **Smart Retry** | ❌ | ✅ (Exponential backoff) |
| **JSON Extraction** | ❌ | ✅ (JSONPath) |
| **Change Detection** | ❌ | ✅ |
| **Screenshots** | ❌ | ✅ |
| **Anti-Bot** | Basic | ✅ Advanced |
| **Rate Limiting** | Basic | ✅ Advanced |
| **Type Safety** | ❌ | ✅ (TypeScript) |

## 📊 ביצועים

### Python Scraper
- ⏱️ **זמן סריקה**: ~3-5 שניות לדף
- 🔄 **Retry**: לא
- 🌐 **Proxy**: לא
- 📸 **Screenshots**: לא

### Advanced Scraper
- ⏱️ **זמן סריקה**: ~2-4 שניות לדף (עם cache)
- 🔄 **Retry**: עד 5 ניסיונות עם exponential backoff
- 🌐 **Proxy**: תמיכה מלאה + rotation
- 📸 **Screenshots**: כן (אופציונלי)
- 🧠 **חכם יותר**: זיהוי bot detection, JSON extraction

## 🚦 מצבי שגיאה

המנוע מטפל בשגיאות הבאות:

1. **Network Errors**: ETIMEDOUT, ECONNREFUSED, ENOTFOUND
2. **HTTP Errors**: 408, 429, 500, 502, 503, 504
3. **Bot Detection**: Captcha, rate limiting, IP blocking
4. **Parsing Errors**: JSON parsing, selector not found
5. **Timeout Errors**: Page load timeout, selector timeout

## 🔍 Debugging

### לוגים מפורטים
```typescript
// המנוע מדפיס לוגים מפורטים:
[ScraperEngine] 🚀 STARTING SCRAPE
[PlaywrightStrategy] 📅 Processing date: 2025-12-01
[RetryHandler] Attempt 1/3 failed. Retrying in 2000ms...
[ProxyManager] Rotated to proxy 2/3
[ScraperEngine] ✅ SCRAPE COMPLETED
```

### שמירת Snapshots
כל סריקה שומרת snapshot של התוצאות ל-debugging:
```sql
SELECT * FROM scrapeSnapshots 
WHERE scanId = 123 
ORDER BY createdAt DESC;
```

## 🎯 תוכניות עתידיות

- [ ] **HTTP Strategy** - סריקה מהירה ללא דפדפן
- [ ] **Puppeteer Strategy** - אלטרנטיבה ל-Playwright
- [ ] **Visual Selector UI** - בחירת אלמנטים בקליק
- [ ] **Recording Mode** - הקלטת צעדי דפדפן מהמשתמש
- [ ] **Distributed Scraping** - סריקה מבוזרת על מספר שרתים
- [ ] **Machine Learning** - זיהוי אוטומטי של מחירים
- [ ] **Mobile Scraping** - סריקה ממכשירים ניידים

## 🤝 תרומה

הקוד פתוח להרחבה. כדי להוסיף strategy חדש:

1. צור קובץ חדש ב-`strategies/`
2. ממש את ה-interface `IFetcherStrategy`
3. רשום את ה-strategy ב-`ScraperEngine`

דוגמה:
```typescript
export class MyCustomStrategy implements IFetcherStrategy {
  name = 'my-custom' as const;
  
  async fetch(url: string, config: ScraperConfig, context: ScraperContext): Promise<ScraperResult[]> {
    // הלוגיקה שלך כאן
  }
}
```

## 📝 רישיון

MIT License - ראה LICENSE לפרטים

---

**נוצר על ידי:** Advanced Scraper Team  
**מבוסס על:** [changedetection.io](https://github.com/dgtlmoon/changedetection.io)  
**גרסה:** 1.0.0  
**עדכון אחרון:** 2025-11-21
