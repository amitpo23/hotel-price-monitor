# System Monitoring and Health Tracking

This document describes the monitoring and debugging features added to the hotel price monitoring system.

## Overview

The system now includes comprehensive monitoring capabilities to track scraper errors, store raw data snapshots, and provide health metrics.

## Database Tables

### `scraperErrors`
Tracks all errors that occur during scraping operations.

**Columns:**
- `id`: Primary key
- `scanId`: Reference to the scan where error occurred
- `hotelId`: Hotel being scraped when error occurred
- `errorType`: Type of error (timeout, captcha, parsing_failed, network_error, selector_not_found, rate_limit, other)
- `errorMessage`: Full error message
- `stackTrace`: Stack trace if available
- `url`: URL being scraped
- `checkInDate`: Date being scraped
- `metadata`: JSON with additional context
- `createdAt`: Timestamp

### `scrapeSnapshots`
Stores raw scraper output for debugging purposes.

**Columns:**
- `id`: Primary key
- `scanId`: Reference to the scan
- `hotelId`: Hotel being scraped
- `snapshotType`: Type of snapshot (raw_json, html_sample, screenshot)
- `data`: The actual data (JSON or HTML)
- `dataSize`: Size in bytes
- `checkInDate`: Date being scraped
- `createdAt`: Timestamp

## API Endpoints

All monitoring endpoints are available under `/api/trpc/monitoring.*`

### Error Tracking

#### `monitoring.errors.list`
Get recent scraper errors with optional filters.

**Input:**
```typescript
{
  hotelId?: number,        // Optional: filter by hotel
  sinceMinutes?: number    // Default: 1440 (24 hours)
}
```

**Example:**
```typescript
// Get all errors in last 24 hours
const errors = await trpc.monitoring.errors.list.query({});

// Get errors for specific hotel in last hour
const hotelErrors = await trpc.monitoring.errors.list.query({
  hotelId: 1,
  sinceMinutes: 60
});
```

#### `monitoring.errors.stats`
Get error statistics grouped by type and hotel.

**Input:**
```typescript
{
  sinceMinutes?: number    // Default: 1440 (24 hours)
}
```

**Output:**
```typescript
{
  totalErrors: number,
  errorsByType: Array<{ errorType: string, count: number }>,
  errorsByHotel: Array<{ hotelId: number, hotelName: string, count: number }>,
  timeWindowMinutes: number
}
```

### Snapshots

#### `monitoring.snapshots.get`
Get a specific snapshot by ID.

**Input:**
```typescript
{
  snapshotId: number
}
```

#### `monitoring.snapshots.listForScan`
Get all snapshots for a specific scan.

**Input:**
```typescript
{
  scanId: number
}
```

### Health Monitoring

#### `monitoring.health.summary`
Get overall system health summary.

**Input:**
```typescript
{
  sinceMinutes?: number    // Default: 1440 (24 hours)
}
```

**Output:**
```typescript
{
  timeWindowMinutes: number,
  totalScans: number,
  completedScans: number,
  failedScans: number,
  runningScans: number,
  successRate: number,           // Percentage
  averageResultsPerScan: number,
  totalErrors: number,
  errorRate: number              // Percentage
}
```

#### `monitoring.health.fullReport`
Get comprehensive health report including errors and stats.

**Input:**
```typescript
{
  sinceMinutes?: number    // Default: 1440 (24 hours)
}
```

**Output:**
```typescript
{
  health: { /* health summary */ },
  errors: { /* error stats */ },
  timestamp: string,
  timeWindowMinutes: number
}
```

## Usage Examples

### Debugging a Failed Scan

```typescript
// 1. Get health summary to identify issues
const health = await trpc.monitoring.health.summary.query({ sinceMinutes: 1440 });
console.log(`Success rate: ${health.successRate}%`);
console.log(`Error rate: ${health.errorRate}%`);

// 2. Get error details
const errorStats = await trpc.monitoring.errors.stats.query({ sinceMinutes: 1440 });
console.log('Errors by type:', errorStats.errorsByType);
console.log('Errors by hotel:', errorStats.errorsByHotel);

// 3. Get specific error details
const recentErrors = await trpc.monitoring.errors.list.query({ sinceMinutes: 60 });
recentErrors.forEach(error => {
  console.log(`${error.errorType}: ${error.errorMessage}`);
});

// 4. Get raw scraper output for debugging
const snapshots = await trpc.monitoring.snapshots.listForScan.query({ scanId: 123 });
const rawData = snapshots.find(s => s.snapshotType === 'raw_json');
console.log('Raw scraper output:', JSON.parse(rawData.data));
```

### Monitoring System Health

```typescript
// Get full health report
const report = await trpc.monitoring.health.fullReport.query({ sinceMinutes: 1440 });

console.log('=== System Health Report ===');
console.log(`Total Scans: ${report.health.totalScans}`);
console.log(`Success Rate: ${report.health.successRate}%`);
console.log(`Average Results per Scan: ${report.health.averageResultsPerScan}`);
console.log();
console.log('=== Error Analysis ===');
console.log(`Total Errors: ${report.errors.totalErrors}`);
report.errors.errorsByType.forEach(({ errorType, count }) => {
  console.log(`  ${errorType}: ${count}`);
});
```

### Analyzing Specific Hotel Issues

```typescript
// Check if a specific hotel is having issues
const hotelId = 1;
const errors = await trpc.monitoring.errors.list.query({
  hotelId,
  sinceMinutes: 1440
});

if (errors.length > 0) {
  console.log(`Hotel ${hotelId} has ${errors.length} errors in the last 24 hours`);

  // Group by error type
  const byType = errors.reduce((acc, err) => {
    acc[err.errorType] = (acc[err.errorType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Error breakdown:', byType);

  // Most common error
  const mostCommon = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  console.log(`Most common issue: ${mostCommon[0]} (${mostCommon[1]} occurrences)`);
}
```

## Automated Monitoring

The system automatically logs:
1. **All scraper errors** - Captured in `scraperErrors` table
2. **Raw scraper output** - Saved as snapshots for each hotel in each scan
3. **Error metadata** - Including command, configuration, and context

## Performance Considerations

- Snapshots are stored as TEXT fields in MySQL
- Large snapshots (>1MB) may slow down queries
- Consider adding automatic cleanup of old snapshots (>7 days)
- Index on `createdAt` allows efficient time-based queries

## Future Enhancements

Potential additions:
- Screenshot capture for visual debugging
- HTML sample storage for selector debugging
- Automated alerts when error rate exceeds threshold
- Dashboard UI for monitoring metrics
- Automatic selector healing based on error patterns
