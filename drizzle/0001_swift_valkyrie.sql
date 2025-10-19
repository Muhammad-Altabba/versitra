CREATE TABLE `books` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`repoName` varchar(255) NOT NULL,
	`repoUrl` text NOT NULL,
	`gitProvider` enum('github','gitlab') NOT NULL,
	`title` text,
	`sourceLanguage` varchar(10),
	`targetLanguage` varchar(10),
	`createdAt` timestamp DEFAULT (now()),
	`lastModified` timestamp DEFAULT (now()),
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gitCredentials` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`gitProvider` enum('github','gitlab') NOT NULL,
	`gitUsername` varchar(255) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `gitCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `gitCredentials_userId_unique` UNIQUE(`userId`)
);
