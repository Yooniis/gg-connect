CREATE TABLE `quests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'SOLO' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`xp` integer DEFAULT 100 NOT NULL,
	`hint_cost` integer DEFAULT 100 NOT NULL,
	`hint_text` text DEFAULT '' NOT NULL,
	`hint_image_key` text,
	`starts_at` text,
	`ends_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
