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
CREATE TABLE "identity_bindings" (
	"issuer" text,
	"subject" text,
	"identity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_bindings_pkey" PRIMARY KEY("issuer","subject")
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
INSERT INTO "interface_actor" ("id") SELECT "id" FROM "interface_identity";--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_created_by_id_interface_identity_id_fkey";--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_updated_by_id_interface_identity_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."api_key_credential" DROP CONSTRAINT "api_key_credential_api_key_id_api_keys_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."account" DROP CONSTRAINT "account_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."session" DROP CONSTRAINT "session_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."user_binding" DROP CONSTRAINT "user_binding_auth_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "auth"."invitation_credential" DROP CONSTRAINT "invitation_credential_invitation_id_invitations_id_fkey";--> statement-breakpoint
DELETE FROM "objects" WHERE "object_type" IN ('apiKey', 'invitation');--> statement-breakpoint
DROP TABLE "auth"."api_key_credential";--> statement-breakpoint
DROP TABLE "api_keys";--> statement-breakpoint
DROP TABLE "auth"."account";--> statement-breakpoint
DROP TABLE "auth"."session";--> statement-breakpoint
DROP TABLE "auth"."user";--> statement-breakpoint
DROP TABLE "auth"."user_binding";--> statement-breakpoint
DROP TABLE "auth"."verification";--> statement-breakpoint
DROP TABLE "auth"."invitation_credential";--> statement-breakpoint
DROP TABLE "invitations";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
CREATE INDEX "anonymous_actors_parent_id_idx" ON "anonymous_actors" ("parent_id");--> statement-breakpoint
CREATE INDEX "principal_sets_parent_id_idx" ON "principal_sets" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_sets_kind_unique" ON "principal_sets" ("kind");--> statement-breakpoint
ALTER TABLE "interface_actor" ADD CONSTRAINT "interface_actor_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "anonymous_actors" ADD CONSTRAINT "anonymous_actors_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity_bindings" ADD CONSTRAINT "identity_bindings_identity_id_interface_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "interface_identity"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_created_by_id_interface_actor_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_updated_by_id_interface_actor_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "interface_actor"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_parent_platform_fk" FOREIGN KEY ("parent_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "principal_sets" ADD CONSTRAINT "principal_sets_object_parent_fk" FOREIGN KEY ("id","parent_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" DROP CONSTRAINT "objects_object_type_check", ADD CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('platform', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'company', 'contact', 'lead', 'deal', 'lineItem', 'interaction'));--> statement-breakpoint
DROP SCHEMA "auth";
