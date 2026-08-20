CREATE TABLE "companies" (
	"id" text PRIMARY KEY,
	"logo" jsonb,
	"name" text NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"lifecycle_stage" text DEFAULT 'prospect' NOT NULL,
	CONSTRAINT "companies_lifecycle_stage_check" CHECK ("lifecycle_stage" in ('prospect', 'customer', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"photo" jsonb,
	"primary_company_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"amount" jsonb,
	"expected_close_date" text,
	CONSTRAINT "deals_stage_check" CHECK ("stage" in (
        'discovery',
        'qualified',
        'proposal',
        'negotiation',
        'won',
        'lost'
      ))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	CONSTRAINT "leads_source_check" CHECK ("source" in ('unknown', 'inbound', 'outbound', 'referral', 'other')),
	CONSTRAINT "leads_status_check" CHECK ("status" in ('new', 'working', 'qualified', 'disqualified'))
);
--> statement-breakpoint
CREATE TABLE "objects" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"parent_id" text,
	"ancestor_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"annotations" jsonb DEFAULT '{}' NOT NULL,
	"etag" text NOT NULL,
	"created_at" text NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by_id" text NOT NULL,
	CONSTRAINT "objects_kind_check" CHECK ("kind" in ('root', 'company', 'contact', 'deal', 'lead')),
	CONSTRAINT "objects_parent_required" CHECK (("kind" = 'root' and "parent_id" is null)
        or ("kind" <> 'root' and "parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "roots" (
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" (lower("domain")) WHERE "domain" <> '';--> statement-breakpoint
CREATE INDEX "contacts_primary_company_id_idx" ON "contacts" ("primary_company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" (lower("email")) WHERE "email" <> '';--> statement-breakpoint
CREATE INDEX "deals_company_id_idx" ON "deals" ("company_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" (lower("email")) WHERE "email" <> '';--> statement-breakpoint
CREATE INDEX "objects_kind_idx" ON "objects" ("kind");--> statement-breakpoint
CREATE INDEX "objects_parent_id_idx" ON "objects" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_ancestor_ids_idx" ON "objects" USING gin ("ancestor_ids");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_primary_company_id_companies_id_fkey" FOREIGN KEY ("primary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_id_objects_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "roots" ADD CONSTRAINT "roots_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;