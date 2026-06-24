CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`packageId` int NOT NULL,
	`productName` varchar(120) NOT NULL,
	`packageLabel` varchar(120) NOT NULL,
	`totalPriceKs` int NOT NULL,
	`gameUserId` varchar(120),
	`gameServerId` varchar(120),
	`paymentMethod` varchar(60),
	`receiptKey` text,
	`receiptUrl` text,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`priceKs` int NOT NULL,
	`bonusLabel` varchar(60),
	`isPopular` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paymentAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`method` varchar(60) NOT NULL,
	`accountNumber` varchar(80) NOT NULL,
	`accountName` varchar(120),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `paymentAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`category` enum('popular','premium','other') NOT NULL,
	`description` text,
	`color` varchar(16) NOT NULL DEFAULT '#FF74B8',
	`imageUrl` text,
	`needsUserId` boolean NOT NULL DEFAULT true,
	`needsServerId` boolean NOT NULL DEFAULT false,
	`topupCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `spins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prizeLabel` varchar(120) NOT NULL,
	`prizeValueKs` int NOT NULL DEFAULT 0,
	`spunAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `totalSpentKs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastSpinAt` timestamp;