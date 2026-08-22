CREATE TABLE "companies" (
	"id" text PRIMARY KEY,
	"root_id" text NOT NULL,
	"logo" jsonb,
	"name" text NOT NULL,
	"domain" text,
	"website" text,
	"industry" text,
	"lifecycle_stage" text DEFAULT 'prospect' NOT NULL,
	CONSTRAINT "companies_name_check" CHECK (char_length("name") >= 1 and char_length("name") <= 200),
	CONSTRAINT "companies_domain_check" CHECK (char_length("domain") <= 253),
	CONSTRAINT "companies_website_check" CHECK (char_length("website") <= 2048),
	CONSTRAINT "companies_industry_check" CHECK (char_length("industry") <= 100),
	CONSTRAINT "companies_lifecycle_stage_check" CHECK ("lifecycle_stage" in ('prospect', 'customer', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY,
	"root_id" text NOT NULL,
	"photo" jsonb,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"name" text GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED NOT NULL,
	"job_title" text,
	"email" text,
	"phone" text,
	"primary_company_id" text,
	CONSTRAINT "contacts_first_name_check" CHECK (char_length("first_name") >= 1 and char_length("first_name") <= 100),
	CONSTRAINT "contacts_last_name_check" CHECK (char_length("last_name") >= 1 and char_length("last_name") <= 100),
	CONSTRAINT "contacts_job_title_check" CHECK (char_length("job_title") <= 150),
	CONSTRAINT "contacts_email_check" CHECK (char_length("email") <= 320),
	CONSTRAINT "contacts_phone_check" CHECK (char_length("phone") <= 50)
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY,
	"root_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"amount" jsonb,
	"expected_close_date" date,
	"company_id" text NOT NULL,
	CONSTRAINT "deals_name_check" CHECK (char_length("name") >= 1 and char_length("name") <= 200),
	CONSTRAINT "deals_stage_check" CHECK ("stage" in ('discovery', 'qualified', 'proposal', 'negotiation', 'won', 'lost'))
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY,
	"root_id" text NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"subject_id" text NOT NULL,
	CONSTRAINT "interactions_kind_check" CHECK ("kind" in ('note', 'email', 'call', 'meeting')),
	CONSTRAINT "interactions_summary_check" CHECK (char_length("summary") >= 1 and char_length("summary") <= 500)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY,
	"root_id" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text,
	"phone" text,
	"source" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	CONSTRAINT "leads_name_check" CHECK (char_length("name") >= 1 and char_length("name") <= 200),
	CONSTRAINT "leads_company_name_check" CHECK (char_length("company_name") >= 1 and char_length("company_name") <= 200),
	CONSTRAINT "leads_email_check" CHECK (char_length("email") <= 320),
	CONSTRAINT "leads_phone_check" CHECK (char_length("phone") <= 50),
	CONSTRAINT "leads_source_check" CHECK ("source" in ('unknown', 'inbound', 'outbound', 'referral', 'other')),
	CONSTRAINT "leads_status_check" CHECK ("status" in ('new', 'working', 'qualified', 'disqualified'))
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" text PRIMARY KEY,
	"deal_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" jsonb,
	CONSTRAINT "line_items_name_check" CHECK (char_length("name") >= 1 and char_length("name") <= 200),
	CONSTRAINT "line_items_quantity_check" CHECK ("quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "object_aliases" (
	"alias" text PRIMARY KEY,
	"object_id" text NOT NULL,
	CONSTRAINT "object_aliases_alias_length_check" CHECK (char_length("alias") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "objects" (
	"id" text PRIMARY KEY,
	"object_type" text NOT NULL,
	"parent_id" text,
	"ancestor_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"annotations" jsonb DEFAULT '{}' NOT NULL,
	"etag" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by_id" text NOT NULL,
	CONSTRAINT "objects_object_type_check" CHECK ("object_type" in ('root', 'company', 'contact', 'lead', 'deal', 'lineItem', 'interaction')),
	CONSTRAINT "objects_parent_required" CHECK (("object_type" = 'root' and "parent_id" is null)
          or ("object_type" <> 'root' and "parent_id" is not null))
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
CREATE INDEX "companies_root_id_idx" ON "companies" ("root_id");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" (lower("domain")) WHERE "domain" is not null;--> statement-breakpoint
CREATE INDEX "contacts_root_id_idx" ON "contacts" ("root_id");--> statement-breakpoint
CREATE INDEX "contacts_primary_company_id_idx" ON "contacts" ("primary_company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" (lower("email")) WHERE "email" is not null;--> statement-breakpoint
CREATE INDEX "deals_root_id_idx" ON "deals" ("root_id");--> statement-breakpoint
CREATE INDEX "deals_company_id_idx" ON "deals" ("company_id");--> statement-breakpoint
CREATE INDEX "interactions_root_id_idx" ON "interactions" ("root_id");--> statement-breakpoint
CREATE INDEX "interactions_subject_id_idx" ON "interactions" ("subject_id");--> statement-breakpoint
CREATE INDEX "interactions_occurred_at_idx" ON "interactions" ("occurred_at");--> statement-breakpoint
CREATE INDEX "leads_root_id_idx" ON "leads" ("root_id");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" (lower("email")) WHERE "email" is not null;--> statement-breakpoint
CREATE INDEX "line_items_deal_id_idx" ON "line_items" ("deal_id");--> statement-breakpoint
CREATE INDEX "object_aliases_object_id_idx" ON "object_aliases" ("object_id");--> statement-breakpoint
CREATE INDEX "objects_object_type_idx" ON "objects" ("object_type");--> statement-breakpoint
CREATE INDEX "objects_parent_id_idx" ON "objects" ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_ancestor_ids_idx" ON "objects" USING gin ("ancestor_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "objects_id_parent_id_unique" ON "objects" ("id","parent_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_root_id_roots_id_fkey" FOREIGN KEY ("root_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_object_parent_fk" FOREIGN KEY ("id","root_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_root_id_roots_id_fkey" FOREIGN KEY ("root_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_primary_company_id_companies_id_fkey" FOREIGN KEY ("primary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_object_parent_fk" FOREIGN KEY ("id","root_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_root_id_roots_id_fkey" FOREIGN KEY ("root_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_object_parent_fk" FOREIGN KEY ("id","root_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_root_id_roots_id_fkey" FOREIGN KEY ("root_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_subject_id_interface_party_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "interface_party"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_object_parent_fk" FOREIGN KEY ("id","root_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_root_id_roots_id_fkey" FOREIGN KEY ("root_id") REFERENCES "roots"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_object_parent_fk" FOREIGN KEY ("id","root_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_deal_id_deals_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_object_parent_fk" FOREIGN KEY ("id","deal_id") REFERENCES "objects"("id","parent_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "object_aliases" ADD CONSTRAINT "object_aliases_object_id_objects_id_fkey" FOREIGN KEY ("object_id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_parent_id_objects_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "interface_party" ADD CONSTRAINT "interface_party_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "roots" ADD CONSTRAINT "roots_id_objects_id_fkey" FOREIGN KEY ("id") REFERENCES "objects"("id") ON DELETE CASCADE;