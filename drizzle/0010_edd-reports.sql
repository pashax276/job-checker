CREATE TABLE `edd_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`stage` text NOT NULL,
	`reported_on` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edd_reports_job_id_stage_unique` ON `edd_reports` (`job_id`,`stage`);