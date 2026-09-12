CREATE TABLE `matchmaking_queue` (
	`user_id` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`rating` integer NOT NULL,
	`joined_at` integer NOT NULL,
	`seen_at` integer NOT NULL,
	`room_id` text
);
--> statement-breakpoint
CREATE INDEX `matchmaking_waiting` ON `matchmaking_queue` (`format`,`room_id`,`seen_at`);--> statement-breakpoint
ALTER TABLE `ranked_results` ADD `rated` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `ranked_results_recent` ON `ranked_results` (`created_at`);