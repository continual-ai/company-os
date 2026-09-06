-- Existing opaque UUID etags become ordered record revisions. Old edit tokens conflict safely.
UPDATE objects SET etag = '1' WHERE etag !~ '^[0-9]+$';
--> statement-breakpoint
CREATE TABLE "issue_pull_requests" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "issue_pull_requests_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_issues" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "ticket_issues_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"company_id" text,
	"contact_id" text,
	"deal_id" text,
	"owner_id" text,
	"kind" text DEFAULT 'task' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"due_at" timestamp with time zone,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"channel" text DEFAULT 'content' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"budget" jsonb,
	"starts_on" date,
	"ends_on" date
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"campaign_id" text,
	"format" text DEFAULT 'article' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"brief" text,
	"body" text,
	"scheduled_at" timestamp with time zone,
	"published_url" text,
	"attachments" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"next_touch_at" timestamp with time zone,
	"context" text
);
--> statement-breakpoint
CREATE TABLE "outreaches" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"subject" text NOT NULL,
	"campaign_id" text,
	"contact_id" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"body" text,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"external_id" text,
	"failure" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"owner_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"target_date" date
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"repository_id" text NOT NULL,
	"number" integer,
	"url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"review" text DEFAULT 'pending' NOT NULL,
	"checks" text DEFAULT 'pending' NOT NULL,
	"head_commit" text,
	"observed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"subject" text NOT NULL,
	"ticket_id" text NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"body" text NOT NULL,
	"external_id" text,
	"sent_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"project_id" text,
	"owner_id" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"company_id" text,
	"requester_id" text,
	"owner_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"respond_by" timestamp with time zone,
	"resolution" text,
	"external_id" text
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email_permission" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_step_due" date;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "objects" ALTER COLUMN "etag" SET DEFAULT '1';--> statement-breakpoint
CREATE INDEX "issue_pull_requests_forward_id_idx" ON "issue_pull_requests" ("forward_id");--> statement-breakpoint
CREATE INDEX "issue_pull_requests_reverse_id_idx" ON "issue_pull_requests" ("reverse_id");--> statement-breakpoint
CREATE INDEX "ticket_issues_forward_id_idx" ON "ticket_issues" ("forward_id");--> statement-breakpoint
CREATE INDEX "ticket_issues_reverse_id_idx" ON "ticket_issues" ("reverse_id");--> statement-breakpoint
CREATE INDEX "activities_parent_id_idx" ON "activities" ("parent_id");--> statement-breakpoint
CREATE INDEX "activities_company_id_idx" ON "activities" ("company_id");--> statement-breakpoint
CREATE INDEX "activities_contact_id_idx" ON "activities" ("contact_id");--> statement-breakpoint
CREATE INDEX "activities_deal_id_idx" ON "activities" ("deal_id");--> statement-breakpoint
CREATE INDEX "activities_owner_id_idx" ON "activities" ("owner_id");--> statement-breakpoint
CREATE INDEX "campaigns_parent_id_idx" ON "campaigns" ("parent_id");--> statement-breakpoint
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns" ("owner_id");--> statement-breakpoint
CREATE INDEX "contents_parent_id_idx" ON "contents" ("parent_id");--> statement-breakpoint
CREATE INDEX "contents_campaign_id_idx" ON "contents" ("campaign_id");--> statement-breakpoint
CREATE INDEX "contents_owner_id_idx" ON "contents" ("owner_id");--> statement-breakpoint
CREATE INDEX "deals_owner_id_idx" ON "deals" ("owner_id");--> statement-breakpoint
CREATE INDEX "enrollments_parent_id_idx" ON "enrollments" ("parent_id");--> statement-breakpoint
CREATE INDEX "enrollments_campaign_id_idx" ON "enrollments" ("campaign_id");--> statement-breakpoint
CREATE INDEX "enrollments_contact_id_idx" ON "enrollments" ("contact_id");--> statement-breakpoint
CREATE INDEX "issues_project_id_idx" ON "issues" ("project_id");--> statement-breakpoint
CREATE INDEX "outreaches_parent_id_idx" ON "outreaches" ("parent_id");--> statement-breakpoint
CREATE INDEX "outreaches_campaign_id_idx" ON "outreaches" ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreaches_contact_id_idx" ON "outreaches" ("contact_id");--> statement-breakpoint
CREATE INDEX "outreaches_owner_id_idx" ON "outreaches" ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_parent_id_idx" ON "projects" ("parent_id");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" ("owner_id");--> statement-breakpoint
CREATE INDEX "pull_requests_parent_id_idx" ON "pull_requests" ("parent_id");--> statement-breakpoint
CREATE INDEX "pull_requests_repository_id_idx" ON "pull_requests" ("repository_id");--> statement-breakpoint
CREATE INDEX "replies_parent_id_idx" ON "replies" ("parent_id");--> statement-breakpoint
CREATE INDEX "replies_ticket_id_idx" ON "replies" ("ticket_id");--> statement-breakpoint
CREATE INDEX "repositories_parent_id_idx" ON "repositories" ("parent_id");--> statement-breakpoint
CREATE INDEX "repositories_project_id_idx" ON "repositories" ("project_id");--> statement-breakpoint
CREATE INDEX "repositories_owner_id_idx" ON "repositories" ("owner_id");--> statement-breakpoint
CREATE INDEX "tickets_parent_id_idx" ON "tickets" ("parent_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_idx" ON "tickets" ("company_id");--> statement-breakpoint
CREATE INDEX "tickets_requester_id_idx" ON "tickets" ("requester_id");--> statement-breakpoint
CREATE INDEX "tickets_owner_id_idx" ON "tickets" ("owner_id");--> statement-breakpoint
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_forward_id_issues_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_reverse_id_pull_requests_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_forward_id_tickets_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_reverse_id_issues_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_ticket_id_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_contacts_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_object_type_check", ADD CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'activity', 'company', 'contact', 'lead', 'deal', 'lineItem', 'note', 'campaign', 'content', 'enrollment', 'outreach', 'ticket', 'reply', 'issue', 'project', 'repository', 'pullRequest', 'asset'));