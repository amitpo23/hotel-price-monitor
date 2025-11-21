import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Bell,
  BellOff,
  Eye,
  Target,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { toast } from "sonner";

export default function CompetitorIntelligence() {
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [roomType, setRoomType] = useState<"room_only" | "with_breakfast">("room_only");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  // Queries
  const hotelsQuery = trpc.hotels.list.useQuery();
  const alertsQuery = trpc.competitorIntelligence.getAlerts.useQuery(
    { hotelId: selectedHotelId!, unreadOnly: false },
    { enabled: !!selectedHotelId }
  );
  const competitorPricesQuery = trpc.competitorIntelligence.getCompetitorPrices.useQuery(
    { hotelId: selectedHotelId!, roomType, days: parseInt(dateRange.replace("d", "")) },
    { enabled: !!selectedHotelId }
  );
  const marketPositionQuery = trpc.competitorIntelligence.getMarketPosition.useQuery(
    { hotelId: selectedHotelId!, roomType },
    { enabled: !!selectedHotelId }
  );
  const priceGapAnalysisQuery = trpc.competitorIntelligence.getPriceGapAnalysis.useQuery(
    { hotelId: selectedHotelId!, roomType, days: parseInt(dateRange.replace("d", "")) },
    { enabled: !!selectedHotelId }
  );

  // Mutations
  const markAlertReadMutation = trpc.competitorIntelligence.markAlertRead.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
    },
  });

  // Auto-select first target hotel
  if (!selectedHotelId && hotelsQuery.data && hotelsQuery.data.length > 0) {
    const targetHotel = hotelsQuery.data.find((h: any) => h.category === "target");
    setSelectedHotelId(targetHotel?.id || hotelsQuery.data[0].id);
  }

  const alerts = alertsQuery.data || [];
  const unreadAlerts = alerts.filter((a: any) => a.isRead === 0);
  const competitorPrices = competitorPricesQuery.data || [];
  const marketPosition = marketPositionQuery.data;
  const priceGapAnalysis = priceGapAnalysisQuery.data || [];

  // Format currency
  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "₪0";
    return `₪${(cents / 100).toFixed(0)}`;
  };

  // Mark alert as read
  const markRead = (alertId: number) => {
    markAlertReadMutation.mutate({ alertId });
  };

  // Get price change icon
  const PriceChangeIcon = ({ change }: { change: number }) => {
    if (change > 5) return <ArrowUp className="w-4 h-4 text-red-500" />;
    if (change < -5) return <ArrowDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">מודיעין תחרותי</h1>
          <p className="text-muted-foreground">מעקב ו ניתוח מתחרים בזמן אמת</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadAlerts.length > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              <Bell className="w-4 h-4 mr-1" />
              {unreadAlerts.length} התראות חדשות
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex gap-4 pt-6">
          <div className="flex-1">
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
            <Select value={roomType} onValueChange={(value: any) => setRoomType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room_only">חדר בלבד</SelectItem>
                <SelectItem value="with_breakfast">כולל ארוחת בוקר</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 ימים</SelectItem>
                <SelectItem value="30d">30 ימים</SelectItem>
                <SelectItem value="90d">90 ימים</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Market Position Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מיקום בשוק</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              #{marketPosition?.rank || "-"} מתוך {marketPosition?.totalCompetitors || "-"}
            </div>
            <p className="text-xs text-muted-foreground">דירוג מחיר</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">פער מחיר ממוצע</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketPosition?.avgPriceGap ? `${marketPosition.avgPriceGap > 0 ? "+" : ""}${marketPosition.avgPriceGap.toFixed(1)}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">לעומת ממוצע שוק</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מתחרים פעילים</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketPosition?.activeCompetitors || 0}</div>
            <p className="text-xs text-muted-foreground">עם מחירים זמינים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">מדד תחרותיות</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketPosition?.competitivenessScore || 0}</div>
            <p className="text-xs text-muted-foreground">ציון 0-100</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            התראות {unreadAlerts.length > 0 && `(${unreadAlerts.length})`}
          </TabsTrigger>
          <TabsTrigger value="prices">מחירי מתחרים</TabsTrigger>
          <TabsTrigger value="analysis">ניתוח פערים</TabsTrigger>
          <TabsTrigger value="trends">מגמות</TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>התראות מחירים</CardTitle>
              <CardDescription>שינויים משמעותיים במחירי מתחרים</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BellOff className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>אין התראות</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className={`flex items-start justify-between p-4 border rounded-lg ${
                        alert.isRead === 0 ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200" : ""
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              alert.alertType === "price_drop"
                                ? "default"
                                : alert.alertType === "price_increase"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {alert.alertType === "price_drop" && "הורדת מחיר"}
                            {alert.alertType === "price_increase" && "העלאת מחיר"}
                            {alert.alertType === "significant_gap" && "פער משמעותי"}
                            {alert.alertType === "new_competitor" && "מתחרה חדש"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleString("he-IL")}
                          </span>
                        </div>
                        <p className="mt-2 font-medium">{alert.message}</p>
                        {alert.details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {JSON.parse(alert.details).description}
                          </p>
                        )}
                      </div>
                      {alert.isRead === 0 && (
                        <Button variant="ghost" size="sm" onClick={() => markRead(alert.id)}>
                          סמן כנקרא
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prices Tab */}
        <TabsContent value="prices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מחירי מתחרים נוכחיים</CardTitle>
              <CardDescription>השוואת מחירים לתאריכים הקרובים</CardDescription>
            </CardHeader>
            <CardContent>
              {competitorPrices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>אין נתוני מחירים זמינים</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך</TableHead>
                      <TableHead>המלון שלך</TableHead>
                      <TableHead>ממוצע מתחרים</TableHead>
                      <TableHead>מתחרה זול ביותר</TableHead>
                      <TableHead>מתחרה יקר ביותר</TableHead>
                      <TableHead>פער</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitorPrices.slice(0, 10).map((row: any) => (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell>{formatCurrency(row.yourPrice)}</TableCell>
                        <TableCell>{formatCurrency(row.avgCompetitorPrice)}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(row.minCompetitorPrice)}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {formatCurrency(row.maxCompetitorPrice)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PriceChangeIcon change={row.priceGap} />
                            <span
                              className={
                                row.priceGap > 5
                                  ? "text-red-600"
                                  : row.priceGap < -5
                                  ? "text-green-600"
                                  : ""
                              }
                            >
                              {row.priceGap > 0 ? "+" : ""}
                              {row.priceGap.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ניתוח פערי מחירים</CardTitle>
              <CardDescription>התפלגות המחירים שלך לעומת מתחרים</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="avgCompetitorPrice"
                    name="ממוצע מתחרים"
                    unit="₪"
                    type="number"
                  />
                  <YAxis dataKey="yourPrice" name="המחיר שלך" unit="₪" type="number" />
                  <ZAxis dataKey="priceGap" name="פער" range={[50, 400]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend />
                  <Scatter
                    name="מחירים"
                    data={priceGapAnalysis.map((p: any) => ({
                      ...p,
                      yourPrice: p.yourPrice / 100,
                      avgCompetitorPrice: p.avgCompetitorPrice / 100,
                    }))}
                    fill="#8884d8"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ימים שאתה זול יותר</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {priceGapAnalysis.filter((p: any) => p.priceGap < 0).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  מתוך {priceGapAnalysis.length} ימים
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ימים שאתה יקר יותר</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {priceGapAnalysis.filter((p: any) => p.priceGap > 0).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  מתוך {priceGapAnalysis.length} ימים
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">פער ממוצע</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {priceGapAnalysis.length > 0
                    ? (
                        priceGapAnalysis.reduce((sum: number, p: any) => sum + p.priceGap, 0) /
                        priceGapAnalysis.length
                      ).toFixed(1)
                    : "0"}
                  %
                </div>
                <p className="text-xs text-muted-foreground">פער מחיר ממוצע</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מגמות מחירים לאורך זמן</CardTitle>
              <CardDescription>השוואת המחירים שלך למתחרים</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={competitorPrices}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="yourPrice"
                    stroke="#8884d8"
                    name="המחיר שלך"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgCompetitorPrice"
                    stroke="#82ca9d"
                    name="ממוצע מתחרים"
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="minCompetitorPrice"
                    stroke="#ffc658"
                    name="מתחרה זול"
                    strokeDasharray="3 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
