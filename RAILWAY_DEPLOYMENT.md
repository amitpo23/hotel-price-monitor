# הוראות פריסה ל-Railway (מומלץ!)

Railway הוא הפתרון הכי פשוט ומהיר לפרויקט הזה כי הוא תומך ב:
- ✅ Node.js + Python באותו פרויקט
- ✅ MySQL מובנה
- ✅ Long-running servers
- ✅ WebSockets (אם צריך בעתיד)
- ✅ No timeouts (בניגוד ל-Vercel)

---

## שלב 1: הכנה

1. צור חשבון ב-https://railway.app
2. התחבר עם GitHub
3. וודא שהפרויקט שלך ב-GitHub

---

## שלב 2: יצירת פרויקט

1. לחץ על **"New Project"**
2. בחר **"Deploy from GitHub repo"**
3. אשר גישה ל-GitHub (אם צריך)
4. בחר את repository: `hotel-price-monitor`
5. Railway יזהה אוטומטית שזה Node.js project

---

## שלב 3: הוספת MySQL Database

1. בתוך הפרויקט, לחץ על **"+ New"**
2. בחר **"Database"**
3. בחר **"Add MySQL"**
4. Railway יצור database ויגדיר אוטומטית את `DATABASE_URL`

---

## שלב 4: הגדרת משתני סביבה

לחץ על service שלך ואז **"Variables"**:

```env
DATABASE_URL=${{MySQL.DATABASE_URL}}  # אוטומטי מה-MySQL service
JWT_SECRET=your-secret-key-change-this
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-owner-open-id
VITE_APP_ID=your-app-id
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
DEFAULT_REPORT_EMAIL=recipient@example.com
NODE_ENV=production
PORT=3000
```

💡 **טיפ**: Railway ממפה אוטומטית את `DATABASE_URL` מה-MySQL service!

---

## שלב 5: הגדרת Build

Railway יריץ אוטומטית:
```bash
pnpm install
pnpm build
```

ואז יריץ:
```bash
pnpm start
```

אם צריך התאמות, תוכל להוסיף `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## שלב 6: התקנת Playwright Dependencies

Railway צריך להתקין את Playwright browsers. צור קובץ `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["...", "playwright"]

[phases.install]
cmds = ["pnpm install", "pnpm exec playwright install --with-deps chromium"]

[phases.build]
cmds = ["pnpm build"]

[start]
cmd = "pnpm start"
```

---

## שלב 7: הרצת Migrations

לאחר ש-Database מוכן:

1. לחץ על service שלך
2. לחץ על **"Settings"** -> **"Deploy"**
3. הוסף Custom Start Command (זמני):
```bash
pnpm db:push && pnpm start
```

או הרץ לוקלית:
```bash
# התחבר ל-Railway database
railway run pnpm db:push
```

---

## שלב 8: Deploy!

1. לחץ **"Deploy"** או פשוט push ל-GitHub
2. Railway יבנה וי-deploy אוטומטית
3. קבל URL ציבורי: `your-app.up.railway.app`

---

## שלב 9: הגדרת Domain (אופציונלי)

1. לחץ על **"Settings"** -> **"Domains"**
2. לחץ **"Generate Domain"** או הוסף custom domain
3. Railway יגדיר אוטומטית SSL

---

## ניטור ו-Logs

### צפייה ב-Logs בזמן אמת
```bash
# התקן Railway CLI
npm i -g @railway/cli

# התחבר
railway login

# צפה ב-logs
railway logs
```

או ב-Dashboard: לחץ על service -> **"Deployments"** -> בחר deployment -> **"View Logs"**

---

## עדכונים עתידיים

פשוט תעשה push ל-GitHub:
```bash
git add .
git commit -m "Update feature"
git push
```

Railway יעשה auto-deploy!

---

## עלויות

Railway מציע:
- **$5 חינם** לחודש לכל משתמש
- לאחר מכן: **Pay-as-you-go** (~$5-20/חודש לאפליקציה קטנה)
- MySQL Database: כלול בחינם (עד 1GB)

---

## פתרון בעיות

### Python Scraper לא עובד
בדוק שהתקנת את Playwright dependencies:
```bash
railway run pnpm exec playwright install --with-deps chromium
```

### Database Connection Failed
וודא שהוספת את MySQL service ושה-`DATABASE_URL` מוגדר

### Build Timeout
הגדל את memory/resources ב-Settings -> Resources

---

## השוואה: Railway vs Vercel

| תכונה | Railway | Vercel |
|-------|---------|--------|
| Node.js Server | ✅ מלא | ⚠️ Serverless בלבד |
| Python Support | ✅ מובנה | ⚠️ מוגבל |
| MySQL | ✅ מובנה | ❌ צריך חיצוני |
| Long-running tasks | ✅ | ❌ Max 60s |
| WebSockets | ✅ | ❌ |
| Auto SSL | ✅ | ✅ |
| GitHub Integration | ✅ | ✅ |
| מחיר | $5-20/חודש | $0-20/חודש |

**המלצה**: Railway מתאים יותר לפרויקט הזה!

---

## קישורים

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Railway Templates](https://railway.app/templates)
