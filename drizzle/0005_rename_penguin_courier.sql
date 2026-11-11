-- The courier is Pigeon Express; it was stored as "penguin". Saved Box Now / Pigeon offices came from
-- placeholder lists with made-up codes, so they are cleared and the customer picks a real one next time.
UPDATE `users` SET `preferred_office_code` = NULL, `preferred_office_name` = NULL WHERE `preferred_courier` IN ('boxnow', 'penguin');--> statement-breakpoint
UPDATE `users` SET `preferred_courier` = 'pigeon' WHERE `preferred_courier` = 'penguin';--> statement-breakpoint
UPDATE `orders` SET `courier` = 'pigeon' WHERE `courier` = 'penguin';--> statement-breakpoint
UPDATE `settings` SET `value` = replace(`value`, '"penguin"', '"pigeon"') WHERE `key` = 'active_couriers';
