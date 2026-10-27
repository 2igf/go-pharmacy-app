CREATE TABLE `officialMedicinePrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`productId` int NOT NULL,
	`amount` decimal(12,3) NOT NULL,
	`sourceAuthority` varchar(200) NOT NULL,
	`sourceReference` varchar(500) NOT NULL,
	`effectiveFrom` datetime NOT NULL,
	`effectiveTo` datetime,
	`verifiedAt` datetime NOT NULL,
	CONSTRAINT `officialMedicinePrices_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_price_effective_unique` UNIQUE(`countryCode`,`productId`,`effectiveFrom`),
	CONSTRAINT `official_price_nonnegative` CHECK(`officialMedicinePrices`.`amount` >= 0),
	CONSTRAINT `official_price_dates` CHECK(`officialMedicinePrices`.`effectiveTo` IS NULL OR `officialMedicinePrices`.`effectiveTo` > `officialMedicinePrices`.`effectiveFrom`)
);
--> statement-breakpoint
CREATE TABLE `organizationAuditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`action` enum('organization_applied','organization_reviewed','membership_updated','stock_adjusted') NOT NULL,
	`reason` varchar(500) NOT NULL,
	`details` json NOT NULL,
	`requestId` varchar(36),
	`requestHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizationAuditEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_request_unique` UNIQUE(`organizationId`,`requestId`)
);
--> statement-breakpoint
CREATE TABLE `organizationMemberships` (
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','inventory_staff','viewer') NOT NULL,
	`status` enum('pending','active','suspended') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizationMemberships_organizationId_userId_pk` PRIMARY KEY(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('pharmacy','clinic','provider') NOT NULL,
	`name` varchar(200) NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`registrationNumber` varchar(100) NOT NULL,
	`status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_country_registration_unique` UNIQUE(`countryCode`,`registrationNumber`)
);
--> statement-breakpoint
CREATE TABLE `pharmacyInventory` (
	`organizationId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pharmacyInventory_organizationId_productId_pk` PRIMARY KEY(`organizationId`,`productId`),
	CONSTRAINT `inventory_quantity_check` CHECK(`pharmacyInventory`.`quantity` BETWEEN 0 AND 1000000),
	CONSTRAINT `inventory_version_check` CHECK(`pharmacyInventory`.`version` >= 0)
);
--> statement-breakpoint
CREATE TABLE `pharmacyOrderAssignments` (
	`orderId` int NOT NULL,
	`organizationId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pharmacyOrderAssignments_orderId` PRIMARY KEY(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `pricingJurisdictions` (
	`countryCode` varchar(2) NOT NULL,
	`currencyCode` varchar(3) NOT NULL,
	`minorUnitDigits` int NOT NULL,
	CONSTRAINT `pricingJurisdictions_countryCode` PRIMARY KEY(`countryCode`),
	CONSTRAINT `jurisdiction_digits_check` CHECK(`pricingJurisdictions`.`minorUnitDigits` BETWEEN 0 AND 3)
);
--> statement-breakpoint
ALTER TABLE `officialMedicinePrices` ADD CONSTRAINT `official_price_jurisdiction_fk` FOREIGN KEY (`countryCode`) REFERENCES `pricingJurisdictions`(`countryCode`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `officialMedicinePrices` ADD CONSTRAINT `officialMedicinePrices_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationAuditEvents` ADD CONSTRAINT `organizationAuditEvents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationAuditEvents` ADD CONSTRAINT `organizationAuditEvents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationMemberships` ADD CONSTRAINT `organizationMemberships_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizationMemberships` ADD CONSTRAINT `organizationMemberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_countryCode_pricingJurisdictions_countryCode_fk` FOREIGN KEY (`countryCode`) REFERENCES `pricingJurisdictions`(`countryCode`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pharmacyInventory` ADD CONSTRAINT `pharmacyInventory_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pharmacyInventory` ADD CONSTRAINT `pharmacyInventory_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pharmacyOrderAssignments` ADD CONSTRAINT `pharmacyOrderAssignments_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pharmacyOrderAssignments` ADD CONSTRAINT `pharmacyOrderAssignments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pharmacyOrderAssignments` ADD CONSTRAINT `pharmacyOrderAssignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `official_price_product_idx` ON `officialMedicinePrices` (`productId`);--> statement-breakpoint
CREATE INDEX `organization_audit_id_idx` ON `organizationAuditEvents` (`organizationId`,`id`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `organizationAuditEvents` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `membership_user_status_idx` ON `organizationMemberships` (`userId`,`status`,`organizationId`);--> statement-breakpoint
CREATE INDEX `organization_status_id_idx` ON `organizations` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `organization_creator_idx` ON `organizations` (`createdBy`);--> statement-breakpoint
CREATE INDEX `inventory_product_idx` ON `pharmacyInventory` (`productId`);--> statement-breakpoint
CREATE INDEX `assignment_organization_idx` ON `pharmacyOrderAssignments` (`organizationId`);--> statement-breakpoint
CREATE INDEX `assignment_actor_idx` ON `pharmacyOrderAssignments` (`assignedBy`);
--> statement-breakpoint
-- Jurisdiction metadata only; no official medicine price values.
INSERT INTO `pricingJurisdictions` (`countryCode`, `currencyCode`, `minorUnitDigits`) VALUES ('JO', 'JOD', 3);
