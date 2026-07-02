CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `invites_team_idx` ON `invites` (`team_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_unique_idx` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `audiences` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `broadcasts` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `domains` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `emails` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
CREATE INDEX `emails_team_idx` ON `emails` (`team_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `suppressions` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
CREATE INDEX `suppressions_team_idx` ON `suppressions` (`team_id`,`email`);--> statement-breakpoint
ALTER TABLE `templates` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_team_id_unique` ON `user_settings` (`team_id`);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `team_id` text REFERENCES teams(id);