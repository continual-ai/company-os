CREATE TABLE "asset_references" (
	"record_id" text,
	"field" text,
	"asset_id" text NOT NULL,
	CONSTRAINT "asset_references_pkey" PRIMARY KEY("record_id","field")
);
--> statement-breakpoint
CREATE TABLE "asset_blobs" (
	"asset_id" text PRIMARY KEY,
	"bytes" bytea NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_id" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"attachments" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assets_parent_id_idx" ON "assets" ("parent_id");--> statement-breakpoint
CREATE INDEX "issues_parent_id_idx" ON "issues" ("parent_id");--> statement-breakpoint
CREATE INDEX "issues_assignee_id_idx" ON "issues" ("assignee_id");--> statement-breakpoint
ALTER TABLE "asset_references" ADD CONSTRAINT "asset_references_record_id_objects_id_fkey" FOREIGN KEY ("record_id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_references" ADD CONSTRAINT "asset_references_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_blobs" ADD CONSTRAINT "asset_blobs_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_users_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_object_type_check", ADD CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'company', 'contact', 'lead', 'deal', 'lineItem', 'note', 'asset', 'issue'));