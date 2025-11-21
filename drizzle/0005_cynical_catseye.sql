CREATE TABLE `ab_test_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`variant` enum('A','B') NOT NULL,
	`eventType` enum('view','booking','revenue') NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`roomType` enum('room_only','with_breakfast') NOT NULL,
	`price` int,
	`revenue` int,
	`sessionId` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_test_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ab_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','running','paused','completed') NOT NULL DEFAULT 'draft',
	`variantA` text NOT NULL,
	`variantB` text NOT NULL,
	`trafficSplit` int NOT NULL DEFAULT 50,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`variantARevenue` int DEFAULT 0,
	`variantBRevenue` int DEFAULT 0,
	`variantABookings` int DEFAULT 0,
	`variantBBookings` int DEFAULT 0,
	`pValue` int,
	`confidenceLevel` int,
	`winner` enum('none','variantA','variantB','inconclusive') DEFAULT 'none',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ab_tests_id` PRIMARY KEY(`id`)
);
