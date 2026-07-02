CREATE TABLE `inbound_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text,
	`domain_id` text,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`cc` text,
	`subject` text DEFAULT '' NOT NULL,
	`html` text,
	`text` text,
	`headers` text,
	`message_id` text,
	`attachments` text,
	`read` integer DEFAULT false NOT NULL,
	`forwarded_to` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inbound_team_idx` ON `inbound_emails` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `inbound_message_idx` ON `inbound_emails` (`message_id`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `scopes` text;