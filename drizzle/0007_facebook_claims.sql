CREATE TABLE `fb_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`name` text NOT NULL,
	`qty` integer NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `fb_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fb_claims_post_idx` ON `fb_claims` (`post_id`);--> statement-breakpoint
CREATE TABLE `fb_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `source` text DEFAULT 'site' NOT NULL;