import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Bell,
  Lightbulb,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";

export default function PricingDashboard() {
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<"room_only" | "with_breakfast">("room_only");

  // Queries
  const scanConfigsQuery = trpc.scans.configs.list.useQuery();
  const recommendationsQuery = trpc.pricing.getRecommendations.useQuery(
    { scanConfigId: selectedConfigId!, roomType: selectedRoomType },
    { enabled: !!selectedConfigId }
  );
  const marketAnalysisQuery = trpc.pricing.getMarketAnalysis.useQuery(
    { scanConfigId: selectedConfigId! },
    { enabled: !!selectedConfigId }
  );
  const alertsQuery = trpc.pricing.getAlerts.useQuery({ unreadOnly: false });

  // Mutations
  const markAlertRead = trpc.pricing.markAlertRead.useMutation({
    onSuccess: () => {
      trpc.useUtils().pricing.getAlerts.invalidate();
    },
  });

  const deleteAlert = trpc.pricing.deleteAlert.useMutation({
    onSuccess: () => {
      trpc.useUtils().pricing.getAlerts.invalidate();
    },
  });

  // Auto-select first config
  if (!selectedConfigId && scanConfigsQuery.data && scanConfigsQuery.data.length > 0) {
    setSelectedConfigId(scanConfigsQuery.data[0].id);
  }

  const recommendations = recommendationsQuery.data?.recommendations || [];
  const summary = recommendationsQuery.data?.summary;
  const marketAnalysis = marketAnalysisQuery.data;
  const alerts = alertsQuery.data || [];

  // Prepare chart data for price recommendations
  const chartData = recommendations.slice(0, 30).map(r => ({
    date: new Date(r.date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }),
    current: r.currentPrice || 0,
    recommended: r.recommendedPrice,
    competitor: r.competitorAvgPrice,
  }));

  // Prepare scatter chart data for market positioning
  const scatterData = marketAnalysis?.hotelAnalysis.map((h: any, idx: number) => ({
    name: h.hotelName,
    price: h.avgPrice,
    quality: 100 - (idx * 10), // Mock quality score
    category: h.category,
  })) || [];

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getMarketPositionBadge = (position: string) => {
    const variants: Record<string, any> = {
      below_market: { variant: "secondary", label: "מתחת לשוק" },
      competitive: { variant: "default", label: "תחרותי" },
      premium: { variant: "destructive", label: "פרימיום" },
    };
    const config = variants[position] || variants.competitive;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">דשבורד תמחור אינטליגנטי</h1>
          <p className="text-muted-foreground">
            המלצות תמחור מבוססות AI, ניתוח שוק, והתראות בזמן אמת
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedRoomType} onValueChange={(v: any) => setSelectedRoomType(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="room_only">חדר בלבד</SelectItem>
              <SelectItem value="with_breakfast">עם ארוחת בוקר</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedConfigId?.toString() || ""}
            onValueChange={(v) => setSelectedConfigId(parseInt(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="בחר קונפיגורציה" />
            </SelectTrigger>
            <SelectContent>
              {scanConfigsQuery.data?.map((config: { id: number; name: string }) => (
                <SelectItem key={config.id} value={config.id.toString()}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              recommendationsQuery.refetch();
              marketAnalysisQuery.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סה"כ המלצות</p>
                <h3 className="text-2xl font-bold">{summary.totalRecommendations}</h3>
              </div>
              <Lightbulb className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ביטחון ממוצע</p>
                <h3 className="text-2xl font-bold">{summary.averageConfidence}%</h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">הזדמנויות העלאת מחיר</p>
                <h3 className="text-2xl font-bold text-green-600">
                  {summary.priceIncreaseOpportunities}
                </h3>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">רווח פוטנציאלי</p>
                <h3 className="text-2xl font-bold text-green-600">
                  ₪{summary.potentialRevenueIncrease.toLocaleString()}
                </h3>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recommendations List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              המלצות תמחור - {recommendations.length} ימים קדימה
            </h2>

            {recommendationsQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">טוען המלצות...</div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                אין המלצות זמינות. הרץ סריקה כדי לקבל המלצות.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {recommendations.slice(0, 15).map((rec) => (
                  <Card key={`${rec.date}-${rec.roomType}`} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {new Date(rec.date).toLocaleDateString("he-IL", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </h3>
                          {getMarketPositionBadge(rec.marketPosition)}
                          <Badge variant="outline" className="text-xs">
                            ביטחון: {rec.confidence}%
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">מחיר נוכחי</p>
                            <p className="text-lg font-semibold">
                              {rec.currentPrice ? `₪${rec.currentPrice}` : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">מחיר מומלץ</p>
                            <p className="text-lg font-semibold text-green-600">
                              ₪{rec.recommendedPrice}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">שינוי</p>
                            <div className="flex items-center gap-1">
                              {getPriceChangeIcon(rec.priceChange)}
                              <span className="text-lg font-semibold">
                                {Math.abs(rec.priceChange)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <p className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{rec.reasoning.join(" • ")}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Price Trend Chart */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">מגמות מחירים - 30 ימים קדימה</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="current" stroke="#94a3b8" name="מחיר נוכחי" />
                  <Line type="monotone" dataKey="recommended" stroke="#22c55e" strokeWidth={2} name="מומלץ" />
                  <Line type="monotone" dataKey="competitor" stroke="#f59e0b" name="ממוצע מתחרים" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                אין נתוני מחיר זמינים
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Market Analysis & Alerts */}
        <div className="space-y-4">
          {/* Market Positioning */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">מיצוב שוק</h2>
            {marketAnalysis ? (
              <div className="space-y-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">מיקום בשוק</p>
                  <h3 className="text-3xl font-bold">
                    {marketAnalysis.targetPosition || "N/A"} / {marketAnalysis.totalHotels}
                  </h3>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">ממוצע שוק</p>
                  <p className="text-2xl font-bold">₪{marketAnalysis.marketAverage}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-sm">השוואת מתחרים</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {marketAnalysis.hotelAnalysis.map((hotel: any, idx: number) => (
                      <div key={hotel.hotelId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">#{idx + 1}</span>
                          <span className={hotel.category === "target" ? "font-semibold" : ""}>
                            {hotel.hotelName}
                          </span>
                          {hotel.category === "target" && (
                            <Badge variant="default" className="text-xs">אתה</Badge>
                          )}
                        </div>
                        <span className="font-semibold">₪{hotel.avgPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scatter Chart */}
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-sm">מפת מיצוב</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <ScatterChart>
                      <CartesianGrid />
                      <XAxis type="number" dataKey="price" name="מחיר" unit="₪" />
                      <YAxis type="number" dataKey="quality" name="איכות" />
                      <ZAxis range={[50, 200]} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter
                        name="מלונות"
                        data={scatterData}
                        fill="#8884d8"
                        shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isTarget = payload.category === "target";
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isTarget ? 8 : 5}
                              fill={isTarget ? "#22c55e" : "#8884d8"}
                              stroke={isTarget ? "#16a34a" : "none"}
                              strokeWidth={2}
                            />
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">טוען ניתוח שוק...</div>
            )}
          </Card>

          {/* Alerts */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              התראות ({alerts.filter(a => !a.isRead).length})
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">אין התראות</p>
              ) : (
                alerts.slice(0, 10).map((alert) => (
                  <Card
                    key={alert.id}
                    className={`p-3 ${alert.isRead ? "opacity-60" : "border-primary"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <h4 className="font-semibold text-sm">{alert.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.createdAt).toLocaleDateString("he-IL")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!alert.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAlertRead.mutate({ alertId: alert.id })}
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
