CREATE TABLE `knowledgeSources` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` varchar(40) NOT NULL UNIQUE,
  `title` varchar(200) NOT NULL,
  `homepage` varchar(500) NOT NULL,
  `termsReference` varchar(500) NOT NULL,
  `scope` enum('international_vocabulary','authorized_draft') NOT NULL
);
--> statement-breakpoint
INSERT INTO `knowledgeSources` (`code`,`title`,`homepage`,`termsReference`,`scope`) VALUES
('rxnorm','RxNorm non-proprietary vocabulary / U.S. NLM','https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html','https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html','international_vocabulary'),
('authorized_structured','Authorized structured import (unreviewed)','https://opendata.gov.jo/','Explicit permission reference required; no automatic JFDA authorization','authorized_draft');
--> statement-breakpoint
CREATE TABLE `knowledgeImportBatches` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sourceId` int NOT NULL,
  `actorId` int NOT NULL,
  `requestId` varchar(36) NOT NULL,
  `requestHash` varchar(64) NOT NULL,
  `sourceVersion` varchar(128) NULL,
  `permissionReference` varchar(500) NULL,
  `status` enum('applied','rolled_back') NOT NULL DEFAULT 'applied',
  `applied` int NOT NULL DEFAULT 0,
  `skipped` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rolledBackAt` datetime(3) NULL,
  `rolledBackBy` int NULL,
  UNIQUE KEY `knowledge_batch_retry_unique` (`actorId`,`requestId`),
  CONSTRAINT `knowledge_batch_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `knowledgeSources` (`id`),
  CONSTRAINT `knowledge_batch_actor_fk` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`),
  CONSTRAINT `knowledge_batch_rollback_actor_fk` FOREIGN KEY (`rolledBackBy`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeDrugs` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sourceId` int NOT NULL,
  `externalId` varchar(100) NOT NULL,
  `name` varchar(500) NOT NULL,
  `termType` varchar(12) NOT NULL,
  `state` enum('published','draft','removed') NOT NULL,
  `currentVersion` int NOT NULL,
  `contentHash` varchar(64) NOT NULL,
  `sourceReference` varchar(500) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `knowledge_drug_source_external_unique` (`sourceId`,`externalId`),
  KEY `knowledge_drug_state_idx` (`state`),
  CONSTRAINT `knowledge_drug_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `knowledgeSources` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeNames` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `drugId` int NOT NULL,
  `name` varchar(500) NOT NULL,
  `language` enum('ar','en') NOT NULL,
  `kind` enum('generic','brand','synonym') NOT NULL,
  KEY `knowledge_name_drug_idx` (`drugId`),
  CONSTRAINT `knowledge_name_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeIngredients` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sourceId` int NOT NULL,
  `externalId` varchar(100) NOT NULL,
  `contentHash` varchar(64) NOT NULL,
  `name` varchar(500) NOT NULL,
  `language` enum('ar','en') NOT NULL,
  UNIQUE KEY `knowledge_ingredient_source_hash_unique` (`sourceId`,`externalId`,`contentHash`),
  CONSTRAINT `knowledge_ingredient_source_fk` FOREIGN KEY (`sourceId`) REFERENCES `knowledgeSources` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeDrugIngredients` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `drugId` int NOT NULL,
  `ingredientId` int NOT NULL,
  `strength` varchar(120) NULL,
  UNIQUE KEY `knowledge_drug_ingredient_unique` (`drugId`,`ingredientId`),
  CONSTRAINT `knowledge_link_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`),
  CONSTRAINT `knowledge_link_ingredient_fk` FOREIGN KEY (`ingredientId`) REFERENCES `knowledgeIngredients` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeRegistrations` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `drugId` int NOT NULL,
  `country` varchar(2) NOT NULL,
  `authority` varchar(200) NOT NULL,
  `sourceReference` varchar(500) NOT NULL,
  `registrationNumber` varchar(120) NULL,
  `packageDescription` varchar(500) NULL,
  `priceJod` decimal(12,3) NULL,
  `priceAsOf` datetime(3) NULL,
  `priceSourceReference` varchar(500) NULL,
  `reviewState` enum('draft','verified') NOT NULL DEFAULT 'draft',
  `verifiedAt` datetime(3) NULL,
  KEY `knowledge_registration_country_idx` (`country`,`reviewState`,`drugId`),
  CONSTRAINT `knowledge_registration_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeLabelSections` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `drugId` int NOT NULL,
  `section` enum('indications','dosage','warnings','side_effects','contraindications') NOT NULL,
  `language` enum('ar','en') NOT NULL,
  `content` text NOT NULL,
  `reviewState` enum('draft','medical_reviewed') NOT NULL DEFAULT 'draft',
  `reviewedBy` int NULL,
  `reviewedAt` datetime(3) NULL,
  KEY `knowledge_label_drug_idx` (`drugId`,`reviewState`),
  CONSTRAINT `knowledge_label_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`),
  CONSTRAINT `knowledge_label_reviewer_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeDrugVersions` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `drugId` int NOT NULL,
  `version` int NOT NULL,
  `batchId` int NOT NULL,
  `action` enum('import','rollback') NOT NULL,
  `snapshot` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `knowledge_drug_version_unique` (`drugId`,`version`),
  KEY `knowledge_version_batch_idx` (`batchId`),
  CONSTRAINT `knowledge_version_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`),
  CONSTRAINT `knowledge_version_batch_fk` FOREIGN KEY (`batchId`) REFERENCES `knowledgeImportBatches` (`id`)
);
