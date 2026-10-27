CREATE TABLE `fulfillmentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`organizationId` int,
	`actorUserId` int NOT NULL,
	`action` enum('enrolled','assigned','accepted','rejected','preparing','ready','cancelled','shipped','delivered') NOT NULL,
	`reason` varchar(500) NOT NULL,
	`requestId` varchar(36),
	`requestHash` varchar(64),
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fulfillmentEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `fulfillmentEvents_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `fulfillmentOrders` (
	`orderId` int NOT NULL,
	`state` enum('assignment_pending','assigned','accepted','rejected','preparing','ready','cancelled') NOT NULL DEFAULT 'assignment_pending',
	`version` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fulfillmentOrders_orderId` PRIMARY KEY(`orderId`),
	CONSTRAINT `fulfillment_version_check` CHECK(`fulfillmentOrders`.`version` >= 0)
);
--> statement-breakpoint
CREATE TABLE `fulfillmentStockLines` (
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`state` enum('held','consumed','released') NOT NULL DEFAULT 'held',
	CONSTRAINT `fulfillmentStockLines_orderId_productId_pk` PRIMARY KEY(`orderId`,`productId`),
	CONSTRAINT `fulfillment_line_quantity_check` CHECK(`fulfillmentStockLines`.`quantity` BETWEEN 1 AND 1000000)
);
--> statement-breakpoint
ALTER TABLE `fulfillmentEvents` ADD CONSTRAINT `fulfillmentEvents_orderId_fulfillmentOrders_orderId_fk` FOREIGN KEY (`orderId`) REFERENCES `fulfillmentOrders`(`orderId`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fulfillmentEvents` ADD CONSTRAINT `fulfillmentEvents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fulfillmentEvents` ADD CONSTRAINT `fulfillmentEvents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fulfillmentOrders` ADD CONSTRAINT `fulfillmentOrders_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fulfillmentStockLines` ADD CONSTRAINT `fulfillment_line_assignment_fk` FOREIGN KEY (`orderId`) REFERENCES `pharmacyOrderAssignments`(`orderId`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fulfillmentStockLines` ADD CONSTRAINT `fulfillmentStockLines_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fulfillment_event_order_idx` ON `fulfillmentEvents` (`orderId`,`id`);--> statement-breakpoint
CREATE INDEX `fulfillment_event_org_idx` ON `fulfillmentEvents` (`organizationId`,`id`);--> statement-breakpoint
CREATE INDEX `fulfillment_event_actor_idx` ON `fulfillmentEvents` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `fulfillment_state_order_idx` ON `fulfillmentOrders` (`state`,`orderId`);