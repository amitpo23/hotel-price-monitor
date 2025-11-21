import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Users,
  Calendar,
  BarChart3,
  Target,
  AlertCircle,
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
  Area,
  AreaChart,
} from "recharts";

export default function RevenueManagement() {
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [comparisonPeriod, setComparisonPeriod] = useState<"previous" | "yoy">("previous");

  // Queries
  const hotelsQuery = trpc.hotels.list.useQuery();
  const kpisQuery = trpc.revenue.getKPIs.useQuery(
    { hotelId: selectedHotelId!, dateRange },
    { enabled: !!selectedHotelId }
  );
  const trendsQuery = trpc.revenue.getTrends.useQuery(
    { hotelId: selectedHotelId!, dateRange },
    { enabled: !!selectedHotelId }
  );
  const forecastQuery = trpc.revenue.getForecast.useQuery(
    { hotelId: selectedHotelId!, days: 30 },
    { enabled: !!selectedHotelId }
  );
  const comparisonQuery = trpc.revenue.getComparison.useQuery(
    { hotelId: selectedHotelId!, dateRange, comparisonType: comparisonPeriod },
    { enabled: !!selectedHotelId }
  );

  // Auto-select first target hotel
  if (!selectedHotelId && hotelsQuery.data && hotelsQuery.data.length > 0) {
    const targetHotel = hotelsQuery.data.find((h: any) => h.category === "target");
    setSelectedHotelId(targetHotel?.id || hotelsQuery.data[0].id);
  }

  const kpis = kpisQuery.data;
  const trends = trendsQuery.data || [];
  const forecast = forecastQuery.data || [];
  const comparison = comparisonQuery.data;

  // Format currency
  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "₪0";
    return `₪${(cents / 100).toFixed(0)}`;
  };

  // Format percentage
  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "0%";
    return `${value.toFixed(1)}%`;
  };

  // Calculate change indicator
  const ChangeIndicator = ({ value, inverse = false }: { value: number | null | undefined; inverse?: boolean }) => {
    if (value === null || value === undefined) return null;
    
    const isPositive = inverse ? value < 0 : value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-green-500" : "text-red-500";
    
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{Math.abs(value).toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול הכנסות</h1>
          <p className="text-muted-foreground">מדדי ביצוע ותחזיות הכנסות</p>
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
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 ימים אחרונים</SelectItem>
                <SelectItem value="30d">30 ימים אחרונים</SelectItem>
                <SelectItem value="90d">90 ימים אחרונים</SelectItem>
                <SelectItem value="1y">שנה אחרונה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Select value={comparisonPeriod} onValueChange={(value: any) => setComparisonPeriod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previous">לעומת תקופה קודמת</SelectItem>
                <SelectItem value="yoy">לעומת אשתקד</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RevPAR */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis?.revPAR)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">הכנסה לחדר זמין</p>
              <ChangeIndicator value={kpis?.revPARChange} />
            </div>
          </CardContent>
        </Card>

        {/* ADR */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ADR</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis?.adr)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">מחיר ממוצע ללילה</p>
              <ChangeIndicator value={kpis?.adrChange} />
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">תפוסה</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(kpis?.occupancyRate)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">אחוז תפוסה</p>
              <ChangeIndicator value={kpis?.occupancyChange} />
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">הכנסות</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis?.totalRevenue)}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">סה"כ הכנסות</p>
              <ChangeIndicator value={kpis?.revenueChange} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">מגמות</TabsTrigger>
          <TabsTrigger value="forecast">תחזית</TabsTrigger>
          <TabsTrigger value="comparison">השוואה</TabsTrigger>
          <TabsTrigger value="breakdown">פירוט</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מגמות הכנסות ותפוסה</CardTitle>
              <CardDescription>מעקב אחר ביצועים לאורך זמן</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="הכנסות (₪)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="occupancy"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    name="תפוסה (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>RevPAR לאורך זמן</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="revPAR" stroke="#8884d8" name="RevPAR" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ADR לאורך זמן</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="adr" stroke="#82ca9d" name="ADR" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>תחזית הכנסות ל-30 ימים הבאים</CardTitle>
              <CardDescription>חיזוי מבוסס על נתונים היסטוריים ומגמות</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="forecastRevenue"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="תחזית הכנסות"
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceHigh"
                    stroke="#82ca9d"
                    fill="transparent"
                    strokeDasharray="5 5"
                    name="רמת ביטחון עליונה"
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceLow"
                    stroke="#ffc658"
                    fill="transparent"
                    strokeDasharray="5 5"
                    name="רמת ביטחון תחתונה"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">תחזית הכנסות חודשית</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(forecast.reduce((sum: number, f: any) => sum + (f.forecastRevenue || 0), 0))}</div>
                <p className="text-xs text-muted-foreground mt-1">30 ימים הבאים</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">תפוסה צפויה</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {forecast.length > 0
                    ? formatPercent(forecast.reduce((sum: number, f: any) => sum + (f.forecastOccupancy || 0), 0) / forecast.length)
                    : "0%"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">ממוצע חודשי</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">רמת ביטחון</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {forecast.length > 0
                    ? formatPercent(forecast.reduce((sum: number, f: any) => sum + (f.confidence || 0), 0) / forecast.length)
                    : "0%"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">דיוק חיזוי</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>השוואה לתקופה קודמת</CardTitle>
              <CardDescription>
                {comparisonPeriod === "previous" ? "לעומת תקופה קודמת באותו אורך" : "לעומת אותה תקופה אשתקד"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">RevPAR</p>
                    <p className="text-2xl font-bold">{formatCurrency(comparison?.current.revPAR)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">תקופה קודמת</p>
                    <p className="text-lg">{formatCurrency(comparison?.previous.revPAR)}</p>
                  </div>
                  <ChangeIndicator value={comparison?.changes.revPAR} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">ADR</p>
                    <p className="text-2xl font-bold">{formatCurrency(comparison?.current.adr)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">תקופה קודמת</p>
                    <p className="text-lg">{formatCurrency(comparison?.previous.adr)}</p>
                  </div>
                  <ChangeIndicator value={comparison?.changes.adr} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">תפוסה</p>
                    <p className="text-2xl font-bold">{formatPercent(comparison?.current.occupancy)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">תקופה קודמת</p>
                    <p className="text-lg">{formatPercent(comparison?.previous.occupancy)}</p>
                  </div>
                  <ChangeIndicator value={comparison?.changes.occupancy} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">הכנסות</p>
                    <p className="text-2xl font-bold">{formatCurrency(comparison?.current.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">תקופה קודמת</p>
                    <p className="text-lg">{formatCurrency(comparison?.previous.revenue)}</p>
                  </div>
                  <ChangeIndicator value={comparison?.changes.revenue} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>פירוט חדרים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">סה"כ חדרים</span>
                    <span className="font-bold">{kpis?.totalRooms || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">חדרים שנמכרו</span>
                    <span className="font-bold">{kpis?.roomsSold || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">חדרים זמינים</span>
                    <span className="font-bold">{kpis?.roomsAvailable || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פירוט הזמנות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">סה"כ הזמנות</span>
                    <span className="font-bold">{kpis?.totalBookings || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">ביטולים</span>
                    <span className="font-bold text-red-500">{kpis?.cancellations || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">No-shows</span>
                    <span className="font-bold text-orange-500">{kpis?.noShows || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מדדים תחרותיים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">נתח שוק</span>
                    <span className="font-bold">{formatPercent(kpis?.marketShare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">מדד מחיר</span>
                    <Badge variant={kpis?.priceIndex && kpis.priceIndex > 100 ? "destructive" : "default"}>
                      {kpis?.priceIndex || 100}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ניתוח Break-Even</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">תפוסה נדרשת</span>
                    <span className="font-bold">{formatPercent(kpis?.breakEvenOccupancy)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">מחיר מינימלי</span>
                    <span className="font-bold">{formatCurrency(kpis?.breakEvenPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
