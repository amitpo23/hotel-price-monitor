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
import { Switch } from "@/components/ui/switch";
import {
  Play,
  Plus,
  Settings,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertCircle,
  Check,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function DynamicPricing() {
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [roomType, setRoomType] = useState<"room_only" | "with_breakfast">("room_only");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);

  // Queries
  const hotelsQuery = trpc.hotels.list.useQuery();
  const rulesQuery = trpc.dynamicPricing.getRules.useQuery(
    { hotelId: selectedHotelId! },
    { enabled: !!selectedHotelId }
  );
  const statsQuery = trpc.dynamicPricing.getStats.useQuery(
    { hotelId: selectedHotelId! },
    { enabled: !!selectedHotelId }
  );
  const recommendationsQuery = trpc.dynamicPricing.getRecommendations.useQuery(
    { hotelId: selectedHotelId!, roomType, days: 30 },
    { enabled: !!selectedHotelId }
  );

  // Mutations
  const createRuleMutation = trpc.dynamicPricing.createRule.useMutation({
    onSuccess: () => {
      toast.success("כלל תמחור נוצר בהצלחה");
      rulesQuery.refetch();
      setShowCreateDialog(false);
    },
  });

  const updateRuleMutation = trpc.dynamicPricing.updateRule.useMutation({
    onSuccess: () => {
      toast.success("כלל תמחור עודכן");
      rulesQuery.refetch();
    },
  });

  const deleteRuleMutation = trpc.dynamicPricing.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("כלל תמחור נמחק");
      rulesQuery.refetch();
    },
  });

  const runEngineMutation = trpc.dynamicPricing.runEngine.useMutation({
    onSuccess: (data) => {
      toast.success(`מנוע תמחור הושלם: ${data.summary.changesRecommended} המלצות`);
      recommendationsQuery.refetch();
      setShowRunDialog(false);
    },
  });

  const applyRecommendationsMutation = trpc.dynamicPricing.applyRecommendations.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updatedDates} מחירים עודכנו`);
      recommendationsQuery.refetch();
    },
  });

  // Auto-select first target hotel
  if (!selectedHotelId && hotelsQuery.data && hotelsQuery.data.length > 0) {
    const targetHotel = hotelsQuery.data.find((h: any) => h.category === "target");
    setSelectedHotelId(targetHotel?.id || hotelsQuery.data[0].id);
  }

  const rules = rulesQuery.data || [];
  const stats = statsQuery.data;
  const recommendations = recommendationsQuery.data;

  // Format currency
  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "₪0";
    return `₪${(cents / 100).toFixed(0)}`;
  };

  // Toggle rule active status
  const toggleRule = (ruleId: number, isActive: number) => {
    updateRuleMutation.mutate({
      ruleId,
      isActive: isActive === 1 ? 0 : 1,
    });
  };

  // Delete rule
  const deleteRule = (ruleId: number) => {
    if (confirm("האם אתה בטוח שברצונך למחוק כלל זה?")) {
      deleteRuleMutation.mutate({ ruleId });
    }
  };

  // Run pricing engine
  const runEngine = (autoApply: boolean) => {
    if (!selectedHotelId) return;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    runEngineMutation.mutate({
      hotelId: selectedHotelId,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      roomType,
      autoApply,
    });
  };

  // Apply selected recommendations
  const applyRecommendations = (selectedDates: string[]) => {
    if (!selectedHotelId || !recommendations) return;

    const prices = selectedDates.map((date) => {
      const rec = recommendations.results.find((r: any) => r.date === date);
      return rec?.recommendedPrice || 0;
    });

    applyRecommendationsMutation.mutate({
      hotelId: selectedHotelId,
      dates: selectedDates,
      roomType,
      prices,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">תמחור דינמי</h1>
          <p className="text-muted-foreground">עדכון מחירים אוטומטי מבוסס כללים</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowRunDialog(true)}>
            <Play className="w-4 h-4 mr-2" />
            הרץ מנוע תמחור
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            כלל חדש
          </Button>
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
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">כללים פעילים</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeRules || 0}</div>
            <p className="text-xs text-muted-foreground">מתוך {stats?.totalRules || 0} כללים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">יישומים</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalApplications || 0}</div>
            <p className="text-xs text-muted-foreground">פעמים שהוחלו כללים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שינויים אחרונים</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentDynamicChanges || 0}</div>
            <p className="text-xs text-muted-foreground">ב-30 ימים אחרונים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שינוי ממוצע</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgPriceChange || 0}%</div>
            <p className="text-xs text-muted-foreground">שינוי מחיר ממוצע</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">כללי תמחור</TabsTrigger>
          <TabsTrigger value="recommendations">המלצות</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>כללי תמחור פעילים</CardTitle>
              <CardDescription>נהל את הכללים שמשפיעים על התמחור האוטומטי</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>אין כללי תמחור. צור כלל ראשון כדי להתחיל.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{rule.name}</h4>
                          <Badge variant={rule.isActive === 1 ? "default" : "secondary"}>
                            {rule.isActive === 1 ? "פעיל" : "לא פעיל"}
                          </Badge>
                          <Badge variant="outline">{rule.ruleType}</Badge>
                        </div>
                        {rule.description && (
                          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>עדיפות: {rule.priority}</span>
                          <span>הוחל: {rule.timesApplied || 0} פעמים</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Switch
                          checked={rule.isActive === 1}
                          onCheckedChange={() => toggleRule(rule.id, rule.isActive)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>המלצות תמחור ל-30 ימים הבאים</CardTitle>
              <CardDescription>
                {recommendations
                  ? `${recommendations.summary.changesRecommended} שינויים מומלצים מתוך ${recommendations.summary.totalDays} ימים`
                  : "טוען המלצות..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!recommendations ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">טוען המלצות...</p>
                </div>
              ) : recommendations.results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>אין המלצות זמינות</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendations.results
                    .filter((r: any) => Math.abs(r.change) > 2)
                    .slice(0, 20)
                    .map((rec: any) => (
                      <div
                        key={rec.date}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{rec.date}</span>
                            {rec.change > 0 ? (
                              <Badge variant="default" className="bg-green-500">
                                +{rec.change.toFixed(1)}%
                              </Badge>
                            ) : (
                              <Badge variant="destructive">{rec.change.toFixed(1)}%</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.reasoning}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            {rec.currentPrice ? formatCurrency(rec.currentPrice) : "אין מחיר"} →{" "}
                            {formatCurrency(rec.recommendedPrice)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>צור כלל תמחור חדש</DialogTitle>
            <DialogDescription>הגדר כלל אוטומטי לעדכון מחירים</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם הכלל</Label>
              <Input placeholder="לדוגמה: העלאת מחיר בסופ״ש" />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea placeholder="תיאור הכלל..." />
            </div>
            <div>
              <Label>סוג כלל</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demand_based">מבוסס ביקוש</SelectItem>
                  <SelectItem value="competitor_based">מבוסס מתחרים</SelectItem>
                  <SelectItem value="time_based">מבוסס זמן</SelectItem>
                  <SelectItem value="occupancy_based">מבוסס תפוסה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>עדיפות</Label>
              <Input type="number" placeholder="0-100" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ביטול
            </Button>
            <Button onClick={() => toast.info("תכונה בפיתוח")}>צור כלל</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Engine Dialog */}
      <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הרץ מנוע תמחור</DialogTitle>
            <DialogDescription>
              המנוע יחשב מחירים אופטימליים ל-30 ימים הבאים
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm">
                המנוע יבדוק את כל הכללים הפעילים ויחשב מחירים אופטימליים על בסיס:
              </p>
              <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                <li>רמת ביקוש ותפוסה</li>
                <li>מחירי מתחרים</li>
                <li>תחזיות ביקוש</li>
                <li>יום בשבוע ועונתיות</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunDialog(false)}>
              ביטול
            </Button>
            <Button variant="outline" onClick={() => runEngine(false)}>
              הצג המלצות בלבד
            </Button>
            <Button onClick={() => runEngine(true)}>
              <Check className="w-4 h-4 mr-2" />
              החל אוטומטית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
