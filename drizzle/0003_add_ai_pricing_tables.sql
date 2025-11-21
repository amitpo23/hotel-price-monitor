-- Add AI Chat and Pricing tables
CREATE TABLE IF NOT EXISTS `chatConversations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `title` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `chatMessages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `conversationId` int NOT NULL,
  `role` enum('user', 'assistant', 'system') NOT NULL,
  `content` text NOT NULL,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conversationId`) REFERENCES `chatConversations`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `priceRecommendations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `hotelId` int NOT NULL,
  `checkInDate` varchar(10) NOT NULL,
  `roomType` enum('room_only', 'with_breakfast') NOT NULL,
  `currentPrice` int,
  `recommendedPrice` int NOT NULL,
  `confidence` int DEFAULT 0,
  `reasoning` text,
  `marketPosition` varchar(50),
  `expectedRevenue` int,
  `competitorAvgPrice` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`)
);

CREATE TABLE IF NOT EXISTS `pricingAlerts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `alertType` enum('price_drop', 'price_increase', 'market_shift', 'opportunity', 'warning') NOT NULL,
  `severity` enum('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `metadata` text,
  `isRead` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);

-- Create indexes for better performance
CREATE INDEX `idx_chatMessages_conversationId` ON `chatMessages`(`conversationId`);
CREATE INDEX `idx_priceRecommendations_hotelId_date` ON `priceRecommendations`(`hotelId`, `checkInDate`);
CREATE INDEX `idx_pricingAlerts_userId_isRead` ON `pricingAlerts`(`userId`, `isRead`);
