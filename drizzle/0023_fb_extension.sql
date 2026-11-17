ALTER TABLE `fb_claims` ADD `fb_comment_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `fb_claims_comment_idx` ON `fb_claims` (`post_id`,`fb_comment_id`);--> statement-breakpoint
ALTER TABLE `fb_posts` ADD `fb_id` text;--> statement-breakpoint
ALTER TABLE `fb_posts` ADD `text` text;--> statement-breakpoint
ALTER TABLE `fb_posts` ADD `synced_at` integer;--> statement-breakpoint
ALTER TABLE `fb_posts` ADD `closed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `fb_posts_fb_id_unique` ON `fb_posts` (`fb_id`);