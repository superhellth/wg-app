ALTER TABLE "meeting_options" DROP CONSTRAINT "meeting_options_meeting_id_meetings_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_rsvps" DROP CONSTRAINT "meeting_rsvps_meeting_id_meetings_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_votes" DROP CONSTRAINT "meeting_votes_option_id_meeting_options_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_options" ADD CONSTRAINT "meeting_options_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rsvps" ADD CONSTRAINT "meeting_rsvps_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_votes" ADD CONSTRAINT "meeting_votes_option_id_meeting_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."meeting_options"("id") ON DELETE cascade ON UPDATE no action;