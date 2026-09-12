CREATE TABLE `global_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`handle` text,
	`message` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `global_messages_recent` ON `global_messages` (`at`);--> statement-breakpoint
CREATE INDEX `global_messages_sender` ON `global_messages` (`user_id`,`at`);