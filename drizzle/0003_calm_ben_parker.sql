CREATE TABLE `activity_feed` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quest_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`quest_id` integer NOT NULL,
	`quest_title` text NOT NULL,
	`xp_awarded` integer NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_completion_unique` ON `quest_completions` (`player_name`,`quest_id`);