CREATE TABLE `customerAccounts` (
  `userId` int NOT NULL,
  `accessSource` enum('public','legacy') NOT NULL,
  `verificationState` enum('unverified') NOT NULL DEFAULT 'unverified',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`),
  CONSTRAINT `customer_accounts_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TABLE `customerPasswordResets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_reset_token_unique` (`tokenHash`),
  KEY `customer_reset_user_idx` (`userId`),
  KEY `customer_reset_expiry_idx` (`expiresAt`),
  CONSTRAINT `customer_reset_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);
