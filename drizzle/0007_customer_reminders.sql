CREATE TABLE `customerReminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `requestId` varchar(36) NOT NULL,
  `requestHash` varchar(64) NOT NULL,
  `medicationName` varchar(120) NOT NULL,
  `dosage` varchar(120) NULL,
  `notes` varchar(500) NULL,
  `times` json NOT NULL,
  `weekdays` json NOT NULL,
  `startDate` varchar(10) NOT NULL,
  `endDate` varchar(10) NULL,
  `timezone` varchar(80) NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `discreet` boolean NOT NULL DEFAULT true,
  `version` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_reminder_request_unique` (`userId`,`requestId`),
  KEY `customer_reminder_owner_enabled_idx` (`userId`,`enabled`),
  CONSTRAINT `customer_reminder_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TABLE `customerReminderEvents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reminderId` int NOT NULL,
  `scheduledAt` datetime(3) NOT NULL,
  `timezone` varchar(80) NOT NULL,
  `status` enum('taken','skipped') NOT NULL,
  `source` enum('user_reported') NOT NULL DEFAULT 'user_reported',
  `recordedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_reminder_occurrence_unique` (`reminderId`,`scheduledAt`),
  KEY `customer_reminder_history_idx` (`reminderId`,`recordedAt`),
  CONSTRAINT `customer_reminder_event_fk` FOREIGN KEY (`reminderId`) REFERENCES `customerReminders` (`id`) ON DELETE CASCADE
);
