CREATE TABLE `sectionData` (
	`id` varchar(64) NOT NULL,
	`bookId` varchar(64) NOT NULL,
	`sectionId` varchar(64) NOT NULL,
	`originalContent` longtext NOT NULL,
	`startLine` varchar(20) NOT NULL,
	`endLine` varchar(20) NOT NULL,
	`sectionType` enum('paragraph','heading','code','list') NOT NULL,
	`draftTranslation` longtext,
	`draftSource` longtext,
	`translationStatus` enum('not_translated','draft','committed') NOT NULL DEFAULT 'not_translated',
	`committedTranslation` longtext,
	`lastModified` timestamp DEFAULT (now()),
	`draftLastModified` timestamp,
	`committedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `sectionData_id` PRIMARY KEY(`id`)
);
