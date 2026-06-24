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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `userBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balanceKs` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userBalances_id` PRIMARY KEY(`id`),
	CONSTRAINT `userBalances_userId_unique` UNIQUE(`userId`)
);
