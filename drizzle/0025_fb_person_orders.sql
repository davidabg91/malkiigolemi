CREATE TABLE `fb_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`fb_user_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fb_messages_order_idx` ON `fb_messages` (`order_id`);--> statement-breakpoint
CREATE INDEX `fb_messages_status_idx` ON `fb_messages` (`status`);--> statement-breakpoint
ALTER TABLE `fb_claims` ADD `fb_user_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fb_name` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fb_user_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `ready_at` integer;--> statement-breakpoint
CREATE INDEX `orders_fb_name_idx` ON `orders` (`fb_name`);