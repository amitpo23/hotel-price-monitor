CREATE TABLE `scrapeSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`hotelId` int NOT NULL,
	`snapshotType` enum('raw_json','html_sample','screenshot') NOT NULL,
	`data` text NOT NULL,
	`dataSize` int,
	`checkInDate` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scrapeSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scraperErrors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int,
	`hotelId` int,
	`errorType` enum('timeout','captcha','parsing_failed','network_error','selector_not_found','rate_limit','other') NOT NULL,
	`errorMessage` text NOT NULL,
	`stackTrace` text,
	`url` text,
	`checkInDate` varchar(10),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scraperErrors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scrapeSnapshots` ADD CONSTRAINT `scrapeSnapshots_scanId_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scrapeSnapshots` ADD CONSTRAINT `scrapeSnapshots_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scraperErrors` ADD CONSTRAINT `scraperErrors_scanId_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scraperErrors` ADD CONSTRAINT `scraperErrors_hotelId_hotels_id_fk` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE no action ON UPDATE no action;