ALTER TABLE `order_items` ADD `delivery_time` text;--> statement-breakpoint
ALTER TABLE `products` ADD `color_stock` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `delivery_time` text;--> statement-breakpoint
UPDATE `products` SET `color_stock` = (
  SELECT json_group_array(`products`.`stock` / json_array_length(`products`.`color_options`) + (CASE WHEN j.key < `products`.`stock` % json_array_length(`products`.`color_options`) THEN 1 ELSE 0 END))
  FROM json_each(`products`.`color_options`) AS j
) WHERE json_array_length(`color_options`) > 0;
