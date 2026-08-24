CREATE TABLE "interface_authorization_scope" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"logo" jsonb,
	"name" text NOT NULL,
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
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"name" text GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"primary_company_id" text
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"amount" jsonb,
	"expected_close_date" date,
	"company_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"member_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "interface_identity" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"subject_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text,
	"phone" text,
	"source" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL
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
CREATE TABLE "objects" (
	"id" text PRIMARY KEY,
	"object_type" text NOT NULL,
	"parent_id" text,
	"ancestor_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"system_managed" boolean DEFAULT false NOT NULL,
	"etag" text DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text NOT NULL,
	CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('platform', 'user', 'serviceAccount', 'group', 'groupMembership', 'role', 'roleAssignment', 'company', 'contact', 'lead', 'deal', 'lineItem', 'interaction')),
	CONSTRAINT "objects_parent_required" CHECK (("object_type" = 'platform' and "parent_id" is null)
          or ("object_type" <> 'platform' and "parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "interface_party" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "roots" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "interface_principal" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "record_aliases" (
	"alias" text PRIMARY KEY,
	"object_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"principal_id" text NOT NULL,
	"role_id" text NOT NULL
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
CREATE TABLE "service_accounts" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"image" jsonb
);
--> statement-breakpoint
CREATE INDEX "companies_parent_id_idx" ON "companies" ("parent_id");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" (lower("domain")) WHERE "domain" is not null;--> statement-breakpoint
CREATE INDEX "contacts_parent_id_idx" ON "contacts" ("parent_id");--> statement-breakpoint
CREATE INDEX "contacts_primary_company_id_idx" ON "contacts" ("primary_company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" (lower("email")) WHERE "email" is not null;--> statement-breakpoint
CREATE INDEX "deals_parent_id_idx" ON "deals" ("parent_id");--> statement-breakpoint
CREATE INDEX "deals_company_id_idx" ON "deals" ("company_id");--> statement-breakpoint
CREATE INDEX "group_memberships_parent_id_idx" ON "group_memberships" ("parent_id");--> statement-breakpoint
CREATE INDEX "group_memberships_member_id_idx" ON "group_memberships" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_parent_id_member_id_unique" ON "group_memberships" ("parent_id","member_id");--> statement-breakpoint
CREATE INDEX "groups_parent_id_idx" ON "groups" ("parent_id");--> statement-breakpoint
CREATE INDEX "interactions_parent_id_idx" ON "interactions" ("parent_id");--> statement-breakpoint
CREATE INDEX "interactions_subject_id_idx" ON "interactions" ("subject_id");--> statement-breakpoint
CREATE INDEX "interactions_occurred_at_idx" ON "interactions" ("occurred_at");--> statement-breakpoint
CREATE INDEX "leads_parent_id_idx" ON "leads" ("parent_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" (lower("email")) WHERE "email" is not null;--> statement-breakpoint
CREATE INDEX "line_items_parent_id_idx" ON "line_items" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_object_type_idx" ON "objects" ("object_type");--> statement-breakpoint
CREATE INDEX "objects_parent_id_idx" ON "objects" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_ancestor_ids_idx" ON "objects" USING gin ("ancestor_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "objects_id_parent_id_unique" ON "objects" ("id","parent_id");--> statement-breakpoint
CREATE INDEX "record_aliases_object_id_idx" ON "record_aliases" ("object_id");--> statement-breakpoint
CREATE INDEX "role_assignments_parent_id_idx" ON "role_assignments" ("parent_id");--> statement-breakpoint
CREATE INDEX "role_assignments_principal_id_idx" ON "role_assignments" ("principal_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_parent_id_principal_id_role_id_unique" ON "role_assignments" ("parent_id","principal_id","role_id");--> statement-breakpoint
CREATE INDEX "roles_parent_id_idx" ON "roles" ("parent_id");--> statement-breakpoint
CREATE INDEX "service_accounts_parent_id_idx" ON "service_accounts" ("parent_id");--> statement-breakpoint
CREATE INDEX "users_parent_id_idx" ON "users" ("parent_id");--> statement-breakpoint
ALTER TABLE "interface_authorization_scope" ADD CONSTRAINT "interface_authorization_scope_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_primary_company_id_companies_id_fkey" FOREIGN KEY ("primary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_member_id_interface_identity_id_fkey" FOREIGN KEY ("member_id") REFERENCES "interface_identity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_parent_group_fk" FOREIGN KEY ("parent_id") REFERENCES "groups"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_identity" ADD CONSTRAINT "interface_identity_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_subject_id_interface_party_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "interface_party"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_parent_deal_fk" FOREIGN KEY ("parent_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_id_objects_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_created_by_id_interface_identity_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "interface_identity"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_updated_by_id_interface_identity_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "interface_identity"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "interface_party" ADD CONSTRAINT "interface_party_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roots" ADD CONSTRAINT "roots_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_principal" ADD CONSTRAINT "interface_principal_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "record_aliases" ADD CONSTRAINT "record_aliases_object_id_objects_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_principal_id_interface_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "interface_principal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;
