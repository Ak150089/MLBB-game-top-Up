-- ============================================================
-- Game Top-Up Shop — Full Database Initialization
-- Run this once on a fresh MySQL / DO Managed Database
-- Compatible with MySQL 8.0+ and PlanetScale
-- ============================================================

-- 0000: users table

-- Migration: 0000
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);


-- Migration: 0001
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
;
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
;
CREATE TABLE `paymentAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`method` varchar(60) NOT NULL,
	`accountNumber` varchar(80) NOT NULL,
	`accountName` varchar(120),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `paymentAccounts_id` PRIMARY KEY(`id`)
);
;
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
;
CREATE TABLE `spins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prizeLabel` varchar(120) NOT NULL,
	`prizeValueKs` int NOT NULL DEFAULT 0,
	`spunAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spins_id` PRIMARY KEY(`id`)
);
;
ALTER TABLE `users` ADD `totalSpentKs` int DEFAULT 0 NOT NULL;
ALTER TABLE `users` ADD `lastSpinAt` timestamp;

-- Migration: 0002
CREATE TABLE `heroBanners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`badge` varchar(80),
	`title` varchar(200) NOT NULL,
	`titleMy` varchar(200),
	`subtitle` varchar(300),
	`subtitleMy` varchar(300),
	`imageUrl` text,
	`colorFrom` varchar(16) NOT NULL DEFAULT '#7C3AED',
	`colorTo` varchar(16) NOT NULL DEFAULT '#DB2777',
	`ctaLink` varchar(200),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heroBanners_id` PRIMARY KEY(`id`)
);
;
CREATE TABLE `siteSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(80) NOT NULL DEFAULT 'GameTop-Up',
	`brandAccent` varchar(80) NOT NULL DEFAULT 'Top-Up',
	`logoUrl` text,
	`tagline` varchar(200) NOT NULL DEFAULT 'Top Up. Power Up. Win More.',
	`taglineMy` varchar(200) NOT NULL DEFAULT 'ဖြည့်လိုက်၊ အားဖြည့်လိုက်၊ ပိုနိုင်လိုက်။',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteSettings_id` PRIMARY KEY(`id`)
);
;
CREATE TABLE `spinPrizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(120) NOT NULL,
	`labelMy` varchar(120),
	`valueKs` int NOT NULL DEFAULT 0,
	`color` varchar(16) NOT NULL DEFAULT '#7C3AED',
	`weight` int NOT NULL DEFAULT 10,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `spinPrizes_id` PRIMARY KEY(`id`)
);


-- Migration: 0003
CREATE TABLE `balanceTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','topup','spin','refund','adjust') NOT NULL,
	`amountKs` int NOT NULL,
	`balanceAfterKs` int NOT NULL DEFAULT 0,
	`description` varchar(200),
	`refId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `balanceTransactions_id` PRIMARY KEY(`id`)
);
;
CREATE TABLE `deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountKs` int NOT NULL,
	`method` varchar(40) NOT NULL,
	`memo` varchar(60) NOT NULL,
	`expectedTon` varchar(40),
	`txReference` varchar(200),
	`receiptKey` text,
	`receiptUrl` text,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`autoVerify` boolean NOT NULL DEFAULT false,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposits_id` PRIMARY KEY(`id`),
	CONSTRAINT `deposits_memo_unique` UNIQUE(`memo`)
);
;
CREATE TABLE `userBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balanceKs` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userBalances_id` PRIMARY KEY(`id`),
	CONSTRAINT `userBalances_userId_unique` UNIQUE(`userId`)
);


-- Migration: 0004
ALTER TABLE `siteSettings` ADD `contactEmail` varchar(200) DEFAULT 'shineaker@gmail.com' NOT NULL;
ALTER TABLE `siteSettings` ADD `usdToKs` int DEFAULT 4500 NOT NULL;
