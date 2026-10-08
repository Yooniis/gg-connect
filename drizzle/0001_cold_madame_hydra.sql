ALTER TABLE `quests` ADD `source_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quests_source_key_unique` ON `quests` (`source_key`);