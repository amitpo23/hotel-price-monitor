import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PriceData {
  hotelId: number;
  hotelName: string;
  checkInDate: string;
  roomType: "room_only" | "with_breakfast";
  price: number | null;
  isAvailable: boolean;
}

interface PriceTrendChartProps {
  data: PriceData[];
  targetHotelId: number;
}

// Color palette for different hotels
const COLORS = [
  "#2563eb", // Blue for target hotel
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export function PriceTrendChart({ data, targetHotelId }: PriceTrendChartProps) {
  // Group data by room type
  const roomOnlyData = data.filter((d) => d.roomType === "room_only");
  const withBreakfastData = data.filter((d) => d.roomType === "with_breakfast");

  // Get unique hotels
  const hotels = Array.from(new Set(data.map((d) => d.hotelId))).map((id) => {
    const item = data.find((d) => d.hotelId === id);
    return {
      id,
      name: item?.hotelName || "",
      isTarget: id === targetHotelId,
    };
  });

  // Sort hotels: target first, then alphabetically
  hotels.sort((a, b) => {
    if (a.isTarget) return -1;
    if (b.isTarget) return 1;
    return a.name.localeCompare(b.name);
  });

  // Transform data for Recharts
  const transformData = (roomData: PriceData[]) => {
    const dateMap = new Map<string, any>();

    roomData.forEach((item) => {
      if (!dateMap.has(item.checkInDate)) {
        dateMap.set(item.checkInDate, { date: item.checkInDate });
      }

      const dateEntry = dateMap.get(item.checkInDate)!;
      // Convert price from cents to ILS
      dateEntry[`hotel_${item.hotelId}`] = item.price !== null ? item.price / 100 : null;
    });

    // Convert to array and sort by date
    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const roomOnlyChartData = transformData(roomOnlyData);
  const withBreakfastChartData = transformData(withBreakfastData);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-2">{new Date(label).toLocaleDateString()}</p>
          {payload.map((entry: any, index: number) => {
            const hotelId = parseInt(entry.dataKey.replace("hotel_", ""));
            const hotel = hotels.find((h) => h.id === hotelId);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{hotel?.name}:</span>
                <span className="font-medium">
                  {entry.value !== null ? `₪${entry.value.toFixed(2)}` : "N/A"}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const renderChart = (chartData: any[], title: string) => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No data available for this room type
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            className="text-xs"
          />
          <YAxis
            tickFormatter={(value) => `₪${value}`}
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => {
              const hotelId = parseInt(value.replace("hotel_", ""));
              const hotel = hotels.find((h) => h.id === hotelId);
              return hotel?.name || value;
            }}
            wrapperStyle={{ paddingTop: "20px" }}
          />
          {hotels.map((hotel, index) => (
            <Line
              key={hotel.id}
              type="monotone"
              dataKey={`hotel_${hotel.id}`}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={hotel.isTarget ? 3 : 2}
              dot={hotel.isTarget ? { r: 4 } : { r: 2 }}
              activeDot={{ r: 6 }}
              name={`hotel_${hotel.id}`}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Trends Over Time</CardTitle>
        <CardDescription>
          Compare price trends across hotels and room types
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="room_only" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="room_only">Room Only</TabsTrigger>
            <TabsTrigger value="with_breakfast">With Breakfast</TabsTrigger>
          </TabsList>
          <TabsContent value="room_only" className="mt-6">
            {renderChart(roomOnlyChartData, "Room Only")}
          </TabsContent>
          <TabsContent value="with_breakfast" className="mt-6">
            {renderChart(withBreakfastChartData, "With Breakfast")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
