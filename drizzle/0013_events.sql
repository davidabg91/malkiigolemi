CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`hour` integer NOT NULL,
	`visitor` text NOT NULL,
	`type` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`label` text,
	`product_id` integer,
	`value` integer,
	`source` text,
	`device` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`day`);--> statement-breakpoint
CREATE INDEX `events_type_day_idx` ON `events` (`type`,`day`);