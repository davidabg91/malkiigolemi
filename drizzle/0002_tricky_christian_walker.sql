ALTER TABLE `orders` ADD `courier` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `office_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `office_name` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `waybill_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_courier` text;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_office_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_office_name` text;