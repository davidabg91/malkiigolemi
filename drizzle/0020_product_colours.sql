ALTER TABLE `order_items` ADD `color` text;--> statement-breakpoint
ALTER TABLE `products` ADD `color_options` text DEFAULT '[]' NOT NULL;