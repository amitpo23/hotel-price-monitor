import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ScanProgressProps {
  scanId: number;
  onComplete?: () => void;
}

export function ScanProgress({ scanId, onComplete }: ScanProgressProps) {
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Poll for scan progress every 2 seconds
  const { data: progress, refetch } = trpc.scans.execute.getStatus.useQuery(
    { scanId },
    {
      enabled: pollingEnabled,
      refetchInterval: pollingEnabled ? 2000 : false,
    }
  );

  useEffect(() => {
    if (progress && (progress.status === "completed" || progress.status === "failed")) {
      setPollingEnabled(false);
      if (progress.status === "completed" && onComplete) {
        onComplete();
      }
    }
  }, [progress, onComplete]);

  if (!progress) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading scan status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage =
    progress.totalHotels > 0 ? (progress.completedHotels / progress.totalHotels) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {progress.status === "running" && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              Scan in Progress
            </>
          )}
          {progress.status === "completed" && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Scan Completed
            </>
          )}
          {progress.status === "failed" && (
            <>
              <AlertCircle className="h-5 w-5 text-red-500" />
              Scan Failed
            </>
          )}
        </CardTitle>
        <CardDescription>
          Scan ID: {scanId} • {progress.completedHotels} of {progress.totalHotels} hotels completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {progress.status === "running" && (
          <p className="text-sm text-muted-foreground">
            Scanning hotels and collecting price data. This may take several minutes...
          </p>
        )}

        {progress.status === "completed" && (
          <p className="text-sm text-green-600">
            ✓ All hotels scanned successfully! Check the Results page to view the data.
          </p>
        )}

        {progress.status === "failed" && progress.error && (
          <p className="text-sm text-red-600">
            ✗ Error: {progress.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
