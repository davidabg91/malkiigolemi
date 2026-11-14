CREATE TABLE `category_redirects` (
	`slug` text PRIMARY KEY NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `tile` text;--> statement-breakpoint
UPDATE `categories` SET `tile` = `slug` WHERE `parent_id` IS NULL AND `slug` IN ('hrani', 'kafe-i-chai', 'igrachki', 'napitki', 'pochistvane-i-prane', 'kozmetika', 'bebe-i-dete', 'dom-i-ofis');
