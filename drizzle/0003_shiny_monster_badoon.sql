CREATE TABLE `chatConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceChanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`previousPrice` int,
	`newPrice` int NOT NULL,
	`changeAmount` int NOT NULL,
	`changePercent` int NOT NULL,
	`changeType` enum('increase','decrease','no_change') NOT NULL,
	`diffData` text,
	`screenshotUrl` text,
	`triggeredAlert` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceChanges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceRecommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`currentPrice` int,
	`recommendedPrice` int NOT NULL,
	`confidence` int DEFAULT 0,
	`reasoning` text,
	`marketPosition` varchar(50),
	`expectedRevenue` int,
	`competitorAvgPrice` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceRecommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricingAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`alertType` enum('price_drop','price_increase','market_shift','opportunity','warning') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricingAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proxyPool` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`proxyUrl` text NOT NULL,
	`country` varchar(2),
	`provider` varchar(100),
	`isActive` int NOT NULL DEFAULT 1,
	`lastUsed` timestamp,
	`successRate` int DEFAULT 100,
	`avgResponseTime` int,
	`failedAttempts` int DEFAULT 0,
	`totalRequests` int DEFAULT 0,
	`successfulRequests` int DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proxyPool_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scraperConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`fetcherType` enum('http','playwright') NOT NULL DEFAULT 'http',
	`useProxy` int NOT NULL DEFAULT 0,
	`proxyCountry` varchar(2),
	`priceSelector` varchar(500),
	`selectorType` enum('css','xpath','jsonpath') DEFAULT 'css',
	`browserSteps` text,
	`changeThreshold` int,
	`onlyPriceDrops` int DEFAULT 0,
	`conditionalTriggers` text,
	`customHeaders` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraperConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visualSelectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`elementPath` text NOT NULL,
	`selectorType` enum('css','xpath') NOT NULL DEFAULT 'css',
	`screenshotUrl` text,
	`boundingBox` varchar(100),
	`extractType` enum('text','attribute','html') NOT NULL DEFAULT 'text',
	`attributeName` varchar(100),
	`expectedPattern` varchar(500),
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visualSelectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhookConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`webhookUrl` text NOT NULL,
	`method` enum('POST','GET','PUT') NOT NULL DEFAULT 'POST',
	`headers` text,
	`triggerEvents` text NOT NULL,
	`payloadTemplate` text,
	`isActive` int NOT NULL DEFAULT 1,
	`lastTriggered` timestamp,
	`successCount` int DEFAULT 0,
	`failureCount` int DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhookConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatConversations` ADD CONSTRAINT `chatConversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chatMessages` ADD CONSTRAINT `chatMessages_conversationId_chatConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `chatConversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceChanges` ADD CONSTRAINT `priceChanges_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `priceRecommendations` ADD CONSTRAINT `priceRecommendations_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricingAlerts` ADD CONSTRAINT `pricingAlerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proxyPool` ADD CONSTRAINT `proxyPool_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scraperConfigs` ADD CONSTRAINT `scraperConfigs_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scraperConfigs` ADD CONSTRAINT `scraperConfigs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visualSelectors` ADD CONSTRAINT `visualSelectors_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visualSelectors` ADD CONSTRAINT `visualSelectors_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhookConfigs` ADD CONSTRAINT `webhookConfigs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;