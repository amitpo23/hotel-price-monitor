import { eq, desc, and, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  hotels, InsertHotel,
  scanConfigs, InsertScanConfig,
  scanConfigHotels,
  scanSchedules, InsertScanSchedule,
  scans, InsertScan,
  scanResults, InsertScanResult,
  scraperErrors, InsertScraperError,
  scrapeSnapshots, InsertScrapeSnapshot,
  chatConversations, InsertChatConversation,
  chatMessages, InsertChatMessage,
  priceRecommendations, InsertPriceRecommendation,
  pricingAlerts, InsertPricingAlert
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (
      user.openId === ENV.ownerOpenId ||
      (ENV.ownerEmail && user.email && user.email.toLowerCase() === ENV.ownerEmail.toLowerCase())
    ) {
      // Auto-promote owner by openId or email match
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Hotel Management
export async function createHotel(hotel: InsertHotel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(hotels).values(hotel);
  return result;
}

export async function getHotels(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hotels).where(eq(hotels.createdBy, userId));
}

export async function getAllHotels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hotels);
}

export async function getHotelById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(hotels).where(eq(hotels.id, id)).limit(1);
  return result[0] || null;
}

export async function updateHotel(id: number, data: Partial<InsertHotel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(hotels).set(data).where(eq(hotels.id, id));
}

export async function deleteHotel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(hotels).where(eq(hotels.id, id));
}

// Scan Configuration
export async function createScanConfig(config: InsertScanConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scanConfigs).values(config);
  return result;
}

export async function getScanConfigs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanConfigs).where(eq(scanConfigs.createdBy, userId));
}

export async function getScanConfigById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scanConfigs).where(eq(scanConfigs.id, id)).limit(1);
  return result[0] || null;
}

export async function updateScanConfig(id: number, data: Partial<InsertScanConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(scanConfigs).set(data).where(eq(scanConfigs.id, id));
}

export async function deleteScanConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(scanConfigs).where(eq(scanConfigs.id, id));
}

// Scan Config Hotels (many-to-many relationship)
export async function addHotelToScanConfig(scanConfigId: number, hotelId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(scanConfigHotels).values({ scanConfigId, hotelId });
}

export async function getHotelsForScanConfig(scanConfigId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ hotel: hotels })
    .from(scanConfigHotels)
    .innerJoin(hotels, eq(scanConfigHotels.hotelId, hotels.id))
    .where(eq(scanConfigHotels.scanConfigId, scanConfigId));
  return result.map(r => r.hotel);
}

export async function removeHotelFromScanConfig(scanConfigId: number, hotelId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(scanConfigHotels)
    .where(eq(scanConfigHotels.scanConfigId, scanConfigId));
}

// Scan Schedules
export async function createScanSchedule(schedule: InsertScanSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(scanSchedules).values(schedule);
}

export async function getScanScheduleByConfigId(scanConfigId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scanSchedules).where(eq(scanSchedules.scanConfigId, scanConfigId)).limit(1);
  return result[0] || null;
}

export async function updateScanSchedule(id: number, data: Partial<InsertScanSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(scanSchedules).set(data).where(eq(scanSchedules.id, id));
}

// Scans
export async function createScan(scan: InsertScan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scans).values(scan);
  return result;
}

export async function getScanById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  return result[0] || null;
}

export async function getScansForConfig(scanConfigId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scans)
    .where(eq(scans.scanConfigId, scanConfigId))
    .orderBy(desc(scans.createdAt))
    .limit(limit);
}

export async function updateScan(id: number, data: Partial<InsertScan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(scans).set(data).where(eq(scans.id, id));
}

// Scan Results
export async function createScanResult(result: InsertScanResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  console.log(`[DB] 💾 Creating scan result: scanId=${result.scanId}, hotelId=${result.hotelId}, date=${result.checkInDate}, type=${result.roomType}, price=${result.price}`);
  return db.insert(scanResults).values(result);
}

export async function getScanResults(scanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanResults).where(eq(scanResults.scanId, scanId));
}

export async function getScanResultsWithHotels(scanId: number) {
  console.log(`[DB] 🔍 getScanResultsWithHotels called for scanId: ${scanId}`);
  const db = await getDb();
  if (!db) {
    console.error(`[DB] ❌ Database not available`);
    return [];
  }
  const result = await db
    .select({
      result: scanResults,
      hotel: hotels
    })
    .from(scanResults)
    .innerJoin(hotels, eq(scanResults.hotelId, hotels.id))
    .where(eq(scanResults.scanId, scanId));
  console.log(`[DB] ✅ Found ${result.length} scan results with hotels for scanId ${scanId}`);
  return result;
}

