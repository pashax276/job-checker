CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`bullets` text,
	`skills` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `comp_base` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `comp_bonus` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `comp_equity` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `resume_id` text REFERENCES documents(id);--> statement-breakpoint
ALTER TABLE `jobs` ADD `cover_letter_id` text REFERENCES documents(id);