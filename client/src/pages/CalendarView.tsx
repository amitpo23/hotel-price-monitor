import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface PriceData {
  date: string;
  price: number | null;
  competitorAvgPrice: number | null;
  isCompetitive: boolean;
  priceGap: number;
  availability: boolean;
}

export default function CalendarView() {
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<"room_only" | "with_breakfast">("room_only");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [showCompetitors, setShowCompetitors] = useState(true);

  const utils = trpc.useUtils();

  // Queries
  const hotelsQuery = trpc.hotels.list.useQuery();
  const calendarDataQuery = trpc.calendar.getMonthData.useQuery(
    {
      hotelId: selectedHotelId!,
      month: currentMonth.toISOString().slice(0, 7), // YYYY-MM
      roomType: selectedRoomType,
    },
    { enabled: !!selectedHotelId }
  );

  // Mutations
  const updatePrice = trpc.calendar.updatePrice.useMutation({
    onSuccess: () => {
      utils.calendar.getMonthData.invalidate();
      setEditingDate(null);
      toast.success("המחיר עודכן בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בעדכון המחיר: " + error.message);
    },
  });

  const bulkCopyPrices = trpc.calendar.bulkCopyPrices.useMutation({
    onSuccess: () => {
      utils.calendar.getMonthData.invalidate();
      toast.success("המחירים הועתקו בהצלחה");
    },
  });

  // Auto-select first hotel
  if (!selectedHotelId && hotelsQuery.data && hotelsQuery.data.length > 0) {
    const targetHotel = hotelsQuery.data.find((h: any) => h.category === "target");
    setSelectedHotelId(targetHotel?.id || hotelsQuery.data[0].id);
  }

  // Calendar generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  }, [currentMonth]);

  const getPriceData = (date: Date | null): PriceData | null => {
    if (!date || !calendarDataQuery.data) return null;
    
    const dateStr = date.toISOString().split("T")[0];
    const dayData = calendarDataQuery.data.find((d: any) => d.date === dateStr);
    
    if (!dayData) return null;
    
    return {
      date: dateStr,
      price: dayData.price,
      competitorAvgPrice: dayData.competitorAvgPrice,
      isCompetitive: dayData.isCompetitive,
      priceGap: dayData.priceGap,
      availability: dayData.availability,
    };
  };

  const getPriceColor = (priceData: PriceData | null): string => {
    if (!priceData || !priceData.price) return "bg-gray-100 dark:bg-gray-800";
    
    if (!priceData.competitorAvgPrice) return "bg-blue-100 dark:bg-blue-900";
    
    const gap = priceData.priceGap;
    
    // Green: competitive (within 5% or cheaper)
    if (gap <= 5) return "bg-green-100 dark:bg-green-900 border-green-500";
    
    // Yellow: slightly expensive (5-15%)
    if (gap <= 15) return "bg-yellow-100 dark:bg-yellow-900 border-yellow-500";
    
    // Red: expensive (>15%)
    return "bg-red-100 dark:bg-red-900 border-red-500";
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleEditPrice = (date: string, currentPrice: number | null) => {
    setEditingDate(date);
    setEditPrice(currentPrice ? (currentPrice / 100).toFixed(2) : "");
  };

  const handleSavePrice = () => {
    if (!editingDate || !selectedHotelId) return;
    
    const priceInCents = Math.round(parseFloat(editPrice) * 100);
    
    updatePrice.mutate({
      hotelId: selectedHotelId,
      date: editingDate,
      roomType: selectedRoomType,
      price: priceInCents,
    });
  };

  const handleCopyWeek = (startDate: Date) => {
    if (!selectedHotelId) return;
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    bulkCopyPrices.mutate({
      hotelId: selectedHotelId,
      sourceDate: startDate.toISOString().split("T")[0],
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      roomType: selectedRoomType,
    });
  };

  const monthName = currentMonth.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">תצוגת לוח שנה</h1>
          <p className="text-muted-foreground">ניהול מחירים ויזואלי לפי תאריכים</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינונים</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>מלון</Label>
            <Select
              value={selectedHotelId?.toString()}
              onValueChange={(value) => setSelectedHotelId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר מלון" />
              </SelectTrigger>
              <SelectContent>
                {hotelsQuery.data?.map((hotel: any) => (
                  <SelectItem key={hotel.id} value={hotel.id.toString()}>
                    {hotel.name} {hotel.category === "target" && "⭐"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label>סוג חדר</Label>
            <Select value={selectedRoomType} onValueChange={(value: any) => setSelectedRoomType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room_only">חדר בלבד</SelectItem>
                <SelectItem value="with_breakfast">כולל ארוחת בוקר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant={showCompetitors ? "default" : "outline"}
              onClick={() => setShowCompetitors(!showCompetitors)}
            >
              {showCompetitors ? "הסתר מתחרים" : "הצג מתחרים"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {monthName}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">תחרותי (&lt;5%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm">יקר מעט (5-15%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm">יקר (&gt;15%)</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map((day) => (
              <div key={day} className="text-center font-semibold text-sm p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square"></div>;
              }

              const priceData = getPriceData(date);
              const colorClass = getPriceColor(priceData);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={date.toISOString()}
                  className={`
                    aspect-square border-2 rounded-lg p-2 relative cursor-pointer
                    hover:shadow-lg transition-all
                    ${colorClass}
                    ${isToday ? "ring-2 ring-blue-500" : ""}
                  `}
                  onClick={() => priceData && handleEditPrice(priceData.date, priceData.price)}
                >
                  <div className="text-sm font-semibold">{date.getDate()}</div>
                  
                  {priceData && priceData.price && (
                    <div className="mt-1">
                      <div className="text-lg font-bold">₪{(priceData.price / 100).toFixed(0)}</div>
                      
                      {showCompetitors && priceData.competitorAvgPrice && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            {priceData.priceGap > 0 ? (
                              <TrendingUp className="w-3 h-3 text-red-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-green-500" />
                            )}
                            <span>₪{(priceData.competitorAvgPrice / 100).toFixed(0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!priceData?.price && (
                    <div className="text-xs text-muted-foreground mt-1">
                      לא הוגדר
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 left-1 h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      priceData && handleEditPrice(priceData.date, priceData.price);
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Price Dialog */}
      <Dialog open={!!editingDate} onOpenChange={() => setEditingDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת מחיר</DialogTitle>
            <DialogDescription>
              עדכן את המחיר לתאריך {editingDate}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="price">מחיר (₪)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="הכנס מחיר"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDate(null)}>
              ביטול
            </Button>
            <Button onClick={handleSavePrice} disabled={updatePrice.isPending}>
              {updatePrice.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
