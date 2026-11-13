ALTER TABLE `orders` ADD `shipment_status` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_events` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracked_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_cost` integer;