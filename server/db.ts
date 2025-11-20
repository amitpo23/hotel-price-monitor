import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  hotels, InsertHotel,
  scanConfigs, InsertScanConfig,
  scanConfigHotels,
  scanSchedules, InsertScanSchedule,
  scans, InsertScan,
  scanResults, InsertScanResult
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
    } else if (user.openId === ENV.ownerOpenId) {
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
  return db.insert(scanResults).values(result);
}

export async function getScanResults(scanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanResults).where(eq(scanResults.scanId, scanId));
}

export async function getScanResultsWithHotels(scanId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      result: scanResults,
      hotel: hotels
    })
    .from(scanResults)
    .innerJoin(hotels, eq(scanResults.hotelId, hotels.id))
    .where(eq(scanResults.scanId, scanId));
  return result;
}

export async function getLatestScanResultsForConfig(scanConfigId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get the latest completed scan for this config
  // Order by id DESC to get the most recent scan reliably
  const latestScan = await db.select()
    .from(scans)
    .where(eq(scans.scanConfigId, scanConfigId))
    .orderBy(desc(scans.id))
    .limit(1);

  if (!latestScan[0]) return [];

  // Only return results if scan is completed
  if (latestScan[0].status !== 'completed') {
    console.log(`[DB] Latest scan ${latestScan[0].id} is still ${latestScan[0].status}`);
    return [];
  }

  return getScanResultsWithHotels(latestScan[0].id);
}
