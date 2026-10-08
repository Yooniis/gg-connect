CREATE TABLE `community_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`scans` integer DEFAULT 0 NOT NULL,
	`goal` integer DEFAULT 500 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`team` text DEFAULT 'Solo' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);