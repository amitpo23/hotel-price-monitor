CREATE TABLE `competitorAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`competitorHotelId` int NOT NULL,
	`alertType` enum('price_drop','price_increase','undercut','price_gap','availability_change') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`checkInDate` varchar(10),
	`roomType` enum('room_only','with_breakfast'),
	`competitorOldPrice` int,
	`competitorNewPrice` int,
	`ourCurrentPrice` int,
	`priceGap` int,
	`priceGapPercent` int,
	`recommendedAction` text,
	`suggestedPrice` int,
	`isRead` int NOT NULL DEFAULT 0,
	`isActioned` int NOT NULL DEFAULT 0,
	`actionTaken` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitorAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `demandForecasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`forecastDate` varchar(10) NOT NULL,
	`predictedOccupancy` int NOT NULL,
	`predictedDemand` int NOT NULL,
	`confidenceInterval` int NOT NULL,
	`seasonalityFactor` int,
	`eventImpact` int,
	`trendFactor` int,
	`recommendedPrice` int,
	`priceRange` varchar(50),
	`modelVersion` varchar(50),
	`features` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demandForecasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hotelPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`price` int NOT NULL,
	`currency` varchar(3) DEFAULT 'ILS',
	`pricingStrategy` varchar(50),
	`appliedRuleId` int,
	`roomsAvailable` int,
	`isAvailable` int NOT NULL DEFAULT 1,
	`setBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hotelPrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `occupancyData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`occupancyDate` varchar(10) NOT NULL,
	`totalRooms` int NOT NULL,
	`occupiedRooms` int NOT NULL,
	`occupancyRate` int NOT NULL,
	`roomTypeBreakdown` text,
	`dataSource` enum('manual','pms','booking_platform','estimated') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `occupancyData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`oldPrice` int,
	`newPrice` int NOT NULL,
	`changeAmount` int NOT NULL,
	`changePercent` int,
	`changeReason` enum('manual','dynamic_rule','competitor_match','demand_forecast','bulk_update','api') NOT NULL,
	`ruleId` int,
	`notes` text,
	`changedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ruleType` enum('demand_based','competitor_based','time_based','occupancy_based','event_based') NOT NULL,
	`conditions` text NOT NULL,
	`actions` text NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`timesApplied` int DEFAULT 0,
	`lastApplied` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricingRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`templateType` enum('seasonal','event','promotion','base_rate') NOT NULL,
	`priceAdjustments` text NOT NULL,
	`validFrom` varchar(10),
	`validTo` varchar(10),
	`roomTypes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricingTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rateParity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`platform` enum('booking_com','expedia','direct_website','airbnb','hotels_com','agoda') NOT NULL,
	`price` int,
	`currency` varchar(3) DEFAULT 'ILS',
	`isParityViolation` int NOT NULL DEFAULT 0,
	`expectedPrice` int,
	`priceDifference` int,
	`isAvailable` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rateParity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenueMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`metricDate` varchar(10) NOT NULL,
	`revPAR` int,
	`adr` int,
	`occupancyRate` int,
	`totalRevenue` int,
	`roomRevenue` int,
	`totalRooms` int,
	`roomsSold` int,
	`roomsAvailable` int,
	`totalBookings` int,
	`cancellations` int,
	`noShows` int,
	`marketShare` int,
	`priceIndex` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenueMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `competitorAlerts` ADD CONSTRAINT `competitorAlerts_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `competitorAlerts` ADD CONSTRAINT `competitorAlerts_competitorHotelId_hotels_id_fk` FOREIGN KEY (`competitorHotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demandForecasts` ADD CONSTRAINT `demandForecasts_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hotelPrices` ADD CONSTRAINT `hotelPrices_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hotelPrices` ADD CONSTRAINT `hotelPrices_setBy_users_id_fk` FOREIGN KEY (`setBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occupancyData` ADD CONSTRAINT `occupancyData_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `priceHistory_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceHistory` ADD CONSTRAINT `priceHistory_changedBy_users_id_fk` FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricingRules` ADD CONSTRAINT `pricingRules_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricingRules` ADD CONSTRAINT `pricingRules_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricingTemplates` ADD CONSTRAINT `pricingTemplates_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rateParity` ADD CONSTRAINT `rateParity_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revenueMetrics` ADD CONSTRAINT `revenueMetrics_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;