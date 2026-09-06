ALTER TABLE "campaigns" RENAME COLUMN "starts_on" TO "start_date";--> statement-breakpoint
ALTER TABLE "campaigns" RENAME COLUMN "ends_on" TO "end_date";--> statement-breakpoint
ALTER TABLE "deals" RENAME COLUMN "next_step_due" TO "next_step_date";--> statement-breakpoint
ALTER TABLE "tickets" RENAME COLUMN "respond_by" TO "respond_by_at";