CREATE TABLE `player_profiles` (
	`token` text PRIMARY KEY NOT NULL,
	`player_name` text NOT NULL,
	`team` text DEFAULT 'Solo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_player_name_unique` ON `player_profiles` (`player_name`);