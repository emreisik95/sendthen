CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`permission` text DEFAULT 'full' NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_hash_idx` ON `api_keys` (`token_hash`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`dkim_selector` text DEFAULT 'stmail' NOT NULL,
	`dkim_private_key` text NOT NULL,
	`dkim_public_key` text NOT NULL,
	`dkim_verified` integer DEFAULT false NOT NULL,
	`spf_verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`verified_at` integer,
	`last_checked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`name`);--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` text PRIMARY KEY NOT NULL,
	`email_id` text NOT NULL,
	`type` text NOT NULL,
	`data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_events_email_idx` ON `email_events` (`email_id`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`api_key_id` text,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`cc` text,
	`bcc` text,
	`reply_to` text,
	`subject` text NOT NULL,
	`html` text,
	`text` text,
	`headers` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`message_id` text,
	`scheduled_at` integer,
	`sent_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`last_error` text,
	`idempotency_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `emails_status_idx` ON `emails` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `emails_created_idx` ON `emails` (`created_at`);--> statement-breakpoint
CREATE INDEX `emails_idem_idx` ON `emails` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`response_status` integer,
	`response_body` text,
	`created_at` integer NOT NULL,
	`delivered_at` integer,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `email_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wh_deliveries_status_idx` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
