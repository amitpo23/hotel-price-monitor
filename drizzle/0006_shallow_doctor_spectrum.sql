CREATE TABLE `cancellation_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotelId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`freeCancel` enum('yes','no') NOT NULL DEFAULT 'yes',
	`freeCancelDays` int,
	`cancellationFee` int,
	`feeType` enum('fixed','percentage') DEFAULT 'fixed',
	`refundable` enum('full','partial','none') NOT NULL DEFAULT 'full',
	`refundPercentage` int,
	`flexibilityLevel` enum('very_flexible','flexible','moderate','strict','very_strict') NOT NULL DEFAULT 'moderate',
	`minAdvanceBooking` int,
	`maxAdvanceBooking` int,
	`isActive` int NOT NULL DEFAULT 1,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cancellation_policies_id` PRIMARY KEY(`id`)
);
