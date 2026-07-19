CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`week_start` text NOT NULL,
	`taken_at` text NOT NULL,
	`active_total` integer NOT NULL,
	`total_jobs` integer NOT NULL,
	`status_counts` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_week_start_unique` ON `snapshots` (`week_start`);