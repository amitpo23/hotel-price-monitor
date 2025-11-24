# 🔍 Debug Railway Deployment

## הבעיה: Healthcheck ממשיך להיכשל

הHealthcheck נכשל כי השרת לא עונה על `http://localhost:3000/`

## 🚨 צריך לבדוק:

### 1. האם Build הצליח?
לפני ה-Healthcheck, צריך לראות אם Build עבר בהצלחה.

**איך לבדוק:**
1. ב-Railway Dashboard → **"Deployments"**
2. לחץ על deployment הנכשל
3. לחץ **"View Logs"**
4. גלול **למעלה** - חפש את שלב ה-**Build**

**מה לחפש:**
```
✅ pnpm install ... Success
✅ pnpm exec playwright install ... Success
✅ npx vite build ... Success (צריך לראות: "built in X seconds")
✅ npx esbuild ... Success (צריך לראות: "Done in Xms")
```

**אם אחד מאלה נכשל - זו הבעיה!**

---

### 2. האם השרת בכלל התחיל?

אחרי Build, צריך לראות:
```
Starting deployment...
Starting server...
Server running on http://0.0.0.0:3000/
```

**אם אין את המשפט הזה - השרת לא עלה!**

---

### 3. שגיאות אדומות?

חפש בlogs:
- ❌ `Error:`
- ❌ `Failed:`
- ❌ `Cannot find module`
- ❌ `ENOENT`
- ❌ `TypeError`

---

## 🔧 בעיות אפשריות ופתרונות:

### בעיה #1: חסרים משתני סביבה

**תסמינים:**
```
Error: Missing required environment variable: XXX
```

**פתרון:**
לך ל-Railway → Service → **Variables** → הוסף:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{MySQL.DATABASE_URL}}
OPENAI_API_KEY=sk-proj-...
ONLYNIGHT_API_URL=https://medici-backend.azurewebsites.net
ONLYNIGHT_CLIENT_SECRET=eyJhbGci...
VITE_APP_TITLE=RMS - Revenue Management System
VITE_APP_LOGO=/favicon.png
```

---

### בעיה #2: MySQL לא מחובר

**תסמינים:**
```
Error: connect ECONNREFUSED
Database connection failed
```

**פתרון:**
1. לחץ **"+ New"** → **"Database"** → **"Add MySQL"**
2. וודא ש-`DATABASE_URL=${{MySQL.DATABASE_URL}}` מוגדר בVariables

---

### בעיה #3: Build נכשל

**תסמינים:**
```
vite build ... Failed
esbuild ... Failed
```

**פתרון:**
בדוק שה-`railway.json` נכון:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm exec playwright install --with-deps chromium && npx vite build && npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  }
}
```

---

### בעיה #4: קבצים חסרים אחרי Build

**תסמינים:**
```
Could not find the build directory: dist/public
ENOENT: no such file or directory
```

**פתרון:**
הבעיה היא שvite build יוצר קבצים ב-`dist/public`, אבל esbuild יוצר `dist/index.js`.

צריך לשנות את `serveStatic` function:

```typescript
// server/_core/vite.ts
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "..", "dist", "public");
  
  if (!fs.existsSync(distPath)) {
    console.error(`Build directory not found: ${distPath}`);
    console.error(`Available files:`, fs.readdirSync(path.dirname(distPath)));
  }
  
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
```

---

### בעיה #5: Playwright דורש יותר זיכרון

**תסמינים:**
```
playwright install ... Killed
Out of memory
```

**פתרון:**
1. Railway → Service → **Settings** → **Resources**
2. העלה Memory ל-**2GB** (או יותר)
3. Redeploy

---

### בעיה #6: Port לא נכון

**תסמינים:**
```
Server running on http://localhost:3000/
(אבל Railway מצפה ל-0.0.0.0)
```

**פתרון:**
כבר תיקנתי את זה ב-commit האחרון. וודא שהקוד מ-GitHub עדכני.

---

## 📸 מה אני צריך ממך:

כדי שאוכל לעזור יותר, אני צריך **screenshot של Build Logs המלאים**:

1. Railway Dashboard
2. Deployments → בחר deployment נכשל
3. View Logs
4. **גלול למעלה לתחילת הlogs**
5. תצלם את **כל** הlog (מהתחילה עד הסוף)
6. שלח לי

---

## 🎯 Checklist מהיר:

לפני שמצלם, בדוק:

- [ ] יש MySQL database ב-Railway?
- [ ] כל משתני הסביבה מוגדרים?
- [ ] ה-commit האחרון (844e8fc) נדחף?
- [ ] Railway עשה rebuild אחרי הpush?
- [ ] Memory allocation מספיק? (לפחות 1GB, מומלץ 2GB)

---

## 💡 Quick Fix זמני

אם אתה רוצה לבדוק במהירות אם זה עובד:

שנה זמנית את `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm run build:server"
  },
  "deploy": {
    "startCommand": "NODE_ENV=development pnpm run dev",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

זה ירוץ בdevelopment mode (עם Vite dev server), לא אידיאלי אבל יעזור לזהות אם הבעיה בbuild או בשרת.

---

**שלח לי screenshots של הlogs ואני אדע בדיוק מה הבעיה!** 🔍
