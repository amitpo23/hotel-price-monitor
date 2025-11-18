import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Calendar, Clock, Edit, Plus, Power, PowerOff, ScanLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RoomType = "room_only" | "with_breakfast";

export default function ScanConfigs() {
  const { user, loading: authLoading } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTargetHotel, setSelectedTargetHotel] = useState<string>("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<number[]>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<RoomType[]>(["room_only", "with_breakfast"]);
  const [daysForward, setDaysForward] = useState(60);
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const { data: configs, isLoading: configsLoading, refetch: refetchConfigs } = trpc.scans.configs.list.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: hotels, isLoading: hotelsLoading } = trpc.hotels.listAll.useQuery(undefined, {
    enabled: !!user,
  });

  const createMutation = trpc.scans.configs.create.useMutation({
    onSuccess: () => {
      toast.success("Scan configuration created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.scans.configs.delete.useMutation({
    onSuccess: () => {
      toast.success("Scan configuration deleted");
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleScheduleMutation = trpc.scans.schedules.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(`Schedule ${data.isEnabled ? "enabled" : "disabled"}`);
      refetchConfigs();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedTargetHotel("");
    setSelectedCompetitors([]);
    setSelectedRoomTypes(["room_only", "with_breakfast"]);
    setDaysForward(60);
    setScheduleTime("08:00");
    setScheduleEnabled(true);
  };

  const handleCompetitorToggle = (hotelId: number) => {
    setSelectedCompetitors((prev) =>
      prev.includes(hotelId)
        ? prev.filter((id) => id !== hotelId)
        : [...prev, hotelId]
    );
  };

  const handleRoomTypeToggle = (roomType: RoomType) => {
    setSelectedRoomTypes((prev) =>
      prev.includes(roomType)
        ? prev.filter((rt) => rt !== roomType)
        : [...prev, roomType]
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedTargetHotel) {
      toast.error("Please select a target hotel");
      return;
    }

    if (selectedCompetitors.length === 0) {
      toast.error("Please select at least one competitor");
      return;
    }

    if (selectedRoomTypes.length === 0) {
      toast.error("Please select at least one room type");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const configName = formData.get("name") as string;

    // Convert time to cron expression (e.g., "08:00" -> "0 0 8 * * *")
    const [hours, minutes] = scheduleTime.split(":");
    const cronExpression = `0 ${minutes} ${hours} * * *`;

    createMutation.mutate({
      name: configName,
      targetHotelId: parseInt(selectedTargetHotel),
      daysForward,
      roomTypes: selectedRoomTypes,
      hotelIds: selectedCompetitors,
      schedule: {
        cronExpression,
        timezone: "Asia/Jerusalem",
        isEnabled: scheduleEnabled,
      },
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const targetHotels = hotels?.filter((h) => h.category === "target") || [];
  const competitorHotels = hotels?.filter((h) => h.category === "competitor") || [];

  if (authLoading) {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scan Configurations</h1>
            <p className="text-muted-foreground mt-2">
              Configure automated price scans with room type filters and schedules
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} disabled={!hotels || hotels.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New Configuration
          </Button>
        </div>

        {hotelsLoading || configsLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : !hotels || hotels.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <ScanLine className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No hotels available</h3>
            <p className="text-muted-foreground mt-2">
              Please add hotels first before creating scan configurations
            </p>
          </div>
        ) : configs && configs.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Target Hotel</TableHead>
                  <TableHead>Competitors</TableHead>
                  <TableHead>Room Types</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => {
                  const targetHotel = hotels.find((h) => h.id === config.targetHotelId);
                  const roomTypes = JSON.parse(config.roomTypes) as RoomType[];
                  
                  return (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell>{targetHotel?.name || "—"}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {/* Will be populated from joined data */}
                          Multiple
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {roomTypes.includes("room_only") && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Room Only
                            </span>
                          )}
                          {roomTypes.includes("with_breakfast") && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              + Breakfast
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          Daily
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            config.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {config.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleScheduleMutation.mutate({ configId: config.id })}
                            title="Toggle schedule"
                          >
                            {config.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info("Edit functionality coming soon")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(config.id, config.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg">
            <ScanLine className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No scan configurations yet</h3>
            <p className="text-muted-foreground mt-2">
              Create your first scan configuration to start monitoring prices
            </p>
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Configuration
            </Button>
          </div>
        )}
      </div>

      {/* Add Configuration Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Scan Configuration</DialogTitle>
            <DialogDescription>
              Configure automated price monitoring with room type filters
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              {/* Configuration Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Configuration Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g., Scarlet vs Competitors - Daily Scan"
                />
              </div>

              {/* Target Hotel */}
              <div className="space-y-2">
                <Label htmlFor="targetHotel">Target Hotel *</Label>
                <Select
                  value={selectedTargetHotel}
                  onValueChange={setSelectedTargetHotel}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your hotel" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetHotels.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No target hotels available
                      </SelectItem>
                    ) : (
                      targetHotels.map((hotel) => (
                        <SelectItem key={hotel.id} value={hotel.id.toString()}>
                          {hotel.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Competitor Hotels */}
              <div className="space-y-2">
                <Label>Competitor Hotels * (Select at least one)</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                  {competitorHotels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No competitor hotels available</p>
                  ) : (
                    competitorHotels.map((hotel) => (
                      <div key={hotel.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`competitor-${hotel.id}`}
                          checked={selectedCompetitors.includes(hotel.id)}
                          onCheckedChange={() => handleCompetitorToggle(hotel.id)}
                        />
                        <label
                          htmlFor={`competitor-${hotel.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {hotel.name}
                          {hotel.location && (
                            <span className="text-muted-foreground ml-2">({hotel.location})</span>
                          )}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedCompetitors.length} hotel(s)
                </p>
              </div>

              {/* Room Types */}
              <div className="space-y-2">
                <Label>Room Types * (Select at least one)</Label>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="room-only"
                      checked={selectedRoomTypes.includes("room_only")}
                      onCheckedChange={() => handleRoomTypeToggle("room_only")}
                    />
                    <label
                      htmlFor="room-only"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Room Only (לינה בלבד)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="with-breakfast"
                      checked={selectedRoomTypes.includes("with_breakfast")}
                      onCheckedChange={() => handleRoomTypeToggle("with_breakfast")}
                    />
                    <label
                      htmlFor="with-breakfast"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      With Breakfast (לינה עם ארוחת בוקר)
                    </label>
                  </div>
                </div>
              </div>

              {/* Days Forward */}
              <div className="space-y-2">
                <Label htmlFor="daysForward">Days Forward</Label>
                <Input
                  id="daysForward"
                  type="number"
                  min="1"
                  max="365"
                  value={daysForward}
                  onChange={(e) => setDaysForward(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Number of days to scan ahead (default: 60)
                </p>
              </div>

              {/* Schedule */}
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label>Automated Schedule</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule-enabled"
                      checked={scheduleEnabled}
                      onCheckedChange={(checked) => setScheduleEnabled(checked as boolean)}
                    />
                    <label
                      htmlFor="schedule-enabled"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Enable automatic scanning
                    </label>
                  </div>
                </div>

                {scheduleEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="scheduleTime">Daily Scan Time</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-40"
                      />
                      <span className="text-sm text-muted-foreground">
                        (Israel Time - Asia/Jerusalem)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The scan will run automatically every day at this time
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Configuration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
