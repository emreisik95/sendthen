ALTER TABLE `domains` ADD `mx_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `domains` ADD `mx_checked_at` integer;