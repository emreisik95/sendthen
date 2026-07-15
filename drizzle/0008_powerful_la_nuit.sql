CREATE INDEX `api_keys_team_revoked_idx` ON `api_keys` (`team_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `audiences_team_idx` ON `audiences` (`team_id`);--> statement-breakpoint
CREATE INDEX `broadcasts_team_idx` ON `broadcasts` (`team_id`);--> statement-breakpoint
CREATE INDEX `domains_team_created_idx` ON `domains` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `webhooks_team_idx` ON `webhooks` (`team_id`);