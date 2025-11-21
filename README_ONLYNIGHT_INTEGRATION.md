# 🔗 OnlyNight API Integration

## סיכום

המערכת עכשיו משולבת עם **OnlyNight API** לחיפוש מחירים בזמן אמת ושליפת נתוני ארכיון היסטוריים.

---

## 🆕 יכולות חדשות לצ'אט AI

### **1. חיפוש מחירים בזמן אמת** 🔍

הצ'אט AI יכול עכשיו לחפש מחירי מלונות **live** מה-API של OnlyNight.

#### דוגמאות שאילתות:
```
🔹 "חפש לי מלונות בתל אביב מ-25.12.2024 עד 28.12.2024"
🔹 "מה המחיר הכי זול למלון בירושלים בסופ"ש הבא?"
🔹 "תן לי רשימת מלונות 5 כוכבים באילת ל-2 אנשים"
🔹 "חפש מלונות זולים (מתחת ל-500 ש"ח) בחיפה"
```

#### מה קורה מאחורי הקלעים:
1. AI מזהה שאתה רוצה חיפוש real-time
2. קורא ל-`search_instant_prices` function
3. OnlyNight API מחזיר תוצאות live
4. AI מעבד ומציג בצורה נוחה

#### תגובה דוגמה:
```
מצאתי 12 מלונות זמינים בתל אביב:

1. מלון דן פנורמה
   מחיר: ILS 890
   סוג חדר: Deluxe
   ארוחות: BB (ארוחת בוקר)

2. מלון הרברט סמואל
   מחיר: ILS 720
   סוג חדר: Standard
   ארוחות: RO (חדר בלבד)

...
```

---

### **2. שליפת נתוני ארכיון** 📦

הצ'אט AI יכול לשלוף נתונים **היסטוריים** מהארכיון של OnlyNight.

#### דוגמאות שאילתות:
```
🔹 "תראה לי מה היו המחירים בינואר 2024"
🔹 "כמה הזמנות היו למלון דן בחודש האחרון?"
🔹 "מה היה המחיר הממוצע של מלונות 4 כוכבים באילת בסוכות?"
🔹 "תן לי היסטוריה של הזמנות בטווח מחירים 300-600 ש"ח"
```

#### מה קורה מאחורי הקלעים:
1. AI מזהה שאתה רוצה נתונים היסטוריים
2. קורא ל-`get_room_archive` function
3. OnlyNight API מחזיר רשומות מהארכיון
4. AI מנתח ומציג insights

#### תגובה דוגמה:
```
נמצאו 47 רשומות בארכיון לינואר 2024:

1. מלון דן אילת
   תאריכים: 2024-01-15 - 2024-01-18
   מחיר: ₪1,250
   ארוחות: HB (חצי פנסיון)

2. מלון רימונים אילת
   תאריכים: 2024-01-20 - 2024-01-22
   מחיר: ₪880
   ארוחות: BB

ממוצע מחיר: ₪965
מחיר מינימום: ₪680
מחיר מקסימום: ₪1,450
```

---

## 🔧 **הגדרת סביבת עבודה**

### שלב 1: הוספת API Credentials

ערוך את קובץ `.env`:

```bash
# OnlyNight API Configuration
ONLYNIGHT_API_URL="https://api.onlynight.com"
ONLYNIGHT_CLIENT_SECRET="your-actual-secret-here"
```

**⚠️ חשוב:** החלף את `your-actual-secret-here` במפתח האמיתי שקיבלת מ-OnlyNight!

### שלב 2: אימות החיבור

הפעל את השרת ובדוק שאין שגיאות:

```bash
npm run dev
```

חפש בלוג:
```
[OnlyNight API] 🔐 Authenticating...
[OnlyNight API] ✅ Authentication successful
```

---

## 📡 **API Endpoints שמשתמשים**

### 1. Authentication
```
POST /api/auth/OnlyNightUsersTokenAPI
Content-Type: multipart/form-data

Body:
  client_secret: "your-secret"

Response:
  { token: "jwt-token-here" }
```

### 2. Search Instant Prices
```
POST /api/hotels/GetInnstantSearchPrice
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "dateFrom": "2024-12-25",
  "dateTo": "2024-12-28",
  "hotelName": "Dan",
  "city": "Tel Aviv",
  "adults": 2,
  "paxChildren": [],
  "stars": 5,
  "limit": 50
}

Response:
{
  "results": [
    {
      "hotelName": "Dan Panorama",
      "price": { "amount": 890, "currency": "ILS" },
      "category": "Deluxe",
      "roomBasis": "BB",
      ...
    }
  ]
}
```

### 3. Get Room Archive Data
```
POST /api/hotels/GetRoomArchiveData
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "stayFrom": "2024-01-01T00:00:00Z",
  "stayTo": "2024-01-31T23:59:59Z",
  "hotelName": "Dan",
  "city": "Eilat",
  "minPrice": 300,
  "maxPrice": 1000,
  "pageNumber": 1,
  "pageSize": 50
}

Response:
{
  "items": [
    {
      "hotelName": "Dan Eilat",
      "checkInDate": "2024-01-15",
      "checkOutDate": "2024-01-18",
      "price": 1250,
      "roomBoard": "HB",
      ...
    }
  ],
  "totalItems": 47
}
```

---

## 🧪 **בדיקות ידניות**

### בדיקה 1: חיפוש מחירים
```
1. פתח http://localhost:3000/ai-chat
2. צור שיחה חדשה
3. שאל: "חפש לי מלונות בתל אביב מה-25 עד ה-28 בדצמבר"
4. המתן לתגובה (20-30 שניות)
5. ודא שמקבל רשימת מלונות עם מחירים
```

