ALTER TABLE "anonymous_actors" RENAME CONSTRAINT "anonymous_actors_parent_platform_fk" TO "anonymous_actors_parent_root_fk";--> statement-breakpoint
ALTER TABLE "companies" RENAME CONSTRAINT "companies_parent_platform_fk" TO "companies_parent_root_fk";--> statement-breakpoint
ALTER TABLE "contacts" RENAME CONSTRAINT "contacts_parent_platform_fk" TO "contacts_parent_root_fk";--> statement-breakpoint
ALTER TABLE "groups" RENAME CONSTRAINT "groups_parent_platform_fk" TO "groups_parent_root_fk";--> statement-breakpoint
ALTER TABLE "interactions" RENAME CONSTRAINT "interactions_parent_platform_fk" TO "interactions_parent_root_fk";--> statement-breakpoint
ALTER TABLE "leads" RENAME CONSTRAINT "leads_parent_platform_fk" TO "leads_parent_root_fk";--> statement-breakpoint
ALTER TABLE "principal_sets" RENAME CONSTRAINT "principal_sets_parent_platform_fk" TO "principal_sets_parent_root_fk";--> statement-breakpoint
ALTER TABLE "roles" RENAME CONSTRAINT "roles_parent_platform_fk" TO "roles_parent_root_fk";--> statement-breakpoint
ALTER TABLE "service_accounts" RENAME CONSTRAINT "service_accounts_parent_platform_fk" TO "service_accounts_parent_root_fk";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_parent_platform_fk" TO "users_parent_root_fk";--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_object_type_check";--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_parent_required";--> statement-breakpoint
UPDATE "objects" SET "object_type" = 'root' WHERE "object_type" = 'platform';--> statement-breakpoint
UPDATE "roles" SET "scope_type" = 'root' WHERE "scope_type" = 'platform';--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'company', 'contact', 'lead', 'deal', 'lineItem', 'interaction'));--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_required" CHECK (("object_type" = 'root' and "parent_id" is null)
          or ("object_type" <> 'root' and "parent_id" is not null));
