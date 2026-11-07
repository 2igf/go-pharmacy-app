ALTER TABLE `knowledgeProductFacts` ADD COLUMN `catalogMetadata` json NULL;
--> statement-breakpoint
INSERT INTO `knowledgeSources` (`code`, `title`, `homepage`, `termsReference`, `scope`)
VALUES ('jordan_package_2021', 'User supplied Jordan historical catalog — unreviewed', 'https://opendata.gov.jo/en/dataset/drug-prices-838-2021', 'https://opendata.gov.jo/en/pages/jordanian-open-government-data-license', 'authorized_draft');
