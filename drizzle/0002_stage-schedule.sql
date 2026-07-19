CREATE TABLE `stage_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`stage` text NOT NULL,
	`scheduled_for` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_schedule_job_id_stage_unique` ON `stage_schedule` (`job_id`,`stage`);