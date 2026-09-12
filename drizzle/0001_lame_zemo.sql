CREATE TABLE `ranked_results` (
	`room_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`format` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`format` text NOT NULL,
	`name` text NOT NULL,
	`rating` integer NOT NULL,
	`games` integer NOT NULL,
	`wins` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ratings_leaderboard` ON `ratings` (`format`,`rating`);