ALTER TABLE `fb_posts` ADD `posted_at` integer;--> statement-breakpoint
ALTER TABLE `fb_runs` ADD `skipped_old` integer DEFAULT 0 NOT NULL;