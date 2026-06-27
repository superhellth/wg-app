CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."chore_frequency" AS ENUM('weekly', 'biweekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."meeting_mode" AS ENUM('fixed', 'recurring', 'poll');--> statement-breakpoint
CREATE TYPE "public"."rsvp" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('equal', 'exact', 'shares', 'percent');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"assignee_id" uuid NOT NULL,
	"rotation_index" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"overdue_notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"frequency" "chore_frequency" NOT NULL,
	"interval_days" integer,
	"rotation" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"current_member_id" uuid,
	"push_endpoint" text NOT NULL,
	"push_keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_push_endpoint_unique" UNIQUE("push_endpoint")
);
--> statement-breakpoint
CREATE TABLE "expense_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payer_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"split_type" "split_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"cycle" "billing_cycle" NOT NULL,
	"contract_holder_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"created_by_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "meeting_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"option_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"value" "rsvp" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"member_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"mode" "meeting_mode" NOT NULL,
	"starts_at" timestamp with time zone,
	"recur_every_days" integer,
	"last_reminder_at" timestamp with time zone,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"away_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_member_id" uuid NOT NULL,
	"to_member_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"added_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bought_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_turns" ADD CONSTRAINT "chore_turns_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_turns" ADD CONSTRAINT "chore_turns_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_current_member_id_members_id_fk" FOREIGN KEY ("current_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payer_id_members_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_contract_holder_id_members_id_fk" FOREIGN KEY ("contract_holder_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_options" ADD CONSTRAINT "meeting_options_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rsvps" ADD CONSTRAINT "meeting_rsvps_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rsvps" ADD CONSTRAINT "meeting_rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_votes" ADD CONSTRAINT "meeting_votes_option_id_meeting_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."meeting_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_votes" ADD CONSTRAINT "meeting_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_member_id_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_member_id_members_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_added_by_member_id_members_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;