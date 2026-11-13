ALTER TABLE `orders` ADD `stripe_session_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_intent` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `refunded_at` integer;