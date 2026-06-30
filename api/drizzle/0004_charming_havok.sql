ALTER TABLE "display_config" ADD COLUMN "schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "display_config" ADD COLUMN "on_time" text DEFAULT '07:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "display_config" ADD COLUMN "off_time" text DEFAULT '23:00' NOT NULL;