CREATE TABLE `aiUsageTracking` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`month` varchar(7) NOT NULL,
	`requestCount` varchar(20) NOT NULL DEFAULT '0',
	`tokenCount` varchar(20) NOT NULL DEFAULT '0',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `aiUsageTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectionComments` (
	`id` varchar(64) NOT NULL,
	`bookId` varchar(64) NOT NULL,
	`sectionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`content` longtext NOT NULL,
	`resolved` enum('open','resolved') NOT NULL DEFAULT 'open',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `sectionComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPreferences` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`autoSaveDrafts` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`aiApiProvider` varchar(50) DEFAULT 'builtin',
	`aiApiKey` text,
	`aiApiEndpoint` text,
	`aiUsageLimit` varchar(50) DEFAULT 'unlimited',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `userPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPreferences_userId_unique` UNIQUE(`userId`)
);
