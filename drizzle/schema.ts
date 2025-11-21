import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Unique identifier for the user (UUID). Replaces Manus OAuth openId. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Hashed password for local authentication */
  password: varchar("password", { length: 255 }).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Hotel management tables
export const hotels = mysqlTable("hotels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  bookingUrl: text("bookingUrl").notNull(),
  location: varchar("location", { length: 255 }),
  category: mysqlEnum("category", ["target", "competitor"]).default("competitor").notNull(),
  isActive: int("isActive").default(1).notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const scanConfigs = mysqlTable("scanConfigs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  targetHotelId: int("targetHotelId").notNull().references(() => hotels.id),
  daysForward: int("daysForward").default(60).notNull(),
  roomTypes: text("roomTypes").notNull(), // JSON array: ["room_only", "with_breakfast"]
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const scanConfigHotels = mysqlTable("scanConfigHotels", {
  id: int("id").autoincrement().primaryKey(),
  scanConfigId: int("scanConfigId").notNull().references(() => scanConfigs.id, { onDelete: "cascade" }),
  hotelId: int("hotelId").notNull().references(() => hotels.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const scanSchedules = mysqlTable("scanSchedules", {
  id: int("id").autoincrement().primaryKey(),
  scanConfigId: int("scanConfigId").notNull().references(() => scanConfigs.id, { onDelete: "cascade" }),
  cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Jerusalem").notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const scans = mysqlTable("scans", {
  id: int("id").autoincrement().primaryKey(),
  scanConfigId: int("scanConfigId").notNull().references(() => scanConfigs.id),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  totalHotels: int("totalHotels").default(0),
  completedHotels: int("completedHotels").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const scanResults = mysqlTable("scanResults", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull().references(() => scans.id, { onDelete: "cascade" }),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  checkInDate: varchar("checkInDate", { length: 10 }).notNull(), // YYYY-MM-DD
  roomType: mysqlEnum("roomType", ["room_only", "with_breakfast"]).notNull(),
  price: int("price"), // Price in cents to avoid decimal issues
  currency: varchar("currency", { length: 3 }).default("ILS"),
  isAvailable: int("isAvailable").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Scraper error tracking for debugging and monitoring
export const scraperErrors = mysqlTable("scraperErrors", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").references(() => scans.id, { onDelete: "cascade" }),
  hotelId: int("hotelId").references(() => hotels.id),
  errorType: mysqlEnum("errorType", ["timeout", "captcha", "parsing_failed", "network_error", "selector_not_found", "rate_limit", "other"]).notNull(),
  errorMessage: text("errorMessage").notNull(),
  stackTrace: text("stackTrace"),
  url: text("url"),
  checkInDate: varchar("checkInDate", { length: 10 }), // Date being scraped when error occurred
  metadata: text("metadata"), // JSON: additional context like browser version, selectors tried, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Store raw scraper output for debugging
export const scrapeSnapshots = mysqlTable("scrapeSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull().references(() => scans.id, { onDelete: "cascade" }),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  snapshotType: mysqlEnum("snapshotType", ["raw_json", "html_sample", "screenshot"]).notNull(),
  data: text("data").notNull(), // JSON or HTML content (compressed/truncated if needed)
  dataSize: int("dataSize"), // Size in bytes before storage
  checkInDate: varchar("checkInDate", { length: 10 }), // Date being scraped
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Hotel = typeof hotels.$inferSelect;
export type InsertHotel = typeof hotels.$inferInsert;
export type ScanConfig = typeof scanConfigs.$inferSelect;
export type InsertScanConfig = typeof scanConfigs.$inferInsert;
export type ScanSchedule = typeof scanSchedules.$inferSelect;
export type InsertScanSchedule = typeof scanSchedules.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;
export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = typeof scanResults.$inferInsert;
export type ScraperError = typeof scraperErrors.$inferSelect;
export type InsertScraperError = typeof scraperErrors.$inferInsert;
export type ScrapeSnapshot = typeof scrapeSnapshots.$inferSelect;
export type InsertScrapeSnapshot = typeof scrapeSnapshots.$inferInsert;