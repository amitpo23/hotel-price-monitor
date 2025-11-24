# 🚀 מדריך Deployment מלא ל-Railway

## ✅ מה תוקן:
1. ✅ Build timeout resolved - Build מסתיים תוך ~16 שניות
2. ✅ railway.json מוכן עם פקודות build נכונות
3. ✅ .env.example מעודכן עם כל המשתנים
4. ✅ Git commits שמורים

---

## 🎯 שלבים לביצוע (עשה אתה!)

### שלב 1: צור חשבון ב-Railway
1. לך ל-https://railway.app
2. לחץ על **"Sign Up"**
3. התחבר עם **GitHub** (מומלץ!)
4. אשר גישה לrepositories שלך

---

### שלב 2: צור פרויקט חדש
1. במסך הראשי, לחץ על **"New Project"**
2. בחר **"Deploy from GitHub repo"**
3. בחר את repository: **`hotel-price-monitor`** (או השם שלך)
4. Railway יתחיל deployment אוטומטית

---

### שלב 3: הוסף MySQL Database

Railway צריך MySQL database. הנה איך:

1. בתוך הפרויקט, לחץ על **"+ New"** (בפינה הימנית למעלה)
2. בחר **"Database"**
3. בחר **"Add MySQL"**
4. Railway יצור database אוטומטית

**חשוב:** Railway אוטומטית יגדיר משתנה `DATABASE_URL` שמקושר ל-MySQL!

---

### שלב 4: הגדר משתני סביבה (Environment Variables)

לחץ על ה-service שלך (לא ה-database), ואז לחץ על טאב **"Variables"**.

הוסף את המשתנים הבאים (**העתק מ-.env שלך**):

#### משתני סביבה הכרחיים:
```env
# Database (אוטומטי מ-MySQL service)
DATABASE_URL=${{MySQL.DATABASE_URL}}

# OnlyNight API
ONLYNIGHT_API_URL=https://medici-backend.azurewebsites.net
ONLYNIGHT_CLIENT_SECRET=eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJQZXJtaXNzaW9ucyI6IjEiLCJVc2VySWQiOiIyNCIsIm5iZiI6MTc1MjEzMjc3NywiZXhwIjoyMDY3NjY1NTc3LCJpc3MiOiJodHRwczovL2FkbWluLm1lZGljaWhvdGVscy5jb20vIiwiYXVkIjoiaHR0cHM6Ly9hZG1pbi5tZWRpY2lob3RlbHMuY29tLyJ9.1cKlbn5cAHTc6n2MALkaHtBCs-gmQ5HWssF4UPyZII0

# OpenAI
OPENAI_API_KEY=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

# Server Config
NODE_ENV=production
PORT=3000

# Vite Frontend
VITE_APP_TITLE=RMS - Revenue Management System
VITE_APP_LOGO=/favicon.png
```

#### משתני סביבה אופציונליים (אם יש לך):
```env
# Authentication (אם משתמש ב-OAuth)
JWT_SECRET=your-secret-key-here
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-owner-id

# Email Reports (אם רוצה דוחות)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
DEFAULT_REPORT_EMAIL=recipient@example.com
```

**💡 טיפ:** לחץ על **"Add Variable"** לכל אחד, והדבק את הערך.

---

### שלב 5: הפעל את הdatabase migrations

אחרי שה-deployment הראשון הצליח:

**אופציה A: דרך Railway Dashboard**
1. לחץ על service שלך
2. לחץ על **"Settings"**
3. גלול ל-**"Deploy"**
4. שנה זמנית את **"Custom Start Command"** ל:
   ```bash
   pnpm db:push && pnpm start
   ```
5. Redeploy
6. אחרי שזה רץ בהצלחה, החזר את Start Command לרגיל: `pnpm start`

**אופציה B: דרך Railway CLI (מהמחשב שלך)**
```bash
# התקן CLI גלובלית
npm install -g @railway/cli

# התחבר
npx railway login

# הרץ migrations
npx railway run pnpm db:push
```

---

### שלב 6: בדוק שהכל עובד

