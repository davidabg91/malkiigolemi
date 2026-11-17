CREATE TABLE `fb_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`visited` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`ordered` integer DEFAULT 0 NOT NULL,
	`replied` integer DEFAULT 0 NOT NULL,
	`stopped` integer DEFAULT false NOT NULL,
	`problem` text,
	`version` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fb_runs_finished_idx` ON `fb_runs` (`finished_at`);--> statement-breakpoint
ALTER TABLE `fb_claims` ADD `skip_reason` text;--> statement-breakpoint
ALTER TABLE `fb_claims` ADD `ordered_by` text;