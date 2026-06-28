CREATE TYPE "public"."display_function" AS ENUM('shopping', 'chores', 'saldo', 'appointment', 'activity');--> statement-breakpoint
CREATE TABLE "display_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_function" "display_function" DEFAULT 'saldo' NOT NULL,
	"idle_timeout_seconds" integer DEFAULT 30 NOT NULL,
	"button_blue" "display_function",
	"button_yellow" "display_function",
	"button_red" "display_function",
	"button_green" "display_function"
);
