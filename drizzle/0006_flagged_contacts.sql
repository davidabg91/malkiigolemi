CREATE TABLE `flagged_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`email` text,
	`phone` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `flagged_contacts_email_idx` ON `flagged_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `flagged_contacts_phone_idx` ON `flagged_contacts` (`phone`);