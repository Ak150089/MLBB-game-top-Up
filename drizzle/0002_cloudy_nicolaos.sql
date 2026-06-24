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
--> statement-breakpoint
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
--> statement-breakpoint
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
