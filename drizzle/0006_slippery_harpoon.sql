CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`invited_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_site_email_idx` ON `invitations` (`site_id`,`email`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitations` (`email`);--> statement-breakpoint
DROP INDEX `sites_origin_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `sites_verified_origin` ON `sites` (`origin`) WHERE "sites"."verified_at" is not null;