export async function getLatestScanResultsForConfig(scanConfigId: number) {
  console.log(`[DB] 🔍 getLatestScanResultsForConfig called for configId: ${scanConfigId}`);
  const db = await getDb();
  if (!db) {
    console.error(`[DB] ❌ Database not available`);
    return [];
  }

  // Get the latest scan for this config (use createdAt instead of completedAt)
  // This ensures we get scans even if they're still running or just completed
  console.log(`[DB] 📋 Fetching latest scan for config ${scanConfigId}...`);
  const latestScan = await db.select()
    .from(scans)
    .where(eq(scans.scanConfigId, scanConfigId))
    .orderBy(desc(scans.createdAt))  // Changed from completedAt to createdAt
    .limit(1);

  if (!latestScan[0]) {
    console.log(`[DB] ⚠️  No scans found for config ${scanConfigId}`);
    return [];
  }

  console.log(`[DB] ✅ Found latest scan: ID ${latestScan[0].id}, status: ${latestScan[0].status}, created: ${latestScan[0].createdAt}`);

  const results = await getScanResultsWithHotels(latestScan[0].id);
  console.log(`[DB] 📊 Returning ${results.length} results for scan ${latestScan[0].id}`);
  return results;
}

// Scraper Error Tracking
export async function createScraperError(error: InsertScraperError) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  console.log(`[DB] ⚠️  Logging scraper error: type=${error.errorType}, hotel=${error.hotelId}`);
  return db.insert(scraperErrors).values(error);
}

export async function getScraperErrors(hotelId?: number, sinceMinutes?: number) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = [];

  if (hotelId) {
    whereConditions.push(eq(scraperErrors.hotelId, hotelId));
  }

  if (sinceMinutes) {
    const cutoffTime = new Date(Date.now() - sinceMinutes * 60 * 1000);
    whereConditions.push(gte(scraperErrors.createdAt, cutoffTime));
  }

  if (whereConditions.length === 0) {
    return db.select().from(scraperErrors).orderBy(desc(scraperErrors.createdAt)).limit(100);
  }

  return db.select()
    .from(scraperErrors)
    .where(and(...whereConditions))
    .orderBy(desc(scraperErrors.createdAt))
    .limit(100);
}

export async function getScraperErrorStats(sinceMinutes = 1440) {
  const db = await getDb();
  if (!db) return null;

  const cutoffTime = new Date(Date.now() - sinceMinutes * 60 * 1000);

  // Get error counts by type
  const errorsByType = await db
    .select({
      errorType: scraperErrors.errorType,
      count: sql<number>`count(*)`,
    })
    .from(scraperErrors)
    .where(gte(scraperErrors.createdAt, cutoffTime))
    .groupBy(scraperErrors.errorType);

  // Get error counts by hotel
  const errorsByHotel = await db
    .select({
      hotelId: scraperErrors.hotelId,
      hotelName: hotels.name,
      count: sql<number>`count(*)`,
    })
    .from(scraperErrors)
    .leftJoin(hotels, eq(scraperErrors.hotelId, hotels.id))
    .where(gte(scraperErrors.createdAt, cutoffTime))
    .groupBy(scraperErrors.hotelId, hotels.name);

  // Get total error count
  const totalErrors = await db
    .select({ count: sql<number>`count(*)` })
    .from(scraperErrors)
    .where(gte(scraperErrors.createdAt, cutoffTime));

  return {
    totalErrors: totalErrors[0]?.count || 0,
    errorsByType,
    errorsByHotel,
    timeWindowMinutes: sinceMinutes,
  };
}

// AI Chat Functions
export async function createChatConversation(userId: number, title?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatConversations).values({ userId, title });
  return result;
}

export async function getChatConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(desc(chatConversations.updatedAt));
}

export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(chatMessages).values(message);
}

export async function getChatMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);
}

export async function deleteChatConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(chatConversations).where(eq(chatConversations.id, id));
}

// Price Recommendations
export async function createPriceRecommendation(recommendation: InsertPriceRecommendation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  console.log(`[DB] 💡 Creating price recommendation: hotel=${recommendation.hotelId}, date=${recommendation.checkInDate}, recommended=₪${recommendation.recommendedPrice}`);
  return db.insert(priceRecommendations).values(recommendation);
}

