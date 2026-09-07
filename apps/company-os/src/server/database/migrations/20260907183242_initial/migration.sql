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
CREATE TABLE "objects" (
	"id" text PRIMARY KEY,
	"object_type" text NOT NULL,
	"parent_id" text,
	"ancestor_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"system_managed" boolean DEFAULT false NOT NULL,
	"etag" text DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text NOT NULL,
	CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'activity', 'company', 'contact', 'lead', 'deal', 'lineItem', 'note', 'campaign', 'content', 'enrollment', 'outreach', 'ticket', 'reply', 'issue', 'project', 'repository', 'pullRequest', 'asset')),
	CONSTRAINT "objects_parent_required" CHECK (("object_type" = 'root' and "parent_id" is null)
          or ("object_type" <> 'root' and "parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "record_aliases" (
	"alias" text PRIMARY KEY,
	"object_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roots" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "event_journal_state" (
	"id" integer PRIMARY KEY,
	"position" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_journal" (
	"position" bigint PRIMARY KEY,
	"id" text NOT NULL UNIQUE,
	"transaction_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"subjects" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_bindings" (
	"issuer" text,
	"subject" text,
	"identity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_bindings_pkey" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "interface_actor" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_authorization_scope" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_identity" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_note_subject" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_party" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_principal" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "contact_companies" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "contact_companies_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "contact_primary_company" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "contact_primary_company_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "deal_companies" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "deal_companies_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "issue_pull_requests" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "issue_pull_requests_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "note_subjects" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "note_subjects_pkey" PRIMARY KEY("forward_id","reverse_id")
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
CREATE TABLE "anonymous_actors" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL
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
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"channel" text DEFAULT 'content' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text,
	"budget" jsonb,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"logo" jsonb,
	"domain" text,
	"website" text,
	"industry" text,
	"lifecycle_stage" text DEFAULT 'prospect' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"photo" jsonb,
	"name" text NOT NULL,
	"job_title" text,
	"email" text,
	"marketing_status" text DEFAULT 'nonMarketing' NOT NULL,
	"email_permission" text DEFAULT 'unknown' NOT NULL,
	"phone" text
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
CREATE TABLE "deals" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"amount" jsonb,
	"expected_close_date" date,
	"owner_id" text,
	"next_step" text,
	"next_step_date" date
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
CREATE TABLE "groups" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"member_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"project_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_date" date,
	"assignee_id" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"attachments" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"company_id" text,
	"email" text,
	"phone" text,
	"source" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"converted_company_id" text,
	"converted_contact_id" text,
	"converted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" jsonb
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"content" text NOT NULL
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
CREATE TABLE "principal_sets" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text
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
CREATE TABLE "roles" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope_type" text NOT NULL,
	"permissions" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"principal_id" text NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_accounts" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL
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
	"respond_by_at" timestamp with time zone,
	"resolution" text,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"image" jsonb,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "seed_runs" (
	"name" text PRIMARY KEY,
	"parameters" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "asset_references_asset_id_idx" ON "asset_references" ("asset_id");--> statement-breakpoint
CREATE INDEX "objects_object_type_idx" ON "objects" ("object_type");--> statement-breakpoint
CREATE INDEX "objects_parent_id_idx" ON "objects" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_ancestor_ids_idx" ON "objects" USING gin ("ancestor_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "objects_id_parent_id_unique" ON "objects" ("id","parent_id");--> statement-breakpoint
CREATE INDEX "record_aliases_object_id_idx" ON "record_aliases" ("object_id");--> statement-breakpoint
CREATE INDEX "event_journal_type_position_idx" ON "event_journal" ("type","position");--> statement-breakpoint
CREATE INDEX "contact_companies_forward_id_idx" ON "contact_companies" ("forward_id");--> statement-breakpoint
CREATE INDEX "contact_companies_reverse_id_idx" ON "contact_companies" ("reverse_id");--> statement-breakpoint
CREATE INDEX "contact_primary_company_forward_id_idx" ON "contact_primary_company" ("forward_id");--> statement-breakpoint
CREATE INDEX "contact_primary_company_reverse_id_idx" ON "contact_primary_company" ("reverse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_primary_company_forward_id_unique" ON "contact_primary_company" ("forward_id");--> statement-breakpoint
CREATE INDEX "deal_companies_forward_id_idx" ON "deal_companies" ("forward_id");--> statement-breakpoint
CREATE INDEX "deal_companies_reverse_id_idx" ON "deal_companies" ("reverse_id");--> statement-breakpoint
CREATE INDEX "issue_pull_requests_forward_id_idx" ON "issue_pull_requests" ("forward_id");--> statement-breakpoint
CREATE INDEX "issue_pull_requests_reverse_id_idx" ON "issue_pull_requests" ("reverse_id");--> statement-breakpoint
CREATE INDEX "note_subjects_forward_id_idx" ON "note_subjects" ("forward_id");--> statement-breakpoint
CREATE INDEX "note_subjects_reverse_id_idx" ON "note_subjects" ("reverse_id");--> statement-breakpoint
CREATE INDEX "ticket_issues_forward_id_idx" ON "ticket_issues" ("forward_id");--> statement-breakpoint
CREATE INDEX "ticket_issues_reverse_id_idx" ON "ticket_issues" ("reverse_id");--> statement-breakpoint
CREATE INDEX "activities_parent_id_idx" ON "activities" ("parent_id");--> statement-breakpoint
CREATE INDEX "activities_company_id_idx" ON "activities" ("company_id");--> statement-breakpoint
CREATE INDEX "activities_contact_id_idx" ON "activities" ("contact_id");--> statement-breakpoint
CREATE INDEX "activities_deal_id_idx" ON "activities" ("deal_id");--> statement-breakpoint
CREATE INDEX "activities_owner_id_idx" ON "activities" ("owner_id");--> statement-breakpoint
CREATE INDEX "anonymous_actors_parent_id_idx" ON "anonymous_actors" ("parent_id");--> statement-breakpoint
CREATE INDEX "assets_parent_id_idx" ON "assets" ("parent_id");--> statement-breakpoint
CREATE INDEX "campaigns_parent_id_idx" ON "campaigns" ("parent_id");--> statement-breakpoint
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns" ("owner_id");--> statement-breakpoint
CREATE INDEX "companies_parent_id_idx" ON "companies" ("parent_id");--> statement-breakpoint
CREATE INDEX "contacts_parent_id_idx" ON "contacts" ("parent_id");--> statement-breakpoint
CREATE INDEX "contents_parent_id_idx" ON "contents" ("parent_id");--> statement-breakpoint
CREATE INDEX "contents_campaign_id_idx" ON "contents" ("campaign_id");--> statement-breakpoint
CREATE INDEX "contents_owner_id_idx" ON "contents" ("owner_id");--> statement-breakpoint
CREATE INDEX "deals_parent_id_idx" ON "deals" ("parent_id");--> statement-breakpoint
CREATE INDEX "deals_owner_id_idx" ON "deals" ("owner_id");--> statement-breakpoint
CREATE INDEX "enrollments_parent_id_idx" ON "enrollments" ("parent_id");--> statement-breakpoint
CREATE INDEX "enrollments_campaign_id_idx" ON "enrollments" ("campaign_id");--> statement-breakpoint
CREATE INDEX "enrollments_contact_id_idx" ON "enrollments" ("contact_id");--> statement-breakpoint
CREATE INDEX "groups_parent_id_idx" ON "groups" ("parent_id");--> statement-breakpoint
CREATE INDEX "group_memberships_parent_id_idx" ON "group_memberships" ("parent_id");--> statement-breakpoint
CREATE INDEX "group_memberships_member_id_idx" ON "group_memberships" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_membership_unique" ON "group_memberships" ("parent_id","member_id");--> statement-breakpoint
CREATE INDEX "issues_parent_id_idx" ON "issues" ("parent_id");--> statement-breakpoint
CREATE INDEX "issues_project_id_idx" ON "issues" ("project_id");--> statement-breakpoint
CREATE INDEX "issues_assignee_id_idx" ON "issues" ("assignee_id");--> statement-breakpoint
CREATE INDEX "leads_parent_id_idx" ON "leads" ("parent_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_idx" ON "leads" ("company_id");--> statement-breakpoint
CREATE INDEX "leads_converted_company_id_idx" ON "leads" ("converted_company_id");--> statement-breakpoint
CREATE INDEX "leads_converted_contact_id_idx" ON "leads" ("converted_contact_id");--> statement-breakpoint
CREATE INDEX "line_items_parent_id_idx" ON "line_items" ("parent_id");--> statement-breakpoint
CREATE INDEX "notes_parent_id_idx" ON "notes" ("parent_id");--> statement-breakpoint
CREATE INDEX "outreaches_parent_id_idx" ON "outreaches" ("parent_id");--> statement-breakpoint
CREATE INDEX "outreaches_campaign_id_idx" ON "outreaches" ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreaches_contact_id_idx" ON "outreaches" ("contact_id");--> statement-breakpoint
CREATE INDEX "outreaches_owner_id_idx" ON "outreaches" ("owner_id");--> statement-breakpoint
CREATE INDEX "principal_sets_parent_id_idx" ON "principal_sets" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_sets_kind_unique" ON "principal_sets" ("kind");--> statement-breakpoint
CREATE INDEX "projects_parent_id_idx" ON "projects" ("parent_id");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" ("owner_id");--> statement-breakpoint
CREATE INDEX "pull_requests_parent_id_idx" ON "pull_requests" ("parent_id");--> statement-breakpoint
CREATE INDEX "pull_requests_repository_id_idx" ON "pull_requests" ("repository_id");--> statement-breakpoint
CREATE INDEX "replies_parent_id_idx" ON "replies" ("parent_id");--> statement-breakpoint
CREATE INDEX "replies_ticket_id_idx" ON "replies" ("ticket_id");--> statement-breakpoint
CREATE INDEX "repositories_parent_id_idx" ON "repositories" ("parent_id");--> statement-breakpoint
CREATE INDEX "repositories_project_id_idx" ON "repositories" ("project_id");--> statement-breakpoint
CREATE INDEX "repositories_owner_id_idx" ON "repositories" ("owner_id");--> statement-breakpoint
CREATE INDEX "roles_parent_id_idx" ON "roles" ("parent_id");--> statement-breakpoint
CREATE INDEX "role_assignments_parent_id_idx" ON "role_assignments" ("parent_id");--> statement-breakpoint
CREATE INDEX "role_assignments_principal_id_idx" ON "role_assignments" ("principal_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_assignment_unique" ON "role_assignments" ("parent_id","principal_id","role_id");--> statement-breakpoint
CREATE INDEX "service_accounts_parent_id_idx" ON "service_accounts" ("parent_id");--> statement-breakpoint
CREATE INDEX "tickets_parent_id_idx" ON "tickets" ("parent_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_idx" ON "tickets" ("company_id");--> statement-breakpoint
CREATE INDEX "tickets_requester_id_idx" ON "tickets" ("requester_id");--> statement-breakpoint
CREATE INDEX "tickets_owner_id_idx" ON "tickets" ("owner_id");--> statement-breakpoint
CREATE INDEX "users_parent_id_idx" ON "users" ("parent_id");--> statement-breakpoint
CREATE INDEX "record_search_document_idx" ON "record_search" USING gin ("document");--> statement-breakpoint
ALTER TABLE "asset_references" ADD CONSTRAINT "asset_references_record_id_objects_id_fkey" FOREIGN KEY ("record_id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "asset_references" ADD CONSTRAINT "asset_references_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "asset_blobs" ADD CONSTRAINT "asset_blobs_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_id_objects_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_created_by_id_interface_actor_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_updated_by_id_interface_actor_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "record_aliases" ADD CONSTRAINT "record_aliases_object_id_objects_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roots" ADD CONSTRAINT "roots_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity_bindings" ADD CONSTRAINT "identity_bindings_identity_id_interface_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "interface_identity"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_actor" ADD CONSTRAINT "interface_actor_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_authorization_scope" ADD CONSTRAINT "interface_authorization_scope_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_identity" ADD CONSTRAINT "interface_identity_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_note_subject" ADD CONSTRAINT "interface_note_subject_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_party" ADD CONSTRAINT "interface_party_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_principal" ADD CONSTRAINT "interface_principal_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_forward_id_contacts_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_reverse_id_companies_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_primary_company" ADD CONSTRAINT "contact_primary_company_forward_id_contacts_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_primary_company" ADD CONSTRAINT "contact_primary_company_reverse_id_companies_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_primary_company" ADD CONSTRAINT "contact_primary_company_membership_fk" FOREIGN KEY ("forward_id","reverse_id") REFERENCES "contact_companies"("forward_id","reverse_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deal_companies" ADD CONSTRAINT "deal_companies_forward_id_deals_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "deals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deal_companies" ADD CONSTRAINT "deal_companies_reverse_id_companies_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_forward_id_issues_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_pull_requests" ADD CONSTRAINT "issue_pull_requests_reverse_id_pull_requests_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_subjects" ADD CONSTRAINT "note_subjects_forward_id_notes_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_subjects" ADD CONSTRAINT "note_subjects_reverse_id_interface_note_subject_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "interface_note_subject"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_forward_id_tickets_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_reverse_id_issues_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_member_id_interface_identity_id_fkey" FOREIGN KEY ("member_id") REFERENCES "interface_identity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_parent_group_fk" FOREIGN KEY ("parent_id") REFERENCES "groups"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_users_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_company_id_companies_id_fkey" FOREIGN KEY ("converted_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_contact_id_contacts_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_parent_deal_fk" FOREIGN KEY ("parent_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
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
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_principal_id_interface_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "interface_principal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_contacts_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_parent_root_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "record_search" ADD CONSTRAINT "record_search_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;

--> statement-breakpoint
INSERT INTO "event_journal_state" ("id", "position") VALUES (1, 0);

--> statement-breakpoint
CREATE FUNCTION reject_event_journal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The event journal is append-only' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER event_journal_immutable BEFORE UPDATE OR DELETE ON event_journal
FOR EACH ROW EXECUTE FUNCTION reject_event_journal_mutation();