1. לחץ על טאב **"Deployments"**
2. המתן עד שה-status יהיה **"Success"** (ירוק)
3. לחץ על ה-URL שRailway יצר (משהו כמו `your-app.up.railway.app`)
4. האתר אמור להיטען! 🎉

---

### שלב 7: בדיקות

נסה לגשת ל:
- `https://your-app.up.railway.app/` - דף הבית
- `https://your-app.up.railway.app/api/trpc/scraper.testConnection` - בדיקת API

---

## 🔍 פתרון בעיות

### Build Failed
**אם ה-build נכשל:**
1. לחץ על **"View Logs"**
2. חפש שגיאות אדומות
3. בדוק ש-`playwright install` הצליח

**פתרון נפוץ:**
- לפעמים Playwright דורש יותר memory
- לך ל-**Settings → Resources**
- העלה את Memory limit ל-**2GB**

### Database Connection Failed
**אם יש שגיאת חיבור לdatabase:**
1. וודא שהוספת MySQL service
2. וודא ש-`DATABASE_URL=${{MySQL.DATABASE_URL}}` מוגדר
3. הרץ `pnpm db:push` (ראה שלב 5)

### Application Error / 500
**אם האפליקציה לא עולה:**
1. בדוק Logs: **Deployments → View Logs**
2. חפש שגיאות JavaScript
3. וודא שכל משתני הסביבה מוגדרים

### Playwright Browser Failed
**אם Playwright לא עובד:**
```bash
# ב-nixpacks.toml (אמור להיות כבר):
[phases.setup]
nixPkgs = ["...", "playwright"]

[phases.install]
cmds = ["pnpm install", "pnpm exec playwright install --with-deps chromium"]
```

---

## 🎨 Custom Domain (אופציונלי)

רוצה domain משלך? (כמו `rms.yourdomain.com`):

1. לך ל-**Settings → Domains**
2. לחץ **"Custom Domain"**
3. הוסף את הdomain שלך
4. העתק את CNAME record ל-DNS provider שלך
5. המתן 5-10 דקות
6. Railway יגדיר SSL אוטומטית!

---

## 📊 ניטור

### צפייה ב-Logs בזמן אמת
```bash
npx railway logs
```

### Metrics
ב-Dashboard תוכל לראות:
- CPU Usage
- Memory Usage
- Network Traffic
- Request Count

---

## 💰 עלויות

Railway מציע:
- **$5 חינם** לכל חשבון לחודש (Trial Credits)
- **Pay-as-you-go** אחרי:
  - ~$0.000231/GB-minute (Memory)
  - ~$0.000463/vCPU-minute (CPU)
  
**הערכה:**
- אפליקציה קטנה: **$5-15/חודש**
- עם MySQL: **+$1-3/חודש**
- סה"כ: **~$10-20/חודש**

---

## 🔄 עדכונים עתידיים

פשוט עשה:
```bash
git add .
git commit -m "Update feature"
git push
```

Railway יעשה **auto-deploy** אוטומטית! 🚀

---

## 📞 קישורים שימושיים

- **Railway Dashboard:** https://railway.app/dashboard
- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway (תמיכה טכנית)

---

## ✅ Checklist סופי

לפני שאתה סוגר את המדריך:

- [ ] יצרתי חשבון ב-Railway
- [ ] חיברתי את GitHub repository
- [ ] הוספתי MySQL database
- [ ] הגדרתי את כל משתני הסביבה
- [ ] הרצתי `pnpm db:push`
- [ ] ה-deployment הצליח (Status: Success)
- [ ] בדקתי שהאתר עובד
- [ ] בדקתי שה-API עובד

---

## 🎉 זהו! האתר שלך LIVE!

אם הכל עבד, האתר שלך כעת פועל ב-production ב-Railway! 

**הצלחת! 🚀**

---

## 💡 טיפים אחרונים

1. **GitHub Auto-Deploy:** כל push ל-main = deployment חדש
2. **Rollback:** אם משהו נשבר, לחץ על deployment ישן ו-"Redeploy"
3. **Environment Per Branch:** אפשר ליצור staging environment מbranch אחר
4. **Logs:** תמיד בדוק logs אם משהו לא עובד

---

**יש בעיות? שאל אותי!** 😊
