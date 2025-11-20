import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, FileSpreadsheet } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Results() {
  const { user, loading: authLoading } = useAuth();
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  console.log("[Results] Component rendered");
  console.log("[Results] User:", user);
  console.log("[Results] Selected Config ID:", selectedConfigId);

  useEffect(() => {
    console.log("[Results] selectedConfigId changed to:", selectedConfigId);
  }, [selectedConfigId]);

  const { data: configs, isLoading: configsLoading } = trpc.scans.configs.list.useQuery(undefined, {
    enabled: !!user,
    onSuccess: (data) => {
      console.log("[Results] Configs loaded:", data);
    },
    onError: (error) => {
      console.error("[Results] Error loading configs:", error);
    },
  });

  const { data: results, isLoading: resultsLoading, refetch } = trpc.scans.results.getLatest.useQuery(
    { configId: parseInt(selectedConfigId) },
    {
      enabled: !!selectedConfigId,
      onSuccess: (data) => {
        console.log("[Results] Results loaded:", data);
        console.log("[Results] Number of results:", data?.length || 0);
      },
      onError: (error) => {
        console.error("[Results] Error loading results:", error);
      },
    }
  );

  const { data: stats } = trpc.scans.results.getStats.useQuery(
    { configId: parseInt(selectedConfigId) },
    {
      enabled: !!selectedConfigId,
      onSuccess: (data) => {
        console.log("[Results] Stats loaded:", data);
      },
      onError: (error) => {
        console.error("[Results] Error loading stats:", error);
      },
    }
  );

  // Transform results for chart
  const chartData = results?.map((item) => ({
    hotelId: item.hotel.id,
    hotelName: item.hotel.name,
    checkInDate: item.result.checkInDate,
    roomType: item.result.roomType as "room_only" | "with_breakfast",
    price: item.result.price,
    isAvailable: item.result.isAvailable === 1,
  })) || [];

  const targetHotelId = configs?.find((c) => c.id === parseInt(selectedConfigId))?.targetHotelId || 0;

  const exportMutation = trpc.export.exportToExcel.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and trigger download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Excel file downloaded successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleExport = () => {
    if (!selectedConfigId) {
      toast.error("Please select a scan configuration first");
      return;
    }

    exportMutation.mutate({ configId: parseInt(selectedConfigId) });
  };

  // Group results by hotel
  const groupedResults = results?.reduce((acc, item) => {
    const hotelName = item.hotel.name;
    if (!acc[hotelName]) {
      acc[hotelName] = [];
    }
    acc[hotelName].push(item);
    return acc;
  }, {} as Record<string, typeof results>);

  if (authLoading) {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scan Results</h1>
            <p className="text-muted-foreground mt-2">
              View and analyze hotel price monitoring results
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={!selectedConfigId || exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to Excel
              </>
            )}
          </Button>
        </div>

        {/* Configuration Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Scan Configuration</CardTitle>
            <CardDescription>Choose a configuration to view its latest results</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a scan configuration" />
              </SelectTrigger>
              <SelectContent>
                {configsLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : configs && configs.length > 0 ? (
                  configs.map((config) => (
                    <SelectItem key={config.id} value={config.id.toString()}>
                      {config.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No configurations available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedConfigId && (
          <>
            {/* Price Trend Chart */}
            {chartData.length > 0 && (
              <PriceTrendChart data={chartData} targetHotelId={targetHotelId} />
            )}

            {/* Statistics Cards */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Dates</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDates}</div>
                    <p className="text-xs text-muted-foreground">Days scanned</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Price</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₪{stats.averagePrice}</div>
                    <p className="text-xs text-muted-foreground">Per night</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Price Range</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₪{stats.minPrice} - ₪{stats.maxPrice}
                    </div>
                    <p className="text-xs text-muted-foreground">Min - Max</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Availability</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.availabilityRate}%</div>
                    <p className="text-xs text-muted-foreground">Rooms available</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results Table */}
            {resultsLoading ? (
              <div className="text-center py-12">Loading results...</div>
            ) : results && results.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Price Comparison</CardTitle>
                  <CardDescription>Latest scan results by hotel and date</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hotel</TableHead>
                          <TableHead>Check-In Date</TableHead>
                          <TableHead>Room Type</TableHead>
                          <TableHead>Price (ILS)</TableHead>
                          <TableHead>Available</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.slice(0, 50).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {item.hotel.name}
                              {item.hotel.category === "target" && (
                                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  Target
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{item.result.checkInDate}</TableCell>
                            <TableCell>
                              {item.result.roomType === "room_only"
                                ? "Room Only"
                                : "With Breakfast"}
                            </TableCell>
                            <TableCell>
                              {item.result.price !== null
                                ? `₪${Math.round(item.result.price / 100)}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  item.result.isAvailable
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }`}
                              >
                                {item.result.isAvailable ? "Yes" : "No"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {results.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing first 50 results. Export to Excel to see all {results.length} results.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No results yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Run a scan to see price comparison results
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!selectedConfigId && !configsLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Select a configuration</h3>
              <p className="text-muted-foreground mt-2">
                Choose a scan configuration above to view its results
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
