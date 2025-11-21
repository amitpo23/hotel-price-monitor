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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
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

// AI Chat Conversations
export const chatConversations = mysqlTable("chatConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// AI Chat Messages
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON: query results, charts data, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Price Recommendations
export const priceRecommendations = mysqlTable("priceRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  checkInDate: varchar("checkInDate", { length: 10 }).notNull(),
  roomType: mysqlEnum("roomType", ["room_only", "with_breakfast"]).notNull(),
  currentPrice: int("currentPrice"), // Current price in market
  recommendedPrice: int("recommendedPrice").notNull(), // AI recommended price
  confidence: int("confidence").default(0), // 0-100 confidence score
  reasoning: text("reasoning"), // Explanation for the recommendation
  marketPosition: varchar("marketPosition", { length: 50 }), // e.g., "below_market", "competitive", "premium"
  expectedRevenue: int("expectedRevenue"), // Estimated revenue with recommended price
  competitorAvgPrice: int("competitorAvgPrice"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Pricing Alerts
export const pricingAlerts = mysqlTable("pricingAlerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  alertType: mysqlEnum("alertType", ["price_drop", "price_increase", "market_shift", "opportunity", "warning"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON: related hotels, price changes, etc.
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type PriceRecommendation = typeof priceRecommendations.$inferSelect;
export type InsertPriceRecommendation = typeof priceRecommendations.$inferInsert;
export type PricingAlert = typeof pricingAlerts.$inferSelect;
export type InsertPricingAlert = typeof pricingAlerts.$inferInsert;

// Advanced Scraper Configuration - inspired by changedetection.io
export const scraperConfigs = mysqlTable("scraperConfigs", {
  id: int("id").autoincrement().primaryKey(),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Fetcher configuration
  fetcherType: mysqlEnum("fetcherType", ["http", "playwright"]).default("http").notNull(), // http = fast, playwright = JS-enabled
  useProxy: int("useProxy").default(0).notNull(), // Use proxy rotation
  proxyCountry: varchar("proxyCountry", { length: 2 }), // e.g., "IL", "US"
  
  // Selectors for price extraction
  priceSelector: varchar("priceSelector", { length: 500 }), // CSS selector or XPath
  selectorType: mysqlEnum("selectorType", ["css", "xpath", "jsonpath"]).default("css"),
  
  // Browser Steps (JSON array of actions for Playwright)
  browserSteps: text("browserSteps"), // JSON: [{ action: "click", selector: "button.dates" }, ...]
  
  // Change detection configuration
  changeThreshold: int("changeThreshold"), // Min price change in % to trigger alert (e.g., 5 = 5%)
  onlyPriceDrops: int("onlyPriceDrops").default(0), // Only alert on price drops, not increases
  
  // Conditional triggers
  conditionalTriggers: text("conditionalTriggers"), // JSON: [{ type: "below", value: 500 }, ...]
  
  // Headers and custom config
  customHeaders: text("customHeaders"), // JSON: { "User-Agent": "...", ... }
  
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Price change history for diff comparison
export const priceChanges = mysqlTable("priceChanges", {
  id: int("id").autoincrement().primaryKey(),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  checkInDate: varchar("checkInDate", { length: 10 }).notNull(),
  roomType: mysqlEnum("roomType", ["room_only", "with_breakfast"]).notNull(),
  
  previousPrice: int("previousPrice"), // Previous price
  newPrice: int("newPrice").notNull(), // New detected price
  changeAmount: int("changeAmount").notNull(), // Absolute change
  changePercent: int("changePercent").notNull(), // Percentage change (x100, e.g., 500 = 5%)
  
  changeType: mysqlEnum("changeType", ["increase", "decrease", "no_change"]).notNull(),
  
  // Diff data
  diffData: text("diffData"), // JSON: detailed comparison data
  screenshotUrl: text("screenshotUrl"), // URL to screenshot if captured
  
  triggeredAlert: int("triggeredAlert").default(0), // Whether this triggered an alert
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Proxy pool management
export const proxyPool = mysqlTable("proxyPool", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  proxyUrl: text("proxyUrl").notNull(), // http://user:pass@host:port or socks5://...
  country: varchar("country", { length: 2 }), // ISO country code
  provider: varchar("provider", { length: 100 }), // e.g., "BrightData", "Oxylabs"
  
  // Health tracking
  isActive: int("isActive").default(1).notNull(),
  lastUsed: timestamp("lastUsed"),
  successRate: int("successRate").default(100), // 0-100
  avgResponseTime: int("avgResponseTime"), // milliseconds
  failedAttempts: int("failedAttempts").default(0),
  
  // Usage stats
  totalRequests: int("totalRequests").default(0),
  successfulRequests: int("successfulRequests").default(0),
  
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Visual selectors saved by users
export const visualSelectors = mysqlTable("visualSelectors", {
  id: int("id").autoincrement().primaryKey(),
  hotelId: int("hotelId").notNull().references(() => hotels.id),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Selector definition
  elementPath: text("elementPath").notNull(), // CSS selector or XPath
  selectorType: mysqlEnum("selectorType", ["css", "xpath"]).default("css").notNull(),
  
  // Visual context
  screenshotUrl: text("screenshotUrl"), // Screenshot with highlighted element
  boundingBox: varchar("boundingBox", { length: 100 }), // JSON: { x, y, width, height }
  
  // What to extract
  extractType: mysqlEnum("extractType", ["text", "attribute", "html"]).default("text").notNull(),
  attributeName: varchar("attributeName", { length: 100 }), // If extractType = "attribute"
  
  // Validation
  expectedPattern: varchar("expectedPattern", { length: 500 }), // Regex pattern to validate extracted value
  
  isActive: int("isActive").default(1).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Webhook configurations for notifications
export const webhookConfigs = mysqlTable("webhookConfigs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Webhook details
  webhookUrl: text("webhookUrl").notNull(),
  method: mysqlEnum("method", ["POST", "GET", "PUT"]).default("POST").notNull(),
  headers: text("headers"), // JSON: custom headers
  
  // When to trigger
  triggerEvents: text("triggerEvents").notNull(), // JSON: ["price_drop", "scan_complete", ...]
  
  // Payload template (Jinja2-style)
  payloadTemplate: text("payloadTemplate"), // JSON template with {{variables}}
  
  // Status
  isActive: int("isActive").default(1).notNull(),
  lastTriggered: timestamp("lastTriggered"),
  successCount: int("successCount").default(0),
  failureCount: int("failureCount").default(0),
  
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScraperConfig = typeof scraperConfigs.$inferSelect;
export type InsertScraperConfig = typeof scraperConfigs.$inferInsert;
export type PriceChange = typeof priceChanges.$inferSelect;
export type InsertPriceChange = typeof priceChanges.$inferInsert;
export type ProxyPool = typeof proxyPool.$inferSelect;
export type InsertProxyPool = typeof proxyPool.$inferInsert;
export type VisualSelector = typeof visualSelectors.$inferSelect;
export type InsertVisualSelector = typeof visualSelectors.$inferInsert;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfigs.$inferInsert;