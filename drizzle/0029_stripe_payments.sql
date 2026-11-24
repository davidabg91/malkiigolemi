CREATE TABLE `stripe_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_intent` text,
	`created` integer NOT NULL,
	`amount` integer NOT NULL,
	`amount_refunded` integer DEFAULT 0 NOT NULL,
	`fee` integer,
	`net` integer,
	`currency` text DEFAULT 'eur' NOT NULL,
	`status` text NOT NULL,
	`disputed` integer DEFAULT false NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`name` text,
	`email` text,
	`last4` text,
	`data` text DEFAULT '{}' NOT NULL,
	`synced_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stripe_payments_created_idx` ON `stripe_payments` (`created`);--> statement-breakpoint
CREATE INDEX `stripe_payments_intent_idx` ON `stripe_payments` (`payment_intent`);--> statement-breakpoint
CREATE INDEX `orders_intent_idx` ON `orders` (`stripe_payment_intent`);--> statement-breakpoint
CREATE INDEX `store_payments_intent_idx` ON `store_payments` (`stripe_payment_intent`);