### בדיקה 2: נתוני ארכיון
```
1. שאל: "תן לי היסטוריה של מלונות בינואר 2024"
2. המתן לתגובה
3. ודא שמקבל רשומות היסטוריות
```

### בדיקה 3: שאילתות משולבות
```
1. שאל: "השווה בין המחיר הנוכחי למחיר ההיסטורי של מלון דן"
2. AI אמור לקרוא גם ל-search_instant_prices וגם ל-get_room_archive
3. ודא שמקבל השוואה מלאה
```

---

## 🐛 **פתרון בעיות**

### שגיאה: "Failed to authenticate with OnlyNight API"
```
❌ בעיה: Client secret לא נכון או API לא זמין

✅ פתרון:
1. בדוק ש-ONLYNIGHT_CLIENT_SECRET נכון ב-.env
2. ודא שה-API URL נכון
3. בדוק שיש חיבור לאינטרנט
4. נסה להריץ מחדש את השרת
```

### שגיאה: "No results found"
```
❌ בעיה: API לא מצא תוצאות לשאילתה

✅ פתרון:
1. בדוק שהתאריכים תקינים (YYYY-MM-DD)
2. נסה שאילתה רחבה יותר (בלי סינון מלון ספציפי)
3. בדוק שהתאריכים הם בעתיד
```

### שגיאה: "Timeout"
```
❌ בעיה: API לוקח יותר מדי זמן להגיב

✅ פתרון:
1. OnlyNight API יכול לקחת 20-30 שניות
2. זה נורמלי - המתן בסבלנות
3. אם עדיין timeout - בדוק את החיבור
```

---

## 🎯 **תרחישי שימוש מומלצים**

### תרחיש 1: תכנון מבצע
```
"חפש לי מלונות זולים בחיפה לחנוכה"
→ AI מחפש real-time
→ מקבל רשימת אופציות
→ יכול להמליץ על תמחור תחרותי
```

### תרחיש 2: ניתוח מתחרים
```
"מה היו המחירים של Hilton בחודש שעבר?"
→ AI שולף מהארכיון
→ מנתח מגמות
→ משווה למצב הנוכחי
```

### תרחיש 3: תובנות עסקיות
```
"מה היו המחירים הממוצעים בפסח 2024?"
→ AI שואל ארכיון
→ מחשב סטטיסטיקות
→ מציע אסטרטגיית תמחור לפסח הבא
```

---

## 📚 **API Reference**

### OnlyNightApiService Methods

#### `searchInstantPrices(params)`
חיפוש מחירים בזמן אמת.

**Parameters:**
- `dateFrom` (required): תאריך כניסה (YYYY-MM-DD)
- `dateTo` (required): תאריך יציאה (YYYY-MM-DD)
- `hotelName` (optional): שם מלון
- `city` (optional): עיר
- `adults` (optional): מספר מבוגרים (default: 2)
- `paxChildren` (optional): מערך גילאי ילדים
- `stars` (optional): דירוג כוכבים (1-5)
- `limit` (optional): מספר תוצאות מקסימלי (default: 50)

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    results: Array<{
      hotelName: string;
      price: { amount: number; currency: string };
      category: string;
      roomBasis: string;
      ...
    }>;
  };
  error?: string;
}
```

#### `getRoomArchiveData(params)`
שליפת נתוני ארכיון.

**Parameters:**
- `stayFrom` (optional): תחילת טווח תאריכים
- `stayTo` (optional): סוף טווח תאריכים
- `hotelName` (optional): שם מלון
- `city` (optional): עיר
- `minPrice` (optional): מחיר מינימום
- `maxPrice` (optional): מחיר מקסימום
- `roomBoard` (optional): סוג ארוחה
- `roomCategory` (optional): קטגוריית חדר
- `pageNumber` (optional): מספר עמוד (default: 1)
- `pageSize` (optional): תוצאות לעמוד (default: 50)

**Returns:**
```typescript
{
  success: boolean;
  data?: {
    items: Array<{
      hotelName: string;
      checkInDate: string;
      checkOutDate: string;
      price: number;
      roomBoard: string;
      ...
    }>;
    totalItems: number;
  };
  error?: string;
}
```

---

## 🔒 **אבטחה**

1. **Token Management:**
   - Token מתחדש אוטומטית אחרי תפוגה (401)
   - Singleton instance - חיבור אחד בלבד
   - Token נשמר בזיכרון (לא בדיסק)

2. **Rate Limiting:**
   - OnlyNight API יכול להגביל קריאות
   - השרת מטפל בזה אוטומטית
   - אם נדרש - חכה כמה שניות ונסה שוב

3. **Secrets:**
   - **לעולם אל תשלח client_secret ללקוח**
   - רק השרת עושה קריאות ל-API
   - ה-frontend רק מדבר עם tRPC

---

## ✅ **סטטוס השילוב**

- ✅ OnlyNightApiService נוצר
- ✅ Authentication אוטומטי
- ✅ Function: search_instant_prices
- ✅ Function: get_room_archive
- ✅ AI Router מעודכן
- ✅ טיפול בשגיאות
- ✅ Retry logic
- ✅ תיעוד מלא

---

## 🚀 **השימוש הבא**

הצ'אט AI שלך עכשיו יותר חזק:
- חיפוש real-time ב-OnlyNight
- גישה לנתונים היסטוריים
- יכולת לענות על שאלות מורכבות יותר
- משולב עם המערכת הקיימת

**פשוט תשאל אותו שאלות והוא יבחר אוטומטית איזה API להשתמש!** 🎉
