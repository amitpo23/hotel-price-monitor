# Railway - הדרכה מהירה (5 דקות!)

## צעד 1: פתח חשבון ב-Railway

1. לך ל-**https://railway.app**
2. לחץ **"Login"**
3. בחר **"Login with GitHub"**
4. אשר גישה ל-GitHub

---

## צעד 2: צור פרויקט חדש

1. לחץ על **"New Project"**
2. בחר **"Deploy from GitHub repo"**
3. חפש ובחר את **`hotel-price-monitor`**
4. Railway יתחיל ליצור את הפרויקט אוטומטית

---

## צעד 3: הוסף MySQL Database

1. בתוך הפרויקט, לחץ על **"+ New"** (בפינה הימנית העליונה)
2. בחר **"Database"**
3. בחר **"Add MySQL"**
4. Railway יצור database ויחבר אותו אוטומטית ל-service שלך

---

## צעד 4: הגדר משתני סביבה

1. לחץ על ה-**service** שלך (לא על ה-MySQL)
2. לך ל-**"Variables"**
3. לחץ **"+ New Variable"** והוסף את המשתנים הבאים:

```
JWT_SECRET=your-super-secret-key-change-this-now
VITE_APP_ID=hotel-price-monitor
NODE_ENV=production
DEFAULT_REPORT_EMAIL=your-email@gmail.com
```

### אופציונלי - הגדרות Email (לדוחות):
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-specific-password
```

💡 **טיפ**: `DATABASE_URL` כבר מוגדר אוטומטית מה-MySQL service!

---

## צעד 5: Deploy!

1. Railway יעשה deploy אוטומטית אחרי שהוספת את המשתנים
2. אם לא, לחץ על **"Deploy"** בפינה הימנית העליונה
3. המתן 2-3 דקות (התקנת Playwright לוקחת זמן)
4. בדוק את ה-**Logs** כדי לראות את ההתקדמות

---

## צעד 6: קבל את הקישור שלך!

1. לחץ על **"Settings"**
2. גלול ל-**"Domains"**
3. לחץ **"Generate Domain"**
4. תקבל קישור כמו: **`https://hotel-price-monitor-production.up.railway.app`**

---

## צעד 7: הרץ Migrations (רק פעם אחת!)

לאחר ה-deployment הראשון:

1. לחץ על ה-service שלך
2. לך ל-**"Variables"**
3. הוסף משתנה זמני: `RUN_MIGRATIONS=true`
4. לחץ **"Redeploy"**
5. אחרי שה-deployment הצליח, **מחק** את המשתנה `RUN_MIGRATIONS`

או דרך CLI (אם יש לך):
```bash
railway run pnpm db:push
```

---

## בעיות נפוצות

### Build נכשל?
- בדוק את ה-**Logs** לשגיאות
- וודא שכל משתני הסביבה מוגדרים
- נסה **"Redeploy"**

### Playwright לא עובד?
- וודא ש-`nixpacks.toml` קיים בפרויקט
- Railway צריך להתקין את Chromium אוטומטית
- בדוק ב-Logs שיש: "Installing Chromium"

### Database Connection Failed?
- וודא שהוספת MySQL service
- בדוק שה-`DATABASE_URL` מוגדר אוטומטית
- נסה להוסיף אותו ידנית: `${{MySQL.DATABASE_URL}}`

---

## עלויות

- **$5 חינם לחודש** (קרדיט)
- לאחר מכן: **~$5-15/חודש** (תלוי בשימוש)
- MySQL כלול בחינם (עד 1GB)

---

## מה הלאה?

1. **פתח את הקישור** שקיבלת
2. **צור חשבון משתמש** במערכת
3. **הוסף מלונות** ותתחיל לעקוב אחרי מחירים!
4. **הגדר סריקות תקופתיות** לקבלת דוחות במייל

---

## עדכונים עתידיים

כל שינוי שאתה עושה ו-push ל-GitHub יעשה **auto-deploy** אוטומטית! 🚀

```bash
git add .
git commit -m "Update something"
git push
```

Railway יזהה את השינוי ויעשה deploy מחדש!

---

## קישורים מועילים

- [Railway Docs](https://docs.railway.app)
- [Railway Dashboard](https://railway.app/dashboard)
- [Support/Community](https://discord.gg/railway)

---

## צריך עזרה?

אם משהו לא עובד, בדוק את:
1. **Logs** ב-Railway (לחץ על deployment → View Logs)
2. הקובץ `RAILWAY_DEPLOYMENT.md` למדריך מלא
3. Discord של Railway לתמיכה

בהצלחה! 🎉
