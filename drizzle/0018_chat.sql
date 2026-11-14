CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_thread_idx` ON `chat_messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`user_id` integer,
	`name` text,
	`push_subscription_id` integer,
	`admin_unread` integer DEFAULT 0 NOT NULL,
	`customer_unread` integer DEFAULT 0 NOT NULL,
	`last_body` text,
	`last_from` text,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`push_subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_threads_token_unique` ON `chat_threads` (`token`);--> statement-breakpoint
CREATE INDEX `chat_threads_user_idx` ON `chat_threads` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_threads_last_idx` ON `chat_threads` (`last_message_at`);