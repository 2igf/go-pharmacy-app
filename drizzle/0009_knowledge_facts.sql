CREATE TABLE `knowledgeProductFacts` (
  `drugId` int NOT NULL PRIMARY KEY,
  `dosageForm` varchar(500) NULL,
  `route` varchar(500) NULL,
  `manufacturer` varchar(500) NULL,
  `packageIdentifier` varchar(500) NULL,
  `prescriptionStatus` enum('prescription','otc') NULL,
  `imageReference` varchar(500) NULL,
  `mediaRights` varchar(500) NULL,
  `publicationDate` date NULL,
  `sourceUpdatedAt` datetime(3) NULL,
  CONSTRAINT `knowledge_facts_drug_fk` FOREIGN KEY (`drugId`) REFERENCES `knowledgeDrugs` (`id`)
);
--> statement-breakpoint
ALTER TABLE `knowledgeLabelSections` MODIFY COLUMN `section` enum('indications','dosage','warnings','side_effects','contraindications','description','interactions') NOT NULL;
