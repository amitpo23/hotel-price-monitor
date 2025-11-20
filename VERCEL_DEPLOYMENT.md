# הוראות פריסה ל-Vercel

## ⚠️ הגבלות חשובות

הפרויקט הזה נבנה כ-Express server מלא עם Python scraper. Vercel מתאים יותר ל-serverless functions, ולכן יש כמה הגבלות:

1. **Python Scraper** - לא יכול לרוץ ישירות על Vercel. צריך deployment נפרד (ראה למטה)
2. **Database** - צריך database חיצוני (PlanetScale, Neon, Supabase)
3. **Timeouts** - Vercel מגביל functions ל-60 שניות (Pro plan) או 10 שניות (Hobby)

## אלטרנטיבה מומלצת: Railway

אם אתה רוצה פתרון פשוט יותר שתומך בכל הפיצ'רים (Node + Python + MySQL), מומלץ להשתמש ב-**Railway** או **Render** במקום Vercel.

---

## שלב 1: הכנת Database

בחר אחד מהשירותים הבאים:

### אפשרות A: PlanetScale (MySQL מנוהל)
1. צור חשבון ב-https://planetscale.com
2. צור database חדש
3. קבל את ה-DATABASE_URL
4. הרץ migrations:
```bash
pnpm db:push
```

### אפשרות B: Neon (PostgreSQL מנוהל)
1. צור חשבון ב-https://neon.tech
2. צור database חדש
3. קבל את ה-DATABASE_URL
4. **שים לב**: תצטרך לשנות את הקוד ל-PostgreSQL במקום MySQL

### אפשרות C: Supabase (PostgreSQL + תכונות נוספות)
1. צור חשבון ב-https://supabase.com
2. צור project חדש
3. קבל את ה-DATABASE_URL
4. **שים לב**: תצטרך לשנות את הקוד ל-PostgreSQL במקום MySQL

---

## שלב 2: פריסת Python Scraper (חובה!)

ה-Python scraper צריך להיות deployed בנפרד. הנה שתי אפשרויות:

### אפשרות A: Railway (מומלץ)

1. צור חשבון ב-https://railway.app
2. צור project חדש
3. צור את הקובץ `api/scraper.py`:

```python
from flask import Flask, request, jsonify
import sys
sys.path.append('..')
from scraper_v5 import run_scraper

app = Flask(__name__)

@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.json
    results = run_scraper(
        target_hotel_url=data['target_hotel_url'],
        competitor_urls=data['competitor_urls'],
        check_in_date=data['check_in_date'],
        check_out_date=data['check_out_date'],
        adults=data['adults']
    )
    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
```

4. צור `requirements.txt`:
```txt
flask
playwright
beautifulsoup4
```

5. צור `Procfile`:
```
web: python -m playwright install && python api/scraper.py
```

6. Deploy ל-Railway
7. שמור את ה-URL שקיבלת

### אפשרות B: Render

דומה ל-Railway, פשוט צור Web Service חדש ב-Render.

---

## שלב 3: פריסה ל-Vercel

### 3.1 התקנת Vercel CLI

```bash
npm i -g vercel
```

### 3.2 התחברות ל-Vercel

```bash
vercel login
```

### 3.3 הגדרת משתני סביבה

צור קובץ `.env.production` מקומי (לא ל-commit!):

```bash
cp .env.example .env.production
```

ערוך את הקובץ עם הערכים האמיתיים שלך:

```env
DATABASE_URL="mysql://..."  # מה-PlanetScale/Neon
JWT_SECRET="..."
OAUTH_SERVER_URL="..."
OWNER_OPEN_ID="..."
VITE_APP_ID="..."
GMAIL_USER="..."
GMAIL_APP_PASSWORD="..."
DEFAULT_REPORT_EMAIL="..."
SCRAPER_API_URL="https://your-railway-app.up.railway.app"  # מ-Railway
NODE_ENV="production"
```

### 3.4 הוספת משתני סביבה ל-Vercel

```bash
# דרך 1: דרך ה-CLI (אינטראקטיבי)
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add OAUTH_SERVER_URL
vercel env add OWNER_OPEN_ID
vercel env add VITE_APP_ID
vercel env add GMAIL_USER
vercel env add GMAIL_APP_PASSWORD
vercel env add DEFAULT_REPORT_EMAIL
vercel env add SCRAPER_API_URL

# דרך 2: דרך ה-Dashboard
# לך ל-https://vercel.com/your-project/settings/environment-variables
```

### 3.5 Deploy

```bash
# Deploy לפרודקשן
vercel --prod

# או פשוט
vercel
```

---

## שלב 4: עדכון קוד ל-Scraper API

אתה צריך לעדכן את הקוד שקורא ל-Python scraper להשתמש ב-API במקום להריץ אותו לוקלית.

מצא את הקובץ שמריץ את ה-scraper (כנראה `server/services/scanService.ts` או דומה) ועדכן אותו:

```typescript
// במקום להריץ את ה-Python script ישירות
const response = await fetch(process.env.SCRAPER_API_URL + '/scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target_hotel_url: scanConfig.targetHotelUrl,
    competitor_urls: competitors.map(c => c.url),
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    adults: scanConfig.adults
  })
});

const results = await response.json();
```

---

## שלב 5: בדיקה

1. פתח את הקישור שקיבלת מ-Vercel
2. נסה להתחבר
3. צור scan configuration חדש
4. הרץ scan ובדוק שהכל עובד

---

## פתרון בעיות נפוצות

### שגיאת Database Connection
- וודא ש-DATABASE_URL נכון
- בדוק שה-database נגיש מהאינטרנט
- הרץ migrations: `pnpm db:push`

### שגיאת Python Scraper
- וודא שה-SCRAPER_API_URL נכון
- בדוק שה-Railway/Render service רץ
- בדוק logs ב-Railway/Render dashboard

### Timeout Errors
- Vercel מגביל functions ל-60 שניות (Pro) או 10 שניות (Hobby)
- אם ה-scan לוקח זמן רב, שקול:
  - לשדרג ל-Vercel Pro
  - להשתמש ב-Railway/Render במקום

### Build Errors
- וודא שיש לך `pnpm` מותקן
- הרץ `pnpm install` לוקלית ובדוק שהכל עובד
- בדוק את build logs ב-Vercel dashboard

---

## קישורים מועילים

- [Vercel Documentation](https://vercel.com/docs)
- [PlanetScale Documentation](https://planetscale.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Neon Documentation](https://neon.tech/docs)

---

## אלטרנטיבה: Railway (פשוט יותר!)

אם כל זה נראה מסובך מדי, Railway תומך בכל הפרויקט (Node + Python + MySQL) באותו מקום:

1. צור חשבון ב-https://railway.app
2. לחץ על "New Project"
3. בחר "Deploy from GitHub repo"
4. בחר את הפרויקט שלך
5. הוסף MySQL database (Add Service -> Database -> MySQL)
6. הגדר משתני סביבה
7. Deploy!

Railway יטפל בהכל אוטומטית ואין צורך בהגדרות מיוחדות.
