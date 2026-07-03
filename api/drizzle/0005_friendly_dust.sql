ALTER TABLE "chore_turns" RENAME COLUMN "overdue_notified_at" TO "grace_notified_at";--> statement-breakpoint
ALTER TABLE "chore_turns" ADD COLUMN "executor_id" uuid;--> statement-breakpoint
ALTER TABLE "wg" ADD COLUMN "rotation" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wg" ADD COLUMN "grace_days" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "chore_turns" ADD CONSTRAINT "chore_turns_executor_id_members_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" DROP COLUMN "frequency";--> statement-breakpoint
ALTER TABLE "chores" DROP COLUMN "interval_days";--> statement-breakpoint
ALTER TABLE "chores" DROP COLUMN "rotation";--> statement-breakpoint
DROP TYPE "public"."chore_frequency";