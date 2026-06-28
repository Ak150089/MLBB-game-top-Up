CREATE TABLE `supportMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','admin') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `siteSettings` ADD `adminLastSeenAt` timestamp;