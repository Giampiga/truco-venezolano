CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`owner_id` text NOT NULL,
	`is_private` integer NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `rooms_lobby` ON `rooms` (`status`,`is_private`,`updated_at`);--> statement-breakpoint
CREATE INDEX `rooms_owner` ON `rooms` (`owner_id`,`status`);