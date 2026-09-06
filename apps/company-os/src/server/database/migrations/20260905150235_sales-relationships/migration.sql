CREATE TABLE "contact_companies" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "contact_companies_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
CREATE TABLE "deal_companies" (
	"forward_id" text,
	"reverse_id" text,
	CONSTRAINT "deal_companies_pkey" PRIMARY KEY("forward_id","reverse_id")
);
--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_parent_company_fk";--> statement-breakpoint
CREATE INDEX "contact_companies_forward_id_idx" ON "contact_companies" ("forward_id");--> statement-breakpoint
CREATE INDEX "contact_companies_reverse_id_idx" ON "contact_companies" ("reverse_id");--> statement-breakpoint
CREATE INDEX "deal_companies_forward_id_idx" ON "deal_companies" ("forward_id");--> statement-breakpoint
CREATE INDEX "deal_companies_reverse_id_idx" ON "deal_companies" ("reverse_id");--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_forward_id_contacts_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_reverse_id_companies_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Existing primary selections become memberships before the subset constraint is installed.
INSERT INTO "contact_companies" ("forward_id", "reverse_id")
SELECT "forward_id", "reverse_id" FROM "contact_primary_company" ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Preserve existing authorization parents and ancestry; copy only the commercial association.
INSERT INTO "deal_companies" ("forward_id", "reverse_id")
SELECT "id", "parent_id" FROM "deals" ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "contact_primary_company" ADD CONSTRAINT "contact_primary_company_membership_fk" FOREIGN KEY ("forward_id","reverse_id") REFERENCES "contact_companies"("forward_id","reverse_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deal_companies" ADD CONSTRAINT "deal_companies_forward_id_deals_id_fkey" FOREIGN KEY ("forward_id") REFERENCES "deals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deal_companies" ADD CONSTRAINT "deal_companies_reverse_id_companies_id_fkey" FOREIGN KEY ("reverse_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_parent_authorization_scope_fk" FOREIGN KEY ("parent_id") REFERENCES "interface_authorization_scope"("id") ON DELETE RESTRICT;