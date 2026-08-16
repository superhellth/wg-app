ALTER TABLE "meeting_options" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meeting_rsvps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meeting_votes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "meeting_options" CASCADE;--> statement-breakpoint
DROP TABLE "meeting_rsvps" CASCADE;--> statement-breakpoint
DROP TABLE "meeting_votes" CASCADE;--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "recur_every_days";--> statement-breakpoint
DROP TYPE "public"."meeting_mode";--> statement-breakpoint
DROP TYPE "public"."rsvp";