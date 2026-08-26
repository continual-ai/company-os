CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "interface_actor" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "anonymous_actors" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."api_key_credential" (
	"api_key_id" text PRIMARY KEY,
	"secret_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_binding" (
	"auth_user_id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"name" text NOT NULL,
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
	"expected_close_date" date
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
CREATE TABLE "auth"."invitation_credential" (
	"invitation_id" text PRIMARY KEY,
	"secret_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"role_id" text NOT NULL,
	"accepted_by_id" text
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
	CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('platform', 'user', 'serviceAccount', 'anonymousActor', 'apiKey', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'invitation', 'company', 'contact', 'lead', 'deal', 'lineItem', 'interaction')),
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
CREATE TABLE "principal_sets" (
	"id" text PRIMARY KEY,
	"parent_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text
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
	"description" text,
	"status" text DEFAULT 'active' NOT NULL
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
CREATE INDEX "anonymous_actors_parent_id_idx" ON "anonymous_actors" ("parent_id");--> statement-breakpoint
CREATE INDEX "api_keys_parent_id_idx" ON "api_keys" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "auth"."account" ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" ("identifier");--> statement-breakpoint
CREATE INDEX "companies_parent_id_idx" ON "companies" ("parent_id");--> statement-breakpoint
CREATE INDEX "contacts_parent_id_idx" ON "contacts" ("parent_id");--> statement-breakpoint
CREATE INDEX "contacts_primary_company_id_idx" ON "contacts" ("primary_company_id");--> statement-breakpoint
CREATE INDEX "deals_parent_id_idx" ON "deals" ("parent_id");--> statement-breakpoint
CREATE INDEX "group_memberships_parent_id_idx" ON "group_memberships" ("parent_id");--> statement-breakpoint
CREATE INDEX "group_memberships_member_id_idx" ON "group_memberships" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_membership_unique" ON "group_memberships" ("parent_id","member_id");--> statement-breakpoint
CREATE INDEX "groups_parent_id_idx" ON "groups" ("parent_id");--> statement-breakpoint
CREATE INDEX "interactions_parent_id_idx" ON "interactions" ("parent_id");--> statement-breakpoint
CREATE INDEX "interactions_subject_id_idx" ON "interactions" ("subject_id");--> statement-breakpoint
CREATE INDEX "invitations_parent_id_idx" ON "invitations" ("parent_id");--> statement-breakpoint
CREATE INDEX "invitations_role_id_idx" ON "invitations" ("role_id");--> statement-breakpoint
CREATE INDEX "invitations_accepted_by_id_idx" ON "invitations" ("accepted_by_id");--> statement-breakpoint
CREATE INDEX "leads_parent_id_idx" ON "leads" ("parent_id");--> statement-breakpoint
CREATE INDEX "leads_converted_company_id_idx" ON "leads" ("converted_company_id");--> statement-breakpoint
CREATE INDEX "leads_converted_contact_id_idx" ON "leads" ("converted_contact_id");--> statement-breakpoint
CREATE INDEX "line_items_parent_id_idx" ON "line_items" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_object_type_idx" ON "objects" ("object_type");--> statement-breakpoint
CREATE INDEX "objects_parent_id_idx" ON "objects" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_ancestor_ids_idx" ON "objects" USING gin ("ancestor_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "objects_id_parent_id_unique" ON "objects" ("id","parent_id");--> statement-breakpoint
CREATE INDEX "principal_sets_parent_id_idx" ON "principal_sets" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_sets_kind_unique" ON "principal_sets" ("kind");--> statement-breakpoint
CREATE INDEX "record_aliases_object_id_idx" ON "record_aliases" ("object_id");--> statement-breakpoint
CREATE INDEX "role_assignments_parent_id_idx" ON "role_assignments" ("parent_id");--> statement-breakpoint
CREATE INDEX "role_assignments_principal_id_idx" ON "role_assignments" ("principal_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_assignment_unique" ON "role_assignments" ("parent_id","principal_id","role_id");--> statement-breakpoint
CREATE INDEX "roles_parent_id_idx" ON "roles" ("parent_id");--> statement-breakpoint
CREATE INDEX "service_accounts_parent_id_idx" ON "service_accounts" ("parent_id");--> statement-breakpoint
CREATE INDEX "users_parent_id_idx" ON "users" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");--> statement-breakpoint
ALTER TABLE "interface_actor" ADD CONSTRAINT "interface_actor_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."api_key_credential" ADD CONSTRAINT "api_key_credential_api_key_id_api_keys_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_parent_service_account_fk" FOREIGN KEY ("parent_id") REFERENCES "service_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_binding" ADD CONSTRAINT "user_binding_auth_user_id_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_binding" ADD CONSTRAINT "user_binding_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interface_authorization_scope" ADD CONSTRAINT "interface_authorization_scope_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_primary_company_id_companies_id_fkey" FOREIGN KEY ("primary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_parent_company_fk" FOREIGN KEY ("parent_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
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
ALTER TABLE "auth"."invitation_credential" ADD CONSTRAINT "invitation_credential_invitation_id_invitations_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_users_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_company_id_companies_id_fkey" FOREIGN KEY ("converted_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_contact_id_contacts_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_parent_deal_fk" FOREIGN KEY ("parent_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_id_objects_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_created_by_id_interface_actor_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_updated_by_id_interface_actor_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "interface_party" ADD CONSTRAINT "interface_party_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roots" ADD CONSTRAINT "roots_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
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
