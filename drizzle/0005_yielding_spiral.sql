CREATE INDEX `mail_available_idx` ON `mail_queue` (`available_at`);--> statement-breakpoint
CREATE INDEX `sites_created_idx` ON `sites` (`created_at`);--> statement-breakpoint
CREATE INDEX `user_created_idx` ON `user` (`created_at`);