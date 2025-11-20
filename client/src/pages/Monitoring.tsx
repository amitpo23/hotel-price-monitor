import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp, Database, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Monitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  // Fetch monitoring data
  const { data: healthData, refetch: refetchHealth } = trpc.monitoring.getSystemHealth.useQuery(undefined, {
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: recentScans, refetch: refetchScans } = trpc.monitoring.getRecentScans.useQuery(
    { limit: 10 },
    {
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const { data: errorLogs, refetch: refetchErrors } = trpc.monitoring.getRecentErrors.useQuery(
    { limit: 20 },
    {
      refetchInterval: autoRefresh ? refreshInterval : false,
    }
  );

  const handleManualRefresh = () => {
    refetchHealth();
    refetchScans();
    refetchErrors();
  };

  // Prepare chart data for scan performance
  const scanPerformanceData = recentScans?.map((scan) => ({
    name: `Scan ${scan.id}`,
    duration: scan.duration || 0,
    hotels: scan.totalHotels || 0,
    results: scan.resultsCount || 0,
  })) || [];

  // Calculate success rate
  const successRate = recentScans
    ? ((recentScans.filter((s) => s.status === "completed").length / recentScans.length) * 100).toFixed(1)
    : "0";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground">Real-time system health and performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className="mr-2 h-4 w-4" />
              {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
            </Button>
          </div>
        </div>

        {/* System Health Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.status === "healthy" ? "Healthy" : "Degraded"}
              </div>
              <p className="text-xs text-muted-foreground">
                Uptime: {healthData?.uptime || "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthData?.totalScans || 0}</div>
              <p className="text-xs text-muted-foreground">
                Success Rate: {successRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Scans</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthData?.activeScans || 0}</div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthData?.dbStatus === "connected" ? "Connected" : "Disconnected"}
              </div>
              <p className="text-xs text-muted-foreground">
                {healthData?.totalResults || 0} results stored
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="scans">Recent Scans</TabsTrigger>
            <TabsTrigger value="errors">Error Logs</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scan Performance Metrics</CardTitle>
                <CardDescription>Duration and results for recent scans</CardDescription>
              </CardHeader>
              <CardContent>
                {scanPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={scanPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="duration" fill="#8884d8" name="Duration (s)" />
                      <Bar dataKey="results" fill="#82ca9d" name="Results" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No performance data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Scans Tab */}
          <TabsContent value="scans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Scan Activity</CardTitle>
                <CardDescription>Latest 10 scans with status and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentScans && recentScans.length > 0 ? (
                    recentScans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {scan.status === "completed" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : scan.status === "running" ? (
                            <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium">Scan #{scan.id}</div>
                            <div className="text-sm text-muted-foreground">
                              Config: {scan.configName || "N/A"} • {scan.totalHotels} hotels
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={scan.status === "completed" ? "default" : scan.status === "running" ? "secondary" : "destructive"}>
                            {scan.status}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {scan.resultsCount || 0} results
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                      No recent scans found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Error Logs Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Logs</CardTitle>
                <CardDescription>Recent errors and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errorLogs && errorLogs.length > 0 ? (
                    errorLogs.map((log, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{log.message}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {log.timestamp} • Scan #{log.scanId || "N/A"}
                            </div>
                            {log.details && (
                              <pre className="mt-2 text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                                {log.details}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                        <div>No errors found - System is healthy!</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
