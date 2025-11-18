CREATE TABLE `hotels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`bookingUrl` text NOT NULL,
	`location` varchar(255),
	`category` enum('target','competitor') NOT NULL DEFAULT 'competitor',
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hotels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanConfigHotels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanConfigId` int NOT NULL,
	`hotelId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scanConfigHotels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`targetHotelId` int NOT NULL,
	`daysForward` int NOT NULL DEFAULT 60,
	`roomTypes` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scanConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`hotelId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`price` int,
	`currency` varchar(3) DEFAULT 'ILS',
	`isAvailable` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scanResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanConfigId` int NOT NULL,
	`cronExpression` varchar(100) NOT NULL,
	`timezone` varchar(50) NOT NULL DEFAULT 'Asia/Jerusalem',
	`isEnabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scanSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanConfigId` int NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	`totalHotels` int DEFAULT 0,
	`completedHotels` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanConfigHotels` ADD CONSTRAINT `scanConfigHotels_scanConfigId_scanConfigs_id_fk` FOREIGN KEY (`scanConfigId`) REFERENCES `scanConfigs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanConfigHotels` ADD CONSTRAINT `scanConfigHotels_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanConfigs` ADD CONSTRAINT `scanConfigs_targetHotelId_hotels_id_fk` FOREIGN KEY (`targetHotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanConfigs` ADD CONSTRAINT `scanConfigs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanResults` ADD CONSTRAINT `scanResults_scanId_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanResults` ADD CONSTRAINT `scanResults_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanSchedules` ADD CONSTRAINT `scanSchedules_scanConfigId_scanConfigs_id_fk` FOREIGN KEY (`scanConfigId`) REFERENCES `scanConfigs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scans` ADD CONSTRAINT `scans_scanConfigId_scanConfigs_id_fk` FOREIGN KEY (`scanConfigId`) REFERENCES `scanConfigs`(`id`) ON DELETE no action ON UPDATE no action;