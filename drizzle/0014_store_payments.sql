CREATE TABLE `store_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`stripe_session_id` text NOT NULL,
	`stripe_payment_intent` text,
	`seen_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_payments_stripe_session_id_unique` ON `store_payments` (`stripe_session_id`);