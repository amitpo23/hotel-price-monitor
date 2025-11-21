import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Pause,
  Plus,
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

export default function ABTesting() {
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Queries
  const hotelsQuery = trpc.hotels.list.useQuery();
  const testsQuery = trpc.abTesting.getTests.useQuery(
    { hotelId: selectedHotelId! },
    { enabled: !!selectedHotelId }
  );

  // Mutations
  const createTestMutation = trpc.abTesting.createTest.useMutation({
    onSuccess: () => {
      toast.success("בדיקת A/B נוצרה בהצלחה");
      testsQuery.refetch();
      setShowCreateDialog(false);
    },
  });

  const updateTestStatusMutation = trpc.abTesting.updateTestStatus.useMutation({
    onSuccess: () => {
      toast.success("סטטוס עודכן");
      testsQuery.refetch();
    },
  });

  const declareWinnerMutation = trpc.abTesting.declareWinner.useMutation({
    onSuccess: () => {
      toast.success("מנצח הוכרז!");
      testsQuery.refetch();
    },
  });

  // Auto-select first target hotel
  if (!selectedHotelId && hotelsQuery.data && hotelsQuery.data.length > 0) {
    const targetHotel = hotelsQuery.data.find((h: any) => h.category === "target");
    setSelectedHotelId(targetHotel?.id || hotelsQuery.data[0].id);
  }

  const tests = testsQuery.data || [];
  const runningTests = tests.filter((t: any) => t.status === "running");
  const completedTests = tests.filter((t: any) => t.status === "completed");

  // Format currency
  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "₪0";
    return `₪${(cents / 100).toFixed(0)}`;
  };

  // Toggle test status
  const toggleTestStatus = (testId: number, currentStatus: string) => {
    const newStatus = currentStatus === "running" ? "paused" : "running";
    updateTestStatusMutation.mutate({ testId, status: newStatus });
  };

  // Declare winner
  const declareWinner = (testId: number, winner: "variantA" | "variantB") => {
    if (confirm(`האם אתה בטוח שברצונך להכריז על ${winner === "variantA" ? "גרסה A" : "גרסה B"} כמנצחת?`)) {
      declareWinnerMutation.mutate({ testId, winner });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">בדיקות A/B</h1>
          <p className="text-muted-foreground">מדידת השפעת כללי תמחור על הכנסות</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          בדיקה חדשה
        </Button>
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
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">בדיקות פעילות</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningTests.length}</div>
            <p className="text-xs text-muted-foreground">רצות כעת</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">בדיקות שהושלמו</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTests.length}</div>
            <p className="text-xs text-muted-foreground">עם תוצאות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שיפור ממוצע</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTests.length > 0
                ? (
                    completedTests.reduce((sum: number, t: any) => {
                      const improvement =
                        t.variantARevenue > 0
                          ? ((t.variantBRevenue - t.variantARevenue) / t.variantARevenue) * 100
                          : 0;
                      return sum + improvement;
                    }, 0) / completedTests.length
                  ).toFixed(1)
                : "0"}
              %
            </div>
            <p className="text-xs text-muted-foreground">שיפור בהכנסות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ בדיקות</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tests.length}</div>
            <p className="text-xs text-muted-foreground">כל הזמנים</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">בדיקות פעילות ({runningTests.length})</TabsTrigger>
          <TabsTrigger value="completed">הושלמו ({completedTests.length})</TabsTrigger>
          <TabsTrigger value="all">הכל ({tests.length})</TabsTrigger>
        </TabsList>

        {/* Active Tests Tab */}
        <TabsContent value="active" className="space-y-4">
          {runningTests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">אין בדיקות פעילות</p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  צור בדיקה ראשונה
                </Button>
              </CardContent>
            </Card>
          ) : (
            runningTests.map((test: any) => <TestCard key={test.id} test={test} onToggle={toggleTestStatus} onDeclareWinner={declareWinner} />)
          )}
        </TabsContent>

        {/* Completed Tests Tab */}
        <TabsContent value="completed" className="space-y-4">
          {completedTests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">אין בדיקות שהושלמו</p>
              </CardContent>
            </Card>
          ) : (
            completedTests.map((test: any) => <TestCard key={test.id} test={test} onToggle={toggleTestStatus} onDeclareWinner={declareWinner} />)
          )}
        </TabsContent>

        {/* All Tests Tab */}
        <TabsContent value="all" className="space-y-4">
          {tests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">אין בדיקות</p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  צור בדיקה ראשונה
                </Button>
              </CardContent>
            </Card>
          ) : (
            tests.map((test: any) => <TestCard key={test.id} test={test} onToggle={toggleTestStatus} onDeclareWinner={declareWinner} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Create Test Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>צור בדיקת A/B חדשה</DialogTitle>
            <DialogDescription>
              השווה בין שתי גרסאות של כללי תמחור כדי למצוא את האופטימלית
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם הבדיקה</Label>
              <Input placeholder="לדוגמה: בדיקת תמחור דינמי לעומת קבוע" />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea placeholder="תיאור מטרת הבדיקה..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך התחלה</Label>
                <Input type="date" />
              </div>
              <div>
                <Label>תאריך סיום</Label>
                <Input type="date" />
              </div>
            </div>
            <div>
              <Label>פיצול תנועה (% לגרסה B)</Label>
              <Input type="number" min="0" max="100" defaultValue="50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>גרסה A (קונטרול)</Label>
                <Textarea placeholder="הגדרת כלל תמחור A..." />
              </div>
              <div>
                <Label>גרסה B (ניסוי)</Label>
                <Textarea placeholder="הגדרת כלל תמחור B..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ביטול
            </Button>
            <Button onClick={() => toast.info("תכונה בפיתוח")}>צור בדיקה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Test Card Component
function TestCard({
  test,
  onToggle,
  onDeclareWinner,
}: {
  test: any;
  onToggle: (id: number, status: string) => void;
  onDeclareWinner: (id: number, winner: "variantA" | "variantB") => void;
}) {
  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "₪0";
    return `₪${(cents / 100).toFixed(0)}`;
  };

  const revenueImprovement =
    test.variantARevenue > 0
      ? ((test.variantBRevenue - test.variantARevenue) / test.variantARevenue) * 100
      : 0;

  const chartData = [
    {
      name: "גרסה A",
      הכנסות: test.variantARevenue / 100,
      הזמנות: test.variantABookings,
    },
    {
      name: "גרסה B",
      הכנסות: test.variantBRevenue / 100,
      הזמנות: test.variantBBookings,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{test.name}</CardTitle>
            <CardDescription>{test.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                test.status === "running"
                  ? "default"
                  : test.status === "completed"
                  ? "secondary"
                  : "outline"
              }
            >
              {test.status === "running" && "רץ"}
              {test.status === "paused" && "מושהה"}
              {test.status === "completed" && "הושלם"}
              {test.status === "draft" && "טיוטה"}
            </Badge>
            {test.status === "running" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(test.id, test.status)}
              >
                <Pause className="w-4 h-4" />
              </Button>
            )}
            {test.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(test.id, test.status)}
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">תאריכים</p>
            <p className="font-medium">
              {test.startDate} - {test.endDate}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">פיצול תנועה</p>
            <p className="font-medium">{test.trafficSplit}% לגרסה B</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">גרסה A (קונטרול)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">הכנסות</span>
                <span className="font-bold">{formatCurrency(test.variantARevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">הזמנות</span>
                <span className="font-bold">{test.variantABookings}</span>
              </div>
              {test.status === "running" && test.winner === "none" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => onDeclareWinner(test.id, "variantA")}
                >
                  הכרז כמנצחת
                </Button>
              )}
              {test.winner === "variantA" && (
                <Badge variant="default" className="w-full justify-center">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  מנצחת
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">גרסה B (ניסוי)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">הכנסות</span>
                <span className="font-bold">{formatCurrency(test.variantBRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">הזמנות</span>
                <span className="font-bold">{test.variantBBookings}</span>
              </div>
              {test.status === "running" && test.winner === "none" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => onDeclareWinner(test.id, "variantB")}
                >
                  הכרז כמנצחת
                </Button>
              )}
              {test.winner === "variantB" && (
                <Badge variant="default" className="w-full justify-center">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  מנצחת
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {(test.variantARevenue > 0 || test.variantBRevenue > 0) && (
          <>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">שיפור בהכנסות</p>
                <p
                  className={`text-2xl font-bold ${
                    revenueImprovement > 0
                      ? "text-green-600"
                      : revenueImprovement < 0
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  {revenueImprovement > 0 ? "+" : ""}
                  {revenueImprovement.toFixed(1)}%
                </p>
              </div>
              {test.confidenceLevel && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">רמת ביטחון</p>
                  <p className="text-2xl font-bold">{test.confidenceLevel}%</p>
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="הכנסות" fill="#8884d8" />
                <Bar yAxisId="right" dataKey="הזמנות" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
