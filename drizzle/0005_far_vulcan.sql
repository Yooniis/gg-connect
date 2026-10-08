CREATE TABLE `hint_purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`quest_id` integer NOT NULL,
	`cost` integer NOT NULL,
	`purchased_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hint_purchase_unique` ON `hint_purchases` (`player_name`,`quest_id`);--> statement-breakpoint
CREATE TABLE `nfc_scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`station_key` text NOT NULL,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nfc_scan_unique` ON `nfc_scans` (`player_name`,`station_key`);--> statement-breakpoint
CREATE TABLE `quest_acceptances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`quest_id` integer NOT NULL,
	`accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_acceptance_unique` ON `quest_acceptances` (`player_name`,`quest_id`);