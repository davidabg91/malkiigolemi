CREATE TABLE `withdrawals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer,
	`order_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`details` text,
	`user_id` integer,
	`confirmed_at` integer,
	`handled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `withdrawals_order_idx` ON `withdrawals` (`order_id`);