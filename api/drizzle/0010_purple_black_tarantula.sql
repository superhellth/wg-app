ALTER TABLE "fixed_costs" ADD COLUMN "next_due_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_costs" ADD COLUMN "active" boolean DEFAULT true NOT NULL;