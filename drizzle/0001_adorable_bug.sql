CREATE TABLE `audiences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audiences_user_idx` ON `audiences` (`user_id`);--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`from` text NOT NULL,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audience_id`) REFERENCES `audiences`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `broadcasts_user_idx` ON `broadcasts` (`user_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`audience_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`unsubscribed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`audience_id`) REFERENCES `audiences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_audience_email_idx` ON `contacts` (`audience_id`,`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppressions_user_email_idx` ON `suppressions` (`user_id`,`email`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `templates_user_idx` ON `templates` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mail_mode` text DEFAULT 'inherit' NOT NULL,
	`smtp_url` text,
	`ses_access_key_id` text,
	`ses_secret_access_key` text,
	`ses_region` text,
	`track_opens` integer DEFAULT false NOT NULL,
	`track_clicks` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `domains` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `emails` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `emails` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `broadcast_id` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `contact_id` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `attachments` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `track_opens` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `track_clicks` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `emails_user_idx` ON `emails` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `emails_broadcast_idx` ON `emails` (`broadcast_id`);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `email_events_type_idx` ON `email_events` (`type`,`created_at`);