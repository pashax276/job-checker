CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`priority_tier` text DEFAULT '3 - Mid' NOT NULL,
	`status` text DEFAULT 'Evaluating' NOT NULL,
	`date_applied` text,
	`comp_notes` text,
	`next_action` text,
	`follow_up_date` text,
	`contact` text,
	`notes` text,
	`posting_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`company` text,
	`source` text NOT NULL,
	`ats_type` text,
	`location_class` text NOT NULL,
	`matched_keywords` text,
	`status` text DEFAULT 'new' NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_url_unique` ON `leads` (`url`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`ats_type` text NOT NULL,
	`board_slug` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
