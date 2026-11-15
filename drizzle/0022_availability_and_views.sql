ALTER TABLE `products` ADD `availability` text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `products` SET `availability` = 'delivery' WHERE `delivery_time` IS NOT NULL AND trim(`delivery_time`) <> '';--> statement-breakpoint
UPDATE `products` SET `views` = (SELECT count(*) FROM `events` WHERE `events`.`type` = 'view' AND `events`.`path` = '/produkt/' || `products`.`slug`);
