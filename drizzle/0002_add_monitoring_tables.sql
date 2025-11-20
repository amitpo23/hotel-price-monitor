-- Migration: Add monitoring and debugging tables
-- Created: 2025-11-20
-- Purpose: Add error tracking and snapshot tables for scraper monitoring

-- Table for tracking scraper errors
CREATE TABLE IF NOT EXISTS `scraperErrors` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `scanId` int,
  `hotelId` int,
  `errorType` enum('timeout', 'captcha', 'parsing_failed', 'network_error', 'selector_not_found', 'rate_limit', 'other') NOT NULL,
  `errorMessage` text NOT NULL,
  `stackTrace` text,
  `url` text,
  `checkInDate` varchar(10),
  `metadata` text COMMENT 'JSON: additional context',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `scraperErrors_scanId_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `scraperErrors_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`)
);

-- Index for faster error queries
CREATE INDEX `scraperErrors_scanId_idx` ON `scraperErrors` (`scanId`);
CREATE INDEX `scraperErrors_hotelId_idx` ON `scraperErrors` (`hotelId`);
CREATE INDEX `scraperErrors_errorType_idx` ON `scraperErrors` (`errorType`);
CREATE INDEX `scraperErrors_createdAt_idx` ON `scraperErrors` (`createdAt`);

-- Table for storing raw scraper output snapshots
CREATE TABLE IF NOT EXISTS `scrapeSnapshots` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `scanId` int NOT NULL,
  `hotelId` int NOT NULL,
  `snapshotType` enum('raw_json', 'html_sample', 'screenshot') NOT NULL,
  `data` text NOT NULL COMMENT 'JSON or HTML content',
  `dataSize` int COMMENT 'Size in bytes before storage',
  `checkInDate` varchar(10),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `scrapeSnapshots_scanId_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `scrapeSnapshots_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`)
);

-- Index for faster snapshot queries
CREATE INDEX `scrapeSnapshots_scanId_idx` ON `scrapeSnapshots` (`scanId`);
CREATE INDEX `scrapeSnapshots_hotelId_idx` ON `scrapeSnapshots` (`hotelId`);
CREATE INDEX `scrapeSnapshots_snapshotType_idx` ON `scrapeSnapshots` (`snapshotType`);
CREATE INDEX `scrapeSnapshots_createdAt_idx` ON `scrapeSnapshots` (`createdAt`);
