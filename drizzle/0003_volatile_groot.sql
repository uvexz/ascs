CREATE INDEX `comments_user_idx` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `comments_email_idx` ON `comments` (`email_hash`);--> statement-breakpoint
CREATE INDEX `comments_ip_idx` ON `comments` (`ip_hash`);--> statement-breakpoint
CREATE INDEX `likes_voter_idx` ON `likes` (`voter`);