export async function getPriceRecommendations(hotelId: number, fromDate?: string, toDate?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let whereConditions = [eq(priceRecommendations.hotelId, hotelId)];
  
  if (fromDate) {
    whereConditions.push(gte(priceRecommendations.checkInDate, fromDate));
  }
  
  return db.select()
    .from(priceRecommendations)
    .where(and(...whereConditions))
    .orderBy(priceRecommendations.checkInDate);
}

export async function getLatestPriceRecommendation(hotelId: number, checkInDate: string, roomType: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(priceRecommendations)
    .where(and(
      eq(priceRecommendations.hotelId, hotelId),
      eq(priceRecommendations.checkInDate, checkInDate),
      eq(priceRecommendations.roomType, roomType as any)
    ))
    .orderBy(desc(priceRecommendations.createdAt))
    .limit(1);
  
  return result[0] || null;
}

// Pricing Alerts
export async function createPricingAlert(alert: InsertPricingAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  console.log(`[DB] 🚨 Creating pricing alert: type=${alert.alertType}, severity=${alert.severity}`);
  return db.insert(pricingAlerts).values(alert);
}

export async function getPricingAlerts(userId: number, unreadOnly = false) {
  const db = await getDb();
  if (!db) return [];
  
  let whereConditions = [eq(pricingAlerts.userId, userId)];
  
  if (unreadOnly) {
    whereConditions.push(eq(pricingAlerts.isRead, 0));
  }
  
  return db.select()
    .from(pricingAlerts)
    .where(and(...whereConditions))
    .orderBy(desc(pricingAlerts.createdAt));
}

export async function markAlertAsRead(alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(pricingAlerts).set({ isRead: 1 }).where(eq(pricingAlerts.id, alertId));
}

export async function deleteAlert(alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(pricingAlerts).where(eq(pricingAlerts.id, alertId));
}

// Scrape Snapshots
export async function createScrapeSnapshot(snapshot: InsertScrapeSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  console.log(`[DB] 📸 Saving scrape snapshot: type=${snapshot.snapshotType}, hotel=${snapshot.hotelId}, size=${snapshot.dataSize}`);
  return db.insert(scrapeSnapshots).values(snapshot);
}

export async function getScrapeSnapshot(snapshotId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scrapeSnapshots).where(eq(scrapeSnapshots.id, snapshotId)).limit(1);
  return result[0] || null;
}

export async function getSnapshotsForScan(scanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(scrapeSnapshots)
    .where(eq(scrapeSnapshots.scanId, scanId))
    .orderBy(desc(scrapeSnapshots.createdAt));
}

// Health Monitoring
export async function getScrapeHealthSummary(sinceMinutes = 1440) {
  const db = await getDb();
  if (!db) return null;

  const cutoffTime = new Date(Date.now() - sinceMinutes * 60 * 1000);

  // Total scans
  const totalScans = await db
    .select({ count: sql<number>`count(*)` })
    .from(scans)
    .where(gte(scans.createdAt, cutoffTime));

  // Completed scans
  const completedScans = await db
    .select({ count: sql<number>`count(*)` })
    .from(scans)
    .where(and(
      gte(scans.createdAt, cutoffTime),
      eq(scans.status, "completed")
    ));

  // Failed scans
  const failedScans = await db
    .select({ count: sql<number>`count(*)` })
    .from(scans)
    .where(and(
      gte(scans.createdAt, cutoffTime),
      eq(scans.status, "failed")
    ));

  // Average results per scan
  const avgResultsPerScan = await db
    .select({
      avgResults: sql<number>`avg(result_count)`,
    })
    .from(
      db.select({
        scanId: scanResults.scanId,
        result_count: sql<number>`count(*)`.as('result_count'),
      })
      .from(scanResults)
      .innerJoin(scans, eq(scanResults.scanId, scans.id))
      .where(gte(scans.createdAt, cutoffTime))
      .groupBy(scanResults.scanId)
      .as('scan_counts')
    );

  // Total errors
  const totalErrors = await db
    .select({ count: sql<number>`count(*)` })
    .from(scraperErrors)
    .where(gte(scraperErrors.createdAt, cutoffTime));

  const total = totalScans[0]?.count || 0;
  const completed = completedScans[0]?.count || 0;
  const failed = failedScans[0]?.count || 0;
  const errors = totalErrors[0]?.count || 0;

  return {
    timeWindowMinutes: sinceMinutes,
    totalScans: total,
    completedScans: completed,
    failedScans: failed,
    runningScans: total - completed - failed,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    averageResultsPerScan: Math.round(avgResultsPerScan[0]?.avgResults || 0),
    totalErrors: errors,
    errorRate: total > 0 ? Math.round((errors / total) * 100) : 0,
  };
}
