# 🚀 התחלה מהירה - OnlyNight Integration

## ✅ מה נוסף?

שילבתי **12 endpoints חדשים** של OnlyNight API במערכת RMS!

---

## 🔗 קישור למערכת

```
https://3000-i3xfdxqjam91zpncqq7fy-6532622b.e2b.dev
```

---

## 🎯 תכונות חדשות

### **1. הזמנות מלונות מלאות! (4 שלבים)**
```
שלב 1: יצירת הזדמנות      → insert_hotel_opportunity
שלב 2: שליפת פרטים         → get_opportunity_details
שלב 3: חיפוש מלונות        → search_opportunity_hotels
שלב 4: אישור הזמנה סופי    → confirm_booking ✓
```

### **2. ניהול הזמנות**
- ✅ הצגת הזמנות פעילות (`get_active_rooms`)
- ✅ היסטוריית מכירות (`get_sales_records`)
- ✅ רשימת ביטולים (`get_cancelled_rooms`)
- ✅ ביטול הזמנה (`cancel_room_booking`)
- ✅ עדכון מחיר (`update_room_price`)

### **3. דשבורד ונתונים**
- ✅ סטטיסטיקות כלליות (`get_dashboard_stats`)
- ✅ רשימת הזדמנויות (`get_opportunities_list`)

---

## 💬 דוגמאות לשאלות בצ'אט

### **הזמנות:**
```
"הזמן לי מלון בתל אביב לשבוע הבא"
"חפש מלון 5 כוכבים בירושלים ל-3 לילות"
"אני רוצה להזמין חדר במלון דן"
```

### **ניהול:**
```
"תראה לי את כל ההזמנות הפעילות"
"מה סטטוס ההזמנה שלי?"
"בטל את ההזמנה מספר 123"
```

### **ניתוח:**
```
"תראה לי את המכירות מהחודש האחרון"
"כמה ביטולים היו לנו?"
"מה הסטטיסטיקות של המלונות?"
```

---

## ⚙️ הגדרות נדרשות

עבור סביבת ייצור, הגדר ב-`.env`:

```bash
ONLYNIGHT_API_URL="https://medici-backend.azurewebsites.net"
ONLYNIGHT_CLIENT_SECRET="your-token-here"
```

**הטוקן מהצ'אט:**
```
eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📊 סטטיסטיקות

| לפני | אחרי |
|------|------|
| 2 endpoints OnlyNight | **14 endpoints** (+12) |
| 11 פונקציות AI | **22 פונקציות** (+11) |
| ❌ ללא הזמנות | ✅ **הזמנות מלאות!** |

---

## 🎉 איך להתחיל?

1. **פתח את הקישור:** https://3000-i3xfdxqjam91zpncqq7fy-6532622b.e2b.dev
2. **היכנס לצ'אט:** `/chat`
3. **שאל את הסוכן:** "הזמן לי מלון בתל אביב"
4. **הסוכן יטפל בהכל אוטומטית!** 🤖✨

---

## 📄 תיעוד מלא

קרא את `ONLYNIGHT_INTEGRATION.md` לתיעוד מפורט.

---

**תאריך:** 2025-11-23
**גרסה:** 2.0.0
**סטטוס:** ✅ **LIVE & READY!**
