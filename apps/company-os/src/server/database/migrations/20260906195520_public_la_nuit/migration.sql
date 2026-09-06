CREATE TABLE "record_search" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"subtitle" text,
	"image" jsonb,
	"status" text,
	"document" tsvector NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index_state" (
	"id" integer PRIMARY KEY,
	"definition" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "activities_search_idx";--> statement-breakpoint
DROP INDEX "assets_search_idx";--> statement-breakpoint
DROP INDEX "campaigns_search_idx";--> statement-breakpoint
DROP INDEX "companies_search_idx";--> statement-breakpoint
DROP INDEX "contacts_search_idx";--> statement-breakpoint
DROP INDEX "contents_search_idx";--> statement-breakpoint
DROP INDEX "deals_search_idx";--> statement-breakpoint
DROP INDEX "enrollments_search_idx";--> statement-breakpoint
DROP INDEX "issues_search_idx";--> statement-breakpoint
DROP INDEX "leads_search_idx";--> statement-breakpoint
DROP INDEX "line_items_search_idx";--> statement-breakpoint
DROP INDEX "notes_search_idx";--> statement-breakpoint
DROP INDEX "outreaches_search_idx";--> statement-breakpoint
DROP INDEX "projects_search_idx";--> statement-breakpoint
DROP INDEX "pull_requests_search_idx";--> statement-breakpoint
DROP INDEX "replies_search_idx";--> statement-breakpoint
DROP INDEX "repositories_search_idx";--> statement-breakpoint
DROP INDEX "tickets_search_idx";--> statement-breakpoint
CREATE INDEX "record_search_document_idx" ON "record_search" USING gin ("document");--> statement-breakpoint
ALTER TABLE "record_search" ADD CONSTRAINT "record_search_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;