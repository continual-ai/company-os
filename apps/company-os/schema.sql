-- Company OS: desired PostgreSQL schema
-- Generated from the model. Edit model or runtime storage source,
-- then run db:reset or db:migration.
-- Domain tables share their record identity with objects.
-- Descriptions are documentation only; they are not stored in PostgreSQL.

-- ===========================================================================
-- Core record storage
-- ===========================================================================

-- Shared record identity, audit fields, and concurrency state. Domain
-- properties live in their object tables.
create table "objects" (
  -- Stable identity shared by the domain row and its interface memberships.
  "id" text not null,
  -- Object type declared in the company model.
  "object_type" text not null,
  "metadata" jsonb not null default '{}',
  "system_managed" boolean not null default false,
  -- Version precondition for optimistic writes.
  "etag" text not null default '1',
  "created_at" timestamp with time zone not null default now(),
  "created_by_id" text not null,
  "updated_at" timestamp with time zone not null default now(),
  "updated_by_id" text not null,
  primary key ("id"),
  constraint "objects_object_type_check" check ("object_type" in (
    'root',
    'user',
    'serviceAccount',
    'anonymousActor',
    'asset',
    'moduleSetting',
    'note',
    'activity',
    'company',
    'contact',
    'lead',
    'deal',
    'lineItem',
    'campaign',
    'content',
    'enrollment',
    'outreach',
    'issue',
    'project',
    'repository',
    'pullRequest',
    'jobPosting',
    'candidate',
    'application',
    'ticket',
    'reply',
    'escalation'
  ))
);

create index "objects_object_type_idx" on "objects" ("object_type");

-- Root identity for application infrastructure.
create table "roots" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Alternate identifiers resolving to one canonical record.
create table "record_aliases" (
  "alias" text not null,
  "object_id" text not null,
  primary key ("alias"),
  foreign key ("object_id") references "objects" ("id") on delete cascade
);

create index "record_aliases_object_id_idx" on "record_aliases" ("object_id");

-- ===========================================================================
-- Interface membership
-- ===========================================================================
-- Each row identifies an implementing record. Properties remain in the domain
-- tables.

-- Actor membership (actor)
-- Who performed an action, such as a user, agent, or anonymous visitor.
create table "interface_actor" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Identity membership (identity)
-- A signed-in user or authenticated service account.
create table "interface_identity" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Note subject membership (noteSubject)
-- A business record that can have notes attached.
create table "interface_note_subject" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Party membership (party)
-- A company or contact involved in your business.
create table "interface_party" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Platform
-- ===========================================================================

-- User (user)
-- Someone who can sign in and use this application.
create table "users" (
  "id" text not null,
  "name" text not null,
  "email" text not null,
  "image" jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Service account (serviceAccount)
-- An account for an integration, application, or agent.
create table "service_accounts" (
  "id" text not null,
  "name" text not null,
  "description" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Anonymous actor (anonymousActor)
-- Identifies activity from visitors who are not signed in.
create table "anonymous_actors" (
  "id" text not null,
  "name" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Asset (asset)
-- A file or image attached to your work.
create table "assets" (
  "id" text not null,
  "name" text not null,
  "content_type" text not null,
  "size" integer not null,
  "state" text not null default 'pending',
  "width" integer,
  "height" integer,
  "checksum" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Module (moduleSetting)
-- Activation of a capability installed in this application. Disabling
-- preserves its records.
create table "module_settings" (
  "id" text not null,
  "module_id" text not null,
  "enabled" boolean not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "module_settings_module_unique" on "module_settings" ("module_id");

-- ===========================================================================
-- Domain objects: Notes
-- ===========================================================================

-- Note (note)
-- Notes on conversations, decisions, or next steps.
create table "notes" (
  "id" text not null,
  "content" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Sales
-- ===========================================================================

-- Activity (activity)
-- A task, call, or meeting with a customer or prospect.
create table "activities" (
  "id" text not null,
  "title" text not null,
  "kind" text not null default 'task',
  "status" text not null default 'planned',
  "due_at" timestamp with time zone,
  "outcome" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Company (company)
-- A customer, prospect, or partner organization.
create table "companies" (
  "id" text not null,
  "name" text not null,
  "logo" jsonb,
  "domain" text,
  "website" text,
  "industry" text,
  -- Manual assessment of how closely this company matches your ideal
  -- customer, from 0 (poor fit) to 100 (strong fit).
  "fit_score" integer,
  "lifecycle_stage" text not null default 'prospect',
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Contact (contact)
-- A customer, prospect, or partner you work with.
create table "contacts" (
  "id" text not null,
  "photo" jsonb,
  "name" text not null,
  -- Manual assessment of your team’s relationship with this person, from 0
  -- (no established relationship) to 100 (strong, active relationship).
  "relationship_strength" integer,
  "job_title" text,
  "email" text,
  -- Choose whether to include this person in marketing audiences.
  "marketing_status" text not null default 'nonMarketing',
  -- Record permission to send marketing emails. Marketing status alone is not
  -- consent.
  "email_permission" text not null default 'unknown',
  "phone" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Lead (lead)
-- A potential customer to qualify and follow up with.
create table "leads" (
  "id" text not null,
  "name" text not null,
  -- For a new company. Leave blank when linking an existing company.
  "company_name" text,
  "email" text,
  "phone" text,
  "source" text not null default 'unknown',
  "status" text not null default 'new',
  "converted_at" timestamp with time zone,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Deal (deal)
-- A sales opportunity with its value, stage, and next steps.
create table "deals" (
  "id" text not null,
  "name" text not null,
  "stage" text not null default 'discovery',
  -- Manual assessment of opportunity health, from 0 (at risk) to 100
  -- (strong), based on engagement, next steps, timing, and blockers.
  "health_score" integer,
  -- Expected or agreed deal value.
  "amount" jsonb,
  "expected_close_date" date,
  "next_step" text,
  "next_step_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Line item (lineItem)
-- A product or service included in a deal.
create table "line_items" (
  "id" text not null,
  "name" text not null,
  "quantity" integer not null default 1,
  "unit_price" jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Marketing
-- ===========================================================================

-- Campaign (campaign)
-- Plan a marketing campaign and track its budget, dates, and audience.
create table "campaigns" (
  "id" text not null,
  "name" text not null,
  "objective" text,
  "channel" text not null default 'content',
  "status" text not null default 'draft',
  "budget" jsonb,
  "start_date" date,
  "end_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Content (content)
-- Track an article, post, or ad. Saving does not publish it.
create table "contents" (
  "id" text not null,
  "title" text not null,
  "format" text not null default 'article',
  "status" text not null default 'draft',
  "brief" text,
  "body" text,
  "scheduled_at" timestamp with time zone,
  "published_url" text,
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Enrollment (enrollment)
-- Track a contact's progress and next follow-up in a campaign.
create table "enrollments" (
  "id" text not null,
  "name" text not null,
  "status" text not null default 'queued',
  "step" integer not null default 0,
  "next_touch_at" timestamp with time zone,
  "context" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Outreach (outreach)
-- Track a message and its delivery status. Saving does not send it.
create table "outreaches" (
  "id" text not null,
  "subject" text not null,
  "channel" text not null default 'email',
  "status" text not null default 'draft',
  "body" text,
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "external_id" text,
  "failure" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Engineering
-- ===========================================================================

-- Issue (issue)
-- A bug, request, or task to investigate and resolve.
create table "issues" (
  "id" text not null,
  "title" text not null,
  "description" text,
  "priority" text not null default 'normal',
  "due_date" date,
  "status" text not null default 'backlog',
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Project (project)
-- Related work organized around a goal and target date.
create table "projects" (
  "id" text not null,
  "name" text not null,
  "objective" text,
  "status" text not null default 'planned',
  "target_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Repository (repository)
-- A codebase connected to your projects, issues, and pull requests.
create table "repositories" (
  "id" text not null,
  "name" text not null,
  "url" text,
  "default_branch" text not null default 'main',
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Pull request (pullRequest)
-- Track a code change, its reviews, and checks. Merge it in your code hosting
-- service.
create table "pull_requests" (
  "id" text not null,
  "title" text not null,
  "number" integer,
  "url" text,
  "status" text not null default 'draft',
  "review" text not null default 'pending',
  "checks" text not null default 'pending',
  "head_commit" text,
  "observed_at" timestamp with time zone,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Hiring
-- ===========================================================================

-- Job posting (jobPosting)
-- A role your company is hiring for.
create table "job_postings" (
  "id" text not null,
  "title" text not null,
  "description" text not null,
  "department" text,
  "location" text,
  "employment_type" text not null default 'fullTime',
  "status" text not null default 'draft',
  "published_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Candidate (candidate)
-- A person who may apply for one or more roles.
create table "candidates" (
  "id" text not null,
  "name" text not null,
  "email" text not null,
  "phone" text,
  "linkedin_url" text,
  "portfolio_url" text,
  "resume" jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "candidates_email_unique" on "candidates" ("email");

-- Application (application)
-- A candidate's application for a specific job posting.
create table "applications" (
  "id" text not null,
  "stage" text not null default 'new',
  "source" text not null default 'unknown',
  "cover_letter" text,
  "resume" jsonb,
  "rating" integer,
  "review_notes" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Support
-- ===========================================================================

-- Ticket (ticket)
-- A customer request or problem to investigate and resolve.
create table "tickets" (
  "id" text not null,
  "subject" text not null,
  "description" text,
  "priority" text not null default 'normal',
  "status" text not null default 'new',
  "respond_by_at" timestamp with time zone,
  "resolution" text,
  "external_id" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Reply (reply)
-- A message about a support ticket. Saving does not send it.
create table "replies" (
  "id" text not null,
  "subject" text not null,
  "direction" text not null default 'inbound',
  "status" text not null default 'draft',
  "body" text not null,
  "external_id" text,
  "sent_at" timestamp with time zone,
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Support engineering
-- ===========================================================================

-- Engineering escalation (escalation)
-- A support request handed to engineering, with a durable receipt for
-- retries.
create table "escalations" (
  "id" text not null,
  "name" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Relationships
-- ===========================================================================
-- Association pairs and cardinality constraints.

-- Note subjects (noteSubjects)
create table "link_note_subjects" (
  -- References notes.id.
  "forward_id" text not null,
  -- References interface_note_subject.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "notes" ("id") on delete cascade,
  foreign key ("reverse_id") references "interface_note_subject" ("id") on delete cascade
);

create index "link_note_subjects_forward_id_idx" on "link_note_subjects" ("forward_id");
create index "link_note_subjects_reverse_id_idx" on "link_note_subjects" ("reverse_id");

-- Deal line items (dealLineItems)
create table "link_deal_line_items" (
  -- References deals.id.
  "forward_id" text not null,
  -- References line_items.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "deals" ("id") on delete cascade,
  foreign key ("reverse_id") references "line_items" ("id") on delete cascade
);

create index "link_deal_line_items_forward_id_idx" on "link_deal_line_items" ("forward_id");
create unique index "link_deal_line_items_reverse_id_unique" on "link_deal_line_items" ("reverse_id");

-- Contact companies (contactCompanies)
create table "link_contact_companies" (
  -- References contacts.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "contacts" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create index "link_contact_companies_forward_id_idx" on "link_contact_companies" ("forward_id");
create index "link_contact_companies_reverse_id_idx" on "link_contact_companies" ("reverse_id");

-- Contact primary company (contactPrimaryCompany)
-- A selection from contactCompanies; removing membership clears the
-- selection.
create table "link_contact_primary_company" (
  -- References contacts.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "contacts" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create unique index "link_contact_primary_company_forward_id_unique" on "link_contact_primary_company" ("forward_id");
create index "link_contact_primary_company_reverse_id_idx" on "link_contact_primary_company" ("reverse_id");

-- Deal companies (dealCompanies)
create table "link_deal_companies" (
  -- References deals.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "deals" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create index "link_deal_companies_forward_id_idx" on "link_deal_companies" ("forward_id");
create index "link_deal_companies_reverse_id_idx" on "link_deal_companies" ("reverse_id");

-- Activity Company (activityCompany)
create table "link_activity_company" (
  -- References activities.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create unique index "link_activity_company_forward_id_unique" on "link_activity_company" ("forward_id");
create index "link_activity_company_reverse_id_idx" on "link_activity_company" ("reverse_id");

-- Activity Contact (activityContact)
create table "link_activity_contact" (
  -- References activities.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create unique index "link_activity_contact_forward_id_unique" on "link_activity_contact" ("forward_id");
create index "link_activity_contact_reverse_id_idx" on "link_activity_contact" ("reverse_id");

-- Activity Deal (activityDeal)
create table "link_activity_deal" (
  -- References activities.id.
  "forward_id" text not null,
  -- References deals.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "deals" ("id") on delete cascade
);

create unique index "link_activity_deal_forward_id_unique" on "link_activity_deal" ("forward_id");
create index "link_activity_deal_reverse_id_idx" on "link_activity_deal" ("reverse_id");

-- Activity Owner (activityOwner)
create table "link_activity_owner" (
  -- References activities.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_activity_owner_forward_id_unique" on "link_activity_owner" ("forward_id");
create index "link_activity_owner_reverse_id_idx" on "link_activity_owner" ("reverse_id");

-- Deal Owner (dealOwner)
create table "link_deal_owner" (
  -- References deals.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "deals" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_deal_owner_forward_id_unique" on "link_deal_owner" ("forward_id");
create index "link_deal_owner_reverse_id_idx" on "link_deal_owner" ("reverse_id");

-- Lead Company (leadCompany)
create table "link_lead_company" (
  -- References leads.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "leads" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create unique index "link_lead_company_forward_id_unique" on "link_lead_company" ("forward_id");
create index "link_lead_company_reverse_id_idx" on "link_lead_company" ("reverse_id");

-- Lead Converted company (leadConvertedCompany)
create table "link_lead_converted_company" (
  -- References leads.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "leads" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create unique index "link_lead_converted_company_forward_id_unique" on "link_lead_converted_company" ("forward_id");
create index "link_lead_converted_company_reverse_id_idx" on "link_lead_converted_company" ("reverse_id");

-- Lead Converted contact (leadConvertedContact)
create table "link_lead_converted_contact" (
  -- References leads.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "leads" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create unique index "link_lead_converted_contact_forward_id_unique" on "link_lead_converted_contact" ("forward_id");
create index "link_lead_converted_contact_reverse_id_idx" on "link_lead_converted_contact" ("reverse_id");

-- Campaign Owner (campaignOwner)
create table "link_campaign_owner" (
  -- References campaigns.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "campaigns" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_campaign_owner_forward_id_unique" on "link_campaign_owner" ("forward_id");
create index "link_campaign_owner_reverse_id_idx" on "link_campaign_owner" ("reverse_id");

-- Content Campaign (contentCampaign)
create table "link_content_campaign" (
  -- References contents.id.
  "forward_id" text not null,
  -- References campaigns.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "contents" ("id") on delete cascade,
  foreign key ("reverse_id") references "campaigns" ("id") on delete cascade
);

create unique index "link_content_campaign_forward_id_unique" on "link_content_campaign" ("forward_id");
create index "link_content_campaign_reverse_id_idx" on "link_content_campaign" ("reverse_id");

-- Content Owner (contentOwner)
create table "link_content_owner" (
  -- References contents.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "contents" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_content_owner_forward_id_unique" on "link_content_owner" ("forward_id");
create index "link_content_owner_reverse_id_idx" on "link_content_owner" ("reverse_id");

-- Enrollment Campaign (enrollmentCampaign)
create table "link_enrollment_campaign" (
  -- References enrollments.id.
  "forward_id" text not null,
  -- References campaigns.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "enrollments" ("id") on delete cascade,
  foreign key ("reverse_id") references "campaigns" ("id") on delete cascade
);

create unique index "link_enrollment_campaign_forward_id_unique" on "link_enrollment_campaign" ("forward_id");
create index "link_enrollment_campaign_reverse_id_idx" on "link_enrollment_campaign" ("reverse_id");

-- Enrollment Contact (enrollmentContact)
create table "link_enrollment_contact" (
  -- References enrollments.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "enrollments" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create unique index "link_enrollment_contact_forward_id_unique" on "link_enrollment_contact" ("forward_id");
create index "link_enrollment_contact_reverse_id_idx" on "link_enrollment_contact" ("reverse_id");

-- Outreach Campaign (outreachCampaign)
create table "link_outreach_campaign" (
  -- References outreaches.id.
  "forward_id" text not null,
  -- References campaigns.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "outreaches" ("id") on delete cascade,
  foreign key ("reverse_id") references "campaigns" ("id") on delete cascade
);

create unique index "link_outreach_campaign_forward_id_unique" on "link_outreach_campaign" ("forward_id");
create index "link_outreach_campaign_reverse_id_idx" on "link_outreach_campaign" ("reverse_id");

-- Outreach Recipient (outreachContact)
create table "link_outreach_contact" (
  -- References outreaches.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "outreaches" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create unique index "link_outreach_contact_forward_id_unique" on "link_outreach_contact" ("forward_id");
create index "link_outreach_contact_reverse_id_idx" on "link_outreach_contact" ("reverse_id");

-- Outreach Owner (outreachOwner)
create table "link_outreach_owner" (
  -- References outreaches.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "outreaches" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_outreach_owner_forward_id_unique" on "link_outreach_owner" ("forward_id");
create index "link_outreach_owner_reverse_id_idx" on "link_outreach_owner" ("reverse_id");

-- Pull requests (issuePullRequests)
create table "link_issue_pull_requests" (
  -- References issues.id.
  "forward_id" text not null,
  -- References pull_requests.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "pull_requests" ("id") on delete cascade
);

create index "link_issue_pull_requests_forward_id_idx" on "link_issue_pull_requests" ("forward_id");
create index "link_issue_pull_requests_reverse_id_idx" on "link_issue_pull_requests" ("reverse_id");

-- Issue Project (issueProject)
create table "link_issue_project" (
  -- References issues.id.
  "forward_id" text not null,
  -- References projects.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "projects" ("id") on delete cascade
);

create unique index "link_issue_project_forward_id_unique" on "link_issue_project" ("forward_id");
create index "link_issue_project_reverse_id_idx" on "link_issue_project" ("reverse_id");

-- Issue Assignee (issueAssignee)
create table "link_issue_assignee" (
  -- References issues.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_issue_assignee_forward_id_unique" on "link_issue_assignee" ("forward_id");
create index "link_issue_assignee_reverse_id_idx" on "link_issue_assignee" ("reverse_id");

-- Project Owner (projectOwner)
create table "link_project_owner" (
  -- References projects.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "projects" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_project_owner_forward_id_unique" on "link_project_owner" ("forward_id");
create index "link_project_owner_reverse_id_idx" on "link_project_owner" ("reverse_id");

-- PullRequest Repository (pullRequestRepository)
create table "link_pull_request_repository" (
  -- References pull_requests.id.
  "forward_id" text not null,
  -- References repositories.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "pull_requests" ("id") on delete cascade,
  foreign key ("reverse_id") references "repositories" ("id") on delete cascade
);

create unique index "link_pull_request_repository_forward_id_unique" on "link_pull_request_repository" ("forward_id");
create index "link_pull_request_repository_reverse_id_idx" on "link_pull_request_repository" ("reverse_id");

-- Repository Project (repositoryProject)
create table "link_repository_project" (
  -- References repositories.id.
  "forward_id" text not null,
  -- References projects.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "repositories" ("id") on delete cascade,
  foreign key ("reverse_id") references "projects" ("id") on delete cascade
);

create unique index "link_repository_project_forward_id_unique" on "link_repository_project" ("forward_id");
create index "link_repository_project_reverse_id_idx" on "link_repository_project" ("reverse_id");

-- Repository Owner (repositoryOwner)
create table "link_repository_owner" (
  -- References repositories.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "repositories" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_repository_owner_forward_id_unique" on "link_repository_owner" ("forward_id");
create index "link_repository_owner_reverse_id_idx" on "link_repository_owner" ("reverse_id");

-- Application Job posting (applicationJob)
create table "link_application_job" (
  -- References applications.id.
  "forward_id" text not null,
  -- References job_postings.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "applications" ("id") on delete cascade,
  foreign key ("reverse_id") references "job_postings" ("id") on delete cascade
);

create unique index "link_application_job_forward_id_unique" on "link_application_job" ("forward_id");
create index "link_application_job_reverse_id_idx" on "link_application_job" ("reverse_id");

-- Application Candidate (applicationCandidate)
create table "link_application_candidate" (
  -- References applications.id.
  "forward_id" text not null,
  -- References candidates.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "applications" ("id") on delete cascade,
  foreign key ("reverse_id") references "candidates" ("id") on delete cascade
);

create unique index "link_application_candidate_forward_id_unique" on "link_application_candidate" ("forward_id");
create index "link_application_candidate_reverse_id_idx" on "link_application_candidate" ("reverse_id");

-- JobPosting Hiring manager (jobPostingHiringManager)
create table "link_job_posting_hiring_manager" (
  -- References job_postings.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "job_postings" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_job_posting_hiring_manager_forward_id_unique" on "link_job_posting_hiring_manager" ("forward_id");
create index "link_job_posting_hiring_manager_reverse_id_idx" on "link_job_posting_hiring_manager" ("reverse_id");

-- Reply Ticket (replyTicket)
create table "link_reply_ticket" (
  -- References replies.id.
  "forward_id" text not null,
  -- References tickets.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "replies" ("id") on delete cascade,
  foreign key ("reverse_id") references "tickets" ("id") on delete cascade
);

create unique index "link_reply_ticket_forward_id_unique" on "link_reply_ticket" ("forward_id");
create index "link_reply_ticket_reverse_id_idx" on "link_reply_ticket" ("reverse_id");

-- Ticket Company (ticketCompany)
create table "link_ticket_company" (
  -- References tickets.id.
  "forward_id" text not null,
  -- References companies.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tickets" ("id") on delete cascade,
  foreign key ("reverse_id") references "companies" ("id") on delete cascade
);

create unique index "link_ticket_company_forward_id_unique" on "link_ticket_company" ("forward_id");
create index "link_ticket_company_reverse_id_idx" on "link_ticket_company" ("reverse_id");

-- Ticket Requester (ticketRequester)
create table "link_ticket_requester" (
  -- References tickets.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tickets" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create unique index "link_ticket_requester_forward_id_unique" on "link_ticket_requester" ("forward_id");
create index "link_ticket_requester_reverse_id_idx" on "link_ticket_requester" ("reverse_id");

-- Ticket Owner (ticketOwner)
create table "link_ticket_owner" (
  -- References tickets.id.
  "forward_id" text not null,
  -- References users.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tickets" ("id") on delete cascade,
  foreign key ("reverse_id") references "users" ("id") on delete cascade
);

create unique index "link_ticket_owner_forward_id_unique" on "link_ticket_owner" ("forward_id");
create index "link_ticket_owner_reverse_id_idx" on "link_ticket_owner" ("reverse_id");

-- Engineering issues (ticketIssues)
create table "link_ticket_issues" (
  -- References tickets.id.
  "forward_id" text not null,
  -- References issues.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tickets" ("id") on delete cascade,
  foreign key ("reverse_id") references "issues" ("id") on delete cascade
);

create index "link_ticket_issues_forward_id_idx" on "link_ticket_issues" ("forward_id");
create index "link_ticket_issues_reverse_id_idx" on "link_ticket_issues" ("reverse_id");

-- Escalation Ticket (escalationTicket)
create table "link_escalation_ticket" (
  -- References escalations.id.
  "forward_id" text not null,
  -- References tickets.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "escalations" ("id") on delete cascade,
  foreign key ("reverse_id") references "tickets" ("id") on delete cascade
);

create unique index "link_escalation_ticket_forward_id_unique" on "link_escalation_ticket" ("forward_id");
create index "link_escalation_ticket_reverse_id_idx" on "link_escalation_ticket" ("reverse_id");

-- Escalation Issue (escalationIssue)
create table "link_escalation_issue" (
  -- References escalations.id.
  "forward_id" text not null,
  -- References issues.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "escalations" ("id") on delete cascade,
  foreign key ("reverse_id") references "issues" ("id") on delete cascade
);

create unique index "link_escalation_issue_forward_id_unique" on "link_escalation_issue" ("forward_id");
create index "link_escalation_issue_reverse_id_idx" on "link_escalation_issue" ("reverse_id");

create function "check_note_subjects"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "notes" where id = source_id) then
    select count(*) into n from "link_note_subjects" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'noteSubjects', 'subjects', 0, 'unbounded', n
        using errcode = '23514', constraint = 'noteSubjects.subjects.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "interface_note_subject" where id = source_id) then
    select count(*) into n from "link_note_subjects" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'noteSubjects', 'notes', 0, 'unbounded', n
        using errcode = '23514', constraint = 'noteSubjects.notes.bounds';
    end if;
  end if;
end $$;

create function "validate_note_subjects"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_note_subjects"(OLD.forward_id, 'forward');
    perform "check_note_subjects"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_note_subjects"(NEW.forward_id, 'forward');
    perform "check_note_subjects"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_note_subjects" after insert or update or delete on "link_note_subjects" deferrable initially deferred for each row execute function "validate_note_subjects"();

create function "lock_note_subjects"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:noteSubjects', 0));
  return null;
end $$;

create trigger "lock_note_subjects" before insert or update or delete on "link_note_subjects" for each statement execute function "lock_note_subjects"();

create function "check_deal_line_items"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "deals" where id = source_id) then
    select count(*) into n from "link_deal_line_items" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealLineItems', 'lineItems', 0, 'unbounded', n
        using errcode = '23514', constraint = 'dealLineItems.lineItems.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "line_items" where id = source_id) then
    select count(*) into n from "link_deal_line_items" where "reverse_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealLineItems', 'deal', 1, '1', n
        using errcode = '23514', constraint = 'dealLineItems.deal.bounds';
    end if;
  end if;
end $$;

create function "validate_deal_line_items"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_deal_line_items"(OLD.forward_id, 'forward');
    perform "check_deal_line_items"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_deal_line_items"(NEW.forward_id, 'forward');
    perform "check_deal_line_items"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_deal_line_items" after insert or update or delete on "link_deal_line_items" deferrable initially deferred for each row execute function "validate_deal_line_items"();

create function "lock_deal_line_items"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:dealLineItems', 0));
  return null;
end $$;

create trigger "lock_deal_line_items" before insert or update or delete on "link_deal_line_items" for each statement execute function "lock_deal_line_items"();

create function "require_deal_line_items_reverse"() returns trigger language plpgsql as $$
begin
  perform "check_deal_line_items"(NEW.id, 'reverse');
  return null;
end $$;

create constraint trigger "require_deal_line_items_reverse" after insert on "line_items" deferrable initially deferred for each row execute function "require_deal_line_items_reverse"();

create function "check_contact_companies"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_contact_companies" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contactCompanies', 'companies', 0, 'unbounded', n
        using errcode = '23514', constraint = 'contactCompanies.companies.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_contact_companies" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contactCompanies', 'contacts', 0, 'unbounded', n
        using errcode = '23514', constraint = 'contactCompanies.contacts.bounds';
    end if;
  end if;
end $$;

create function "validate_contact_companies"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_contact_companies"(OLD.forward_id, 'forward');
    perform "check_contact_companies"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_contact_companies"(NEW.forward_id, 'forward');
    perform "check_contact_companies"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_contact_companies" after insert or update or delete on "link_contact_companies" deferrable initially deferred for each row execute function "validate_contact_companies"();

create function "lock_contact_companies"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:contactCompanies', 0));
  return null;
end $$;

create trigger "lock_contact_companies" before insert or update or delete on "link_contact_companies" for each statement execute function "lock_contact_companies"();

create function "check_contact_primary_company"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_contact_primary_company" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contactPrimaryCompany', 'primaryCompany', 0, '1', n
        using errcode = '23514', constraint = 'contactPrimaryCompany.primaryCompany.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_contact_primary_company" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contactPrimaryCompany', 'primaryContacts', 0, 'unbounded', n
        using errcode = '23514', constraint = 'contactPrimaryCompany.primaryContacts.bounds';
    end if;
  end if;
end $$;

create function "validate_contact_primary_company"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_contact_primary_company"(OLD.forward_id, 'forward');
    perform "check_contact_primary_company"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_contact_primary_company"(NEW.forward_id, 'forward');
    perform "check_contact_primary_company"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_contact_primary_company" after insert or update or delete on "link_contact_primary_company" deferrable initially deferred for each row execute function "validate_contact_primary_company"();

create function "lock_contact_primary_company"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:contactPrimaryCompany', 0));
  return null;
end $$;

create trigger "lock_contact_primary_company" before insert or update or delete on "link_contact_primary_company" for each statement execute function "lock_contact_primary_company"();

create function "check_deal_companies"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "deals" where id = source_id) then
    select count(*) into n from "link_deal_companies" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealCompanies', 'companies', 0, 'unbounded', n
        using errcode = '23514', constraint = 'dealCompanies.companies.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_deal_companies" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealCompanies', 'deals', 0, 'unbounded', n
        using errcode = '23514', constraint = 'dealCompanies.deals.bounds';
    end if;
  end if;
end $$;

create function "validate_deal_companies"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_deal_companies"(OLD.forward_id, 'forward');
    perform "check_deal_companies"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_deal_companies"(NEW.forward_id, 'forward');
    perform "check_deal_companies"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_deal_companies" after insert or update or delete on "link_deal_companies" deferrable initially deferred for each row execute function "validate_deal_companies"();

create function "lock_deal_companies"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:dealCompanies', 0));
  return null;
end $$;

create trigger "lock_deal_companies" before insert or update or delete on "link_deal_companies" for each statement execute function "lock_deal_companies"();

create function "check_activity_company"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "activities" where id = source_id) then
    select count(*) into n from "link_activity_company" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityCompany', 'company', 0, '1', n
        using errcode = '23514', constraint = 'activityCompany.company.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_activity_company" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityCompany', 'activities', 0, 'unbounded', n
        using errcode = '23514', constraint = 'activityCompany.activities.bounds';
    end if;
  end if;
end $$;

create function "validate_activity_company"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_activity_company"(OLD.forward_id, 'forward');
    perform "check_activity_company"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_activity_company"(NEW.forward_id, 'forward');
    perform "check_activity_company"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_activity_company" after insert or update or delete on "link_activity_company" deferrable initially deferred for each row execute function "validate_activity_company"();

create function "lock_activity_company"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:activityCompany', 0));
  return null;
end $$;

create trigger "lock_activity_company" before insert or update or delete on "link_activity_company" for each statement execute function "lock_activity_company"();

create function "check_activity_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "activities" where id = source_id) then
    select count(*) into n from "link_activity_contact" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityContact', 'contact', 0, '1', n
        using errcode = '23514', constraint = 'activityContact.contact.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_activity_contact" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityContact', 'activities', 0, 'unbounded', n
        using errcode = '23514', constraint = 'activityContact.activities.bounds';
    end if;
  end if;
end $$;

create function "validate_activity_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_activity_contact"(OLD.forward_id, 'forward');
    perform "check_activity_contact"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_activity_contact"(NEW.forward_id, 'forward');
    perform "check_activity_contact"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_activity_contact" after insert or update or delete on "link_activity_contact" deferrable initially deferred for each row execute function "validate_activity_contact"();

create function "lock_activity_contact"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:activityContact', 0));
  return null;
end $$;

create trigger "lock_activity_contact" before insert or update or delete on "link_activity_contact" for each statement execute function "lock_activity_contact"();

create function "check_activity_deal"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "activities" where id = source_id) then
    select count(*) into n from "link_activity_deal" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityDeal', 'deal', 0, '1', n
        using errcode = '23514', constraint = 'activityDeal.deal.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "deals" where id = source_id) then
    select count(*) into n from "link_activity_deal" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityDeal', 'activities', 0, 'unbounded', n
        using errcode = '23514', constraint = 'activityDeal.activities.bounds';
    end if;
  end if;
end $$;

create function "validate_activity_deal"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_activity_deal"(OLD.forward_id, 'forward');
    perform "check_activity_deal"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_activity_deal"(NEW.forward_id, 'forward');
    perform "check_activity_deal"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_activity_deal" after insert or update or delete on "link_activity_deal" deferrable initially deferred for each row execute function "validate_activity_deal"();

create function "lock_activity_deal"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:activityDeal', 0));
  return null;
end $$;

create trigger "lock_activity_deal" before insert or update or delete on "link_activity_deal" for each statement execute function "lock_activity_deal"();

create function "check_activity_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "activities" where id = source_id) then
    select count(*) into n from "link_activity_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'activityOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_activity_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'activityOwner', 'activities', 0, 'unbounded', n
        using errcode = '23514', constraint = 'activityOwner.activities.bounds';
    end if;
  end if;
end $$;

create function "validate_activity_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_activity_owner"(OLD.forward_id, 'forward');
    perform "check_activity_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_activity_owner"(NEW.forward_id, 'forward');
    perform "check_activity_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_activity_owner" after insert or update or delete on "link_activity_owner" deferrable initially deferred for each row execute function "validate_activity_owner"();

create function "lock_activity_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:activityOwner', 0));
  return null;
end $$;

create trigger "lock_activity_owner" before insert or update or delete on "link_activity_owner" for each statement execute function "lock_activity_owner"();

create function "check_deal_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "deals" where id = source_id) then
    select count(*) into n from "link_deal_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'dealOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_deal_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'dealOwner', 'deals', 0, 'unbounded', n
        using errcode = '23514', constraint = 'dealOwner.deals.bounds';
    end if;
  end if;
end $$;

create function "validate_deal_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_deal_owner"(OLD.forward_id, 'forward');
    perform "check_deal_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_deal_owner"(NEW.forward_id, 'forward');
    perform "check_deal_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_deal_owner" after insert or update or delete on "link_deal_owner" deferrable initially deferred for each row execute function "validate_deal_owner"();

create function "lock_deal_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:dealOwner', 0));
  return null;
end $$;

create trigger "lock_deal_owner" before insert or update or delete on "link_deal_owner" for each statement execute function "lock_deal_owner"();

create function "check_lead_company"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "leads" where id = source_id) then
    select count(*) into n from "link_lead_company" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadCompany', 'company', 0, '1', n
        using errcode = '23514', constraint = 'leadCompany.company.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_lead_company" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadCompany', 'leads', 0, 'unbounded', n
        using errcode = '23514', constraint = 'leadCompany.leads.bounds';
    end if;
  end if;
end $$;

create function "validate_lead_company"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_lead_company"(OLD.forward_id, 'forward');
    perform "check_lead_company"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_lead_company"(NEW.forward_id, 'forward');
    perform "check_lead_company"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_lead_company" after insert or update or delete on "link_lead_company" deferrable initially deferred for each row execute function "validate_lead_company"();

create function "lock_lead_company"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:leadCompany', 0));
  return null;
end $$;

create trigger "lock_lead_company" before insert or update or delete on "link_lead_company" for each statement execute function "lock_lead_company"();

create function "check_lead_converted_company"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "leads" where id = source_id) then
    select count(*) into n from "link_lead_converted_company" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadConvertedCompany', 'convertedCompany', 0, '1', n
        using errcode = '23514', constraint = 'leadConvertedCompany.convertedCompany.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_lead_converted_company" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadConvertedCompany', 'convertedLeads', 0, 'unbounded', n
        using errcode = '23514', constraint = 'leadConvertedCompany.convertedLeads.bounds';
    end if;
  end if;
end $$;

create function "validate_lead_converted_company"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_lead_converted_company"(OLD.forward_id, 'forward');
    perform "check_lead_converted_company"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_lead_converted_company"(NEW.forward_id, 'forward');
    perform "check_lead_converted_company"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_lead_converted_company" after insert or update or delete on "link_lead_converted_company" deferrable initially deferred for each row execute function "validate_lead_converted_company"();

create function "lock_lead_converted_company"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:leadConvertedCompany', 0));
  return null;
end $$;

create trigger "lock_lead_converted_company" before insert or update or delete on "link_lead_converted_company" for each statement execute function "lock_lead_converted_company"();

create function "check_lead_converted_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "leads" where id = source_id) then
    select count(*) into n from "link_lead_converted_contact" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadConvertedContact', 'convertedContact', 0, '1', n
        using errcode = '23514', constraint = 'leadConvertedContact.convertedContact.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_lead_converted_contact" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadConvertedContact', 'convertedLeads', 0, 'unbounded', n
        using errcode = '23514', constraint = 'leadConvertedContact.convertedLeads.bounds';
    end if;
  end if;
end $$;

create function "validate_lead_converted_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_lead_converted_contact"(OLD.forward_id, 'forward');
    perform "check_lead_converted_contact"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_lead_converted_contact"(NEW.forward_id, 'forward');
    perform "check_lead_converted_contact"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_lead_converted_contact" after insert or update or delete on "link_lead_converted_contact" deferrable initially deferred for each row execute function "validate_lead_converted_contact"();

create function "lock_lead_converted_contact"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:leadConvertedContact', 0));
  return null;
end $$;

create trigger "lock_lead_converted_contact" before insert or update or delete on "link_lead_converted_contact" for each statement execute function "lock_lead_converted_contact"();

create function "check_campaign_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "campaigns" where id = source_id) then
    select count(*) into n from "link_campaign_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'campaignOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'campaignOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_campaign_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'campaignOwner', 'campaigns', 0, 'unbounded', n
        using errcode = '23514', constraint = 'campaignOwner.campaigns.bounds';
    end if;
  end if;
end $$;

create function "validate_campaign_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_campaign_owner"(OLD.forward_id, 'forward');
    perform "check_campaign_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_campaign_owner"(NEW.forward_id, 'forward');
    perform "check_campaign_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_campaign_owner" after insert or update or delete on "link_campaign_owner" deferrable initially deferred for each row execute function "validate_campaign_owner"();

create function "lock_campaign_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:campaignOwner', 0));
  return null;
end $$;

create trigger "lock_campaign_owner" before insert or update or delete on "link_campaign_owner" for each statement execute function "lock_campaign_owner"();

create function "check_content_campaign"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "contents" where id = source_id) then
    select count(*) into n from "link_content_campaign" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contentCampaign', 'campaign', 0, '1', n
        using errcode = '23514', constraint = 'contentCampaign.campaign.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "campaigns" where id = source_id) then
    select count(*) into n from "link_content_campaign" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contentCampaign', 'content', 0, 'unbounded', n
        using errcode = '23514', constraint = 'contentCampaign.content.bounds';
    end if;
  end if;
end $$;

create function "validate_content_campaign"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_content_campaign"(OLD.forward_id, 'forward');
    perform "check_content_campaign"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_content_campaign"(NEW.forward_id, 'forward');
    perform "check_content_campaign"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_content_campaign" after insert or update or delete on "link_content_campaign" deferrable initially deferred for each row execute function "validate_content_campaign"();

create function "lock_content_campaign"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:contentCampaign', 0));
  return null;
end $$;

create trigger "lock_content_campaign" before insert or update or delete on "link_content_campaign" for each statement execute function "lock_content_campaign"();

create function "check_content_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "contents" where id = source_id) then
    select count(*) into n from "link_content_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contentOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'contentOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_content_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'contentOwner', 'content', 0, 'unbounded', n
        using errcode = '23514', constraint = 'contentOwner.content.bounds';
    end if;
  end if;
end $$;

create function "validate_content_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_content_owner"(OLD.forward_id, 'forward');
    perform "check_content_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_content_owner"(NEW.forward_id, 'forward');
    perform "check_content_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_content_owner" after insert or update or delete on "link_content_owner" deferrable initially deferred for each row execute function "validate_content_owner"();

create function "lock_content_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:contentOwner', 0));
  return null;
end $$;

create trigger "lock_content_owner" before insert or update or delete on "link_content_owner" for each statement execute function "lock_content_owner"();

create function "check_enrollment_campaign"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "enrollments" where id = source_id) then
    select count(*) into n from "link_enrollment_campaign" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'enrollmentCampaign', 'campaign', 1, '1', n
        using errcode = '23514', constraint = 'enrollmentCampaign.campaign.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "campaigns" where id = source_id) then
    select count(*) into n from "link_enrollment_campaign" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'enrollmentCampaign', 'enrollments', 0, 'unbounded', n
        using errcode = '23514', constraint = 'enrollmentCampaign.enrollments.bounds';
    end if;
  end if;
end $$;

create function "validate_enrollment_campaign"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_enrollment_campaign"(OLD.forward_id, 'forward');
    perform "check_enrollment_campaign"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_enrollment_campaign"(NEW.forward_id, 'forward');
    perform "check_enrollment_campaign"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_enrollment_campaign" after insert or update or delete on "link_enrollment_campaign" deferrable initially deferred for each row execute function "validate_enrollment_campaign"();

create function "lock_enrollment_campaign"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:enrollmentCampaign', 0));
  return null;
end $$;

create trigger "lock_enrollment_campaign" before insert or update or delete on "link_enrollment_campaign" for each statement execute function "lock_enrollment_campaign"();

create function "require_enrollment_campaign_forward"() returns trigger language plpgsql as $$
begin
  perform "check_enrollment_campaign"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_enrollment_campaign_forward" after insert on "enrollments" deferrable initially deferred for each row execute function "require_enrollment_campaign_forward"();

create function "check_enrollment_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "enrollments" where id = source_id) then
    select count(*) into n from "link_enrollment_contact" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'enrollmentContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'enrollmentContact.contact.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_enrollment_contact" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'enrollmentContact', 'enrollments', 0, 'unbounded', n
        using errcode = '23514', constraint = 'enrollmentContact.enrollments.bounds';
    end if;
  end if;
end $$;

create function "validate_enrollment_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_enrollment_contact"(OLD.forward_id, 'forward');
    perform "check_enrollment_contact"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_enrollment_contact"(NEW.forward_id, 'forward');
    perform "check_enrollment_contact"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_enrollment_contact" after insert or update or delete on "link_enrollment_contact" deferrable initially deferred for each row execute function "validate_enrollment_contact"();

create function "lock_enrollment_contact"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:enrollmentContact', 0));
  return null;
end $$;

create trigger "lock_enrollment_contact" before insert or update or delete on "link_enrollment_contact" for each statement execute function "lock_enrollment_contact"();

create function "require_enrollment_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_enrollment_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_enrollment_contact_forward" after insert on "enrollments" deferrable initially deferred for each row execute function "require_enrollment_contact_forward"();

create function "check_outreach_campaign"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "outreaches" where id = source_id) then
    select count(*) into n from "link_outreach_campaign" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachCampaign', 'campaign', 0, '1', n
        using errcode = '23514', constraint = 'outreachCampaign.campaign.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "campaigns" where id = source_id) then
    select count(*) into n from "link_outreach_campaign" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachCampaign', 'outreach', 0, 'unbounded', n
        using errcode = '23514', constraint = 'outreachCampaign.outreach.bounds';
    end if;
  end if;
end $$;

create function "validate_outreach_campaign"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_outreach_campaign"(OLD.forward_id, 'forward');
    perform "check_outreach_campaign"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_outreach_campaign"(NEW.forward_id, 'forward');
    perform "check_outreach_campaign"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_outreach_campaign" after insert or update or delete on "link_outreach_campaign" deferrable initially deferred for each row execute function "validate_outreach_campaign"();

create function "lock_outreach_campaign"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:outreachCampaign', 0));
  return null;
end $$;

create trigger "lock_outreach_campaign" before insert or update or delete on "link_outreach_campaign" for each statement execute function "lock_outreach_campaign"();

create function "check_outreach_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "outreaches" where id = source_id) then
    select count(*) into n from "link_outreach_contact" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'outreachContact.contact.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_outreach_contact" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachContact', 'outreach', 0, 'unbounded', n
        using errcode = '23514', constraint = 'outreachContact.outreach.bounds';
    end if;
  end if;
end $$;

create function "validate_outreach_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_outreach_contact"(OLD.forward_id, 'forward');
    perform "check_outreach_contact"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_outreach_contact"(NEW.forward_id, 'forward');
    perform "check_outreach_contact"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_outreach_contact" after insert or update or delete on "link_outreach_contact" deferrable initially deferred for each row execute function "validate_outreach_contact"();

create function "lock_outreach_contact"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:outreachContact', 0));
  return null;
end $$;

create trigger "lock_outreach_contact" before insert or update or delete on "link_outreach_contact" for each statement execute function "lock_outreach_contact"();

create function "require_outreach_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_outreach_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_outreach_contact_forward" after insert on "outreaches" deferrable initially deferred for each row execute function "require_outreach_contact_forward"();

create function "check_outreach_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "outreaches" where id = source_id) then
    select count(*) into n from "link_outreach_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'outreachOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_outreach_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachOwner', 'outreach', 0, 'unbounded', n
        using errcode = '23514', constraint = 'outreachOwner.outreach.bounds';
    end if;
  end if;
end $$;

create function "validate_outreach_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_outreach_owner"(OLD.forward_id, 'forward');
    perform "check_outreach_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_outreach_owner"(NEW.forward_id, 'forward');
    perform "check_outreach_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_outreach_owner" after insert or update or delete on "link_outreach_owner" deferrable initially deferred for each row execute function "validate_outreach_owner"();

create function "lock_outreach_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:outreachOwner', 0));
  return null;
end $$;

create trigger "lock_outreach_owner" before insert or update or delete on "link_outreach_owner" for each statement execute function "lock_outreach_owner"();

create function "check_issue_pull_requests"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "issues" where id = source_id) then
    select count(*) into n from "link_issue_pull_requests" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issuePullRequests', 'pullRequests', 0, 'unbounded', n
        using errcode = '23514', constraint = 'issuePullRequests.pullRequests.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "pull_requests" where id = source_id) then
    select count(*) into n from "link_issue_pull_requests" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issuePullRequests', 'issues', 0, 'unbounded', n
        using errcode = '23514', constraint = 'issuePullRequests.issues.bounds';
    end if;
  end if;
end $$;

create function "validate_issue_pull_requests"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_issue_pull_requests"(OLD.forward_id, 'forward');
    perform "check_issue_pull_requests"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_issue_pull_requests"(NEW.forward_id, 'forward');
    perform "check_issue_pull_requests"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_issue_pull_requests" after insert or update or delete on "link_issue_pull_requests" deferrable initially deferred for each row execute function "validate_issue_pull_requests"();

create function "lock_issue_pull_requests"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:issuePullRequests', 0));
  return null;
end $$;

create trigger "lock_issue_pull_requests" before insert or update or delete on "link_issue_pull_requests" for each statement execute function "lock_issue_pull_requests"();

create function "check_issue_project"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "issues" where id = source_id) then
    select count(*) into n from "link_issue_project" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issueProject', 'project', 0, '1', n
        using errcode = '23514', constraint = 'issueProject.project.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "projects" where id = source_id) then
    select count(*) into n from "link_issue_project" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issueProject', 'issues', 0, 'unbounded', n
        using errcode = '23514', constraint = 'issueProject.issues.bounds';
    end if;
  end if;
end $$;

create function "validate_issue_project"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_issue_project"(OLD.forward_id, 'forward');
    perform "check_issue_project"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_issue_project"(NEW.forward_id, 'forward');
    perform "check_issue_project"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_issue_project" after insert or update or delete on "link_issue_project" deferrable initially deferred for each row execute function "validate_issue_project"();

create function "lock_issue_project"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:issueProject', 0));
  return null;
end $$;

create trigger "lock_issue_project" before insert or update or delete on "link_issue_project" for each statement execute function "lock_issue_project"();

create function "check_issue_assignee"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "issues" where id = source_id) then
    select count(*) into n from "link_issue_assignee" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issueAssignee', 'assignee', 0, '1', n
        using errcode = '23514', constraint = 'issueAssignee.assignee.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_issue_assignee" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'issueAssignee', 'issuesByAssignee', 0, 'unbounded', n
        using errcode = '23514', constraint = 'issueAssignee.issuesByAssignee.bounds';
    end if;
  end if;
end $$;

create function "validate_issue_assignee"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_issue_assignee"(OLD.forward_id, 'forward');
    perform "check_issue_assignee"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_issue_assignee"(NEW.forward_id, 'forward');
    perform "check_issue_assignee"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_issue_assignee" after insert or update or delete on "link_issue_assignee" deferrable initially deferred for each row execute function "validate_issue_assignee"();

create function "lock_issue_assignee"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:issueAssignee', 0));
  return null;
end $$;

create trigger "lock_issue_assignee" before insert or update or delete on "link_issue_assignee" for each statement execute function "lock_issue_assignee"();

create function "check_project_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "projects" where id = source_id) then
    select count(*) into n from "link_project_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'projectOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'projectOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_project_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'projectOwner', 'projects', 0, 'unbounded', n
        using errcode = '23514', constraint = 'projectOwner.projects.bounds';
    end if;
  end if;
end $$;

create function "validate_project_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_project_owner"(OLD.forward_id, 'forward');
    perform "check_project_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_project_owner"(NEW.forward_id, 'forward');
    perform "check_project_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_project_owner" after insert or update or delete on "link_project_owner" deferrable initially deferred for each row execute function "validate_project_owner"();

create function "lock_project_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:projectOwner', 0));
  return null;
end $$;

create trigger "lock_project_owner" before insert or update or delete on "link_project_owner" for each statement execute function "lock_project_owner"();

create function "check_pull_request_repository"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "pull_requests" where id = source_id) then
    select count(*) into n from "link_pull_request_repository" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'pullRequestRepository', 'repository', 1, '1', n
        using errcode = '23514', constraint = 'pullRequestRepository.repository.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "repositories" where id = source_id) then
    select count(*) into n from "link_pull_request_repository" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'pullRequestRepository', 'pullRequests', 0, 'unbounded', n
        using errcode = '23514', constraint = 'pullRequestRepository.pullRequests.bounds';
    end if;
  end if;
end $$;

create function "validate_pull_request_repository"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_pull_request_repository"(OLD.forward_id, 'forward');
    perform "check_pull_request_repository"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_pull_request_repository"(NEW.forward_id, 'forward');
    perform "check_pull_request_repository"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_pull_request_repository" after insert or update or delete on "link_pull_request_repository" deferrable initially deferred for each row execute function "validate_pull_request_repository"();

create function "lock_pull_request_repository"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:pullRequestRepository', 0));
  return null;
end $$;

create trigger "lock_pull_request_repository" before insert or update or delete on "link_pull_request_repository" for each statement execute function "lock_pull_request_repository"();

create function "require_pull_request_repository_forward"() returns trigger language plpgsql as $$
begin
  perform "check_pull_request_repository"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_pull_request_repository_forward" after insert on "pull_requests" deferrable initially deferred for each row execute function "require_pull_request_repository_forward"();

create function "check_repository_project"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "repositories" where id = source_id) then
    select count(*) into n from "link_repository_project" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'repositoryProject', 'project', 0, '1', n
        using errcode = '23514', constraint = 'repositoryProject.project.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "projects" where id = source_id) then
    select count(*) into n from "link_repository_project" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'repositoryProject', 'repositories', 0, 'unbounded', n
        using errcode = '23514', constraint = 'repositoryProject.repositories.bounds';
    end if;
  end if;
end $$;

create function "validate_repository_project"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_repository_project"(OLD.forward_id, 'forward');
    perform "check_repository_project"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_repository_project"(NEW.forward_id, 'forward');
    perform "check_repository_project"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_repository_project" after insert or update or delete on "link_repository_project" deferrable initially deferred for each row execute function "validate_repository_project"();

create function "lock_repository_project"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:repositoryProject', 0));
  return null;
end $$;

create trigger "lock_repository_project" before insert or update or delete on "link_repository_project" for each statement execute function "lock_repository_project"();

create function "check_repository_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "repositories" where id = source_id) then
    select count(*) into n from "link_repository_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'repositoryOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'repositoryOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_repository_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'repositoryOwner', 'repositories', 0, 'unbounded', n
        using errcode = '23514', constraint = 'repositoryOwner.repositories.bounds';
    end if;
  end if;
end $$;

create function "validate_repository_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_repository_owner"(OLD.forward_id, 'forward');
    perform "check_repository_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_repository_owner"(NEW.forward_id, 'forward');
    perform "check_repository_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_repository_owner" after insert or update or delete on "link_repository_owner" deferrable initially deferred for each row execute function "validate_repository_owner"();

create function "lock_repository_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:repositoryOwner', 0));
  return null;
end $$;

create trigger "lock_repository_owner" before insert or update or delete on "link_repository_owner" for each statement execute function "lock_repository_owner"();

create function "check_application_job"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "applications" where id = source_id) then
    select count(*) into n from "link_application_job" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationJob', 'job', 1, '1', n
        using errcode = '23514', constraint = 'applicationJob.job.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "job_postings" where id = source_id) then
    select count(*) into n from "link_application_job" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationJob', 'applications', 0, 'unbounded', n
        using errcode = '23514', constraint = 'applicationJob.applications.bounds';
    end if;
  end if;
end $$;

create function "validate_application_job"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_application_job"(OLD.forward_id, 'forward');
    perform "check_application_job"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_application_job"(NEW.forward_id, 'forward');
    perform "check_application_job"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_application_job" after insert or update or delete on "link_application_job" deferrable initially deferred for each row execute function "validate_application_job"();

create function "lock_application_job"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:applicationJob', 0));
  return null;
end $$;

create trigger "lock_application_job" before insert or update or delete on "link_application_job" for each statement execute function "lock_application_job"();

create function "require_application_job_forward"() returns trigger language plpgsql as $$
begin
  perform "check_application_job"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_application_job_forward" after insert on "applications" deferrable initially deferred for each row execute function "require_application_job_forward"();

create function "check_application_candidate"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "applications" where id = source_id) then
    select count(*) into n from "link_application_candidate" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationCandidate', 'candidate', 1, '1', n
        using errcode = '23514', constraint = 'applicationCandidate.candidate.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "candidates" where id = source_id) then
    select count(*) into n from "link_application_candidate" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationCandidate', 'applications', 0, 'unbounded', n
        using errcode = '23514', constraint = 'applicationCandidate.applications.bounds';
    end if;
  end if;
end $$;

create function "validate_application_candidate"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_application_candidate"(OLD.forward_id, 'forward');
    perform "check_application_candidate"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_application_candidate"(NEW.forward_id, 'forward');
    perform "check_application_candidate"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_application_candidate" after insert or update or delete on "link_application_candidate" deferrable initially deferred for each row execute function "validate_application_candidate"();

create function "lock_application_candidate"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:applicationCandidate', 0));
  return null;
end $$;

create trigger "lock_application_candidate" before insert or update or delete on "link_application_candidate" for each statement execute function "lock_application_candidate"();

create function "require_application_candidate_forward"() returns trigger language plpgsql as $$
begin
  perform "check_application_candidate"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_application_candidate_forward" after insert on "applications" deferrable initially deferred for each row execute function "require_application_candidate_forward"();

create function "check_job_posting_hiring_manager"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "job_postings" where id = source_id) then
    select count(*) into n from "link_job_posting_hiring_manager" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'jobPostingHiringManager', 'hiringManager', 0, '1', n
        using errcode = '23514', constraint = 'jobPostingHiringManager.hiringManager.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_job_posting_hiring_manager" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'jobPostingHiringManager', 'jobPostings', 0, 'unbounded', n
        using errcode = '23514', constraint = 'jobPostingHiringManager.jobPostings.bounds';
    end if;
  end if;
end $$;

create function "validate_job_posting_hiring_manager"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_job_posting_hiring_manager"(OLD.forward_id, 'forward');
    perform "check_job_posting_hiring_manager"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_job_posting_hiring_manager"(NEW.forward_id, 'forward');
    perform "check_job_posting_hiring_manager"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_job_posting_hiring_manager" after insert or update or delete on "link_job_posting_hiring_manager" deferrable initially deferred for each row execute function "validate_job_posting_hiring_manager"();

create function "lock_job_posting_hiring_manager"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:jobPostingHiringManager', 0));
  return null;
end $$;

create trigger "lock_job_posting_hiring_manager" before insert or update or delete on "link_job_posting_hiring_manager" for each statement execute function "lock_job_posting_hiring_manager"();

create function "check_reply_ticket"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "replies" where id = source_id) then
    select count(*) into n from "link_reply_ticket" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'replyTicket', 'ticket', 1, '1', n
        using errcode = '23514', constraint = 'replyTicket.ticket.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_reply_ticket" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'replyTicket', 'replies', 0, 'unbounded', n
        using errcode = '23514', constraint = 'replyTicket.replies.bounds';
    end if;
  end if;
end $$;

create function "validate_reply_ticket"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_reply_ticket"(OLD.forward_id, 'forward');
    perform "check_reply_ticket"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_reply_ticket"(NEW.forward_id, 'forward');
    perform "check_reply_ticket"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_reply_ticket" after insert or update or delete on "link_reply_ticket" deferrable initially deferred for each row execute function "validate_reply_ticket"();

create function "lock_reply_ticket"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:replyTicket', 0));
  return null;
end $$;

create trigger "lock_reply_ticket" before insert or update or delete on "link_reply_ticket" for each statement execute function "lock_reply_ticket"();

create function "require_reply_ticket_forward"() returns trigger language plpgsql as $$
begin
  perform "check_reply_ticket"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_reply_ticket_forward" after insert on "replies" deferrable initially deferred for each row execute function "require_reply_ticket_forward"();

create function "check_ticket_company"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_ticket_company" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketCompany', 'company', 0, '1', n
        using errcode = '23514', constraint = 'ticketCompany.company.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "companies" where id = source_id) then
    select count(*) into n from "link_ticket_company" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketCompany', 'tickets', 0, 'unbounded', n
        using errcode = '23514', constraint = 'ticketCompany.tickets.bounds';
    end if;
  end if;
end $$;

create function "validate_ticket_company"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_ticket_company"(OLD.forward_id, 'forward');
    perform "check_ticket_company"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_ticket_company"(NEW.forward_id, 'forward');
    perform "check_ticket_company"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_ticket_company" after insert or update or delete on "link_ticket_company" deferrable initially deferred for each row execute function "validate_ticket_company"();

create function "lock_ticket_company"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:ticketCompany', 0));
  return null;
end $$;

create trigger "lock_ticket_company" before insert or update or delete on "link_ticket_company" for each statement execute function "lock_ticket_company"();

create function "check_ticket_requester"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_ticket_requester" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketRequester', 'requester', 0, '1', n
        using errcode = '23514', constraint = 'ticketRequester.requester.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "contacts" where id = source_id) then
    select count(*) into n from "link_ticket_requester" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketRequester', 'tickets', 0, 'unbounded', n
        using errcode = '23514', constraint = 'ticketRequester.tickets.bounds';
    end if;
  end if;
end $$;

create function "validate_ticket_requester"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_ticket_requester"(OLD.forward_id, 'forward');
    perform "check_ticket_requester"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_ticket_requester"(NEW.forward_id, 'forward');
    perform "check_ticket_requester"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_ticket_requester" after insert or update or delete on "link_ticket_requester" deferrable initially deferred for each row execute function "validate_ticket_requester"();

create function "lock_ticket_requester"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:ticketRequester', 0));
  return null;
end $$;

create trigger "lock_ticket_requester" before insert or update or delete on "link_ticket_requester" for each statement execute function "lock_ticket_requester"();

create function "check_ticket_owner"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_ticket_owner" where "forward_id" = source_id;
    if n < 0 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketOwner', 'owner', 0, '1', n
        using errcode = '23514', constraint = 'ticketOwner.owner.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "users" where id = source_id) then
    select count(*) into n from "link_ticket_owner" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketOwner', 'tickets', 0, 'unbounded', n
        using errcode = '23514', constraint = 'ticketOwner.tickets.bounds';
    end if;
  end if;
end $$;

create function "validate_ticket_owner"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_ticket_owner"(OLD.forward_id, 'forward');
    perform "check_ticket_owner"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_ticket_owner"(NEW.forward_id, 'forward');
    perform "check_ticket_owner"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_ticket_owner" after insert or update or delete on "link_ticket_owner" deferrable initially deferred for each row execute function "validate_ticket_owner"();

create function "lock_ticket_owner"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:ticketOwner', 0));
  return null;
end $$;

create trigger "lock_ticket_owner" before insert or update or delete on "link_ticket_owner" for each statement execute function "lock_ticket_owner"();

create function "check_ticket_issues"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_ticket_issues" where "forward_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketIssues', 'issues', 0, 'unbounded', n
        using errcode = '23514', constraint = 'ticketIssues.issues.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "issues" where id = source_id) then
    select count(*) into n from "link_ticket_issues" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'ticketIssues', 'tickets', 0, 'unbounded', n
        using errcode = '23514', constraint = 'ticketIssues.tickets.bounds';
    end if;
  end if;
end $$;

create function "validate_ticket_issues"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_ticket_issues"(OLD.forward_id, 'forward');
    perform "check_ticket_issues"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_ticket_issues"(NEW.forward_id, 'forward');
    perform "check_ticket_issues"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_ticket_issues" after insert or update or delete on "link_ticket_issues" deferrable initially deferred for each row execute function "validate_ticket_issues"();

create function "lock_ticket_issues"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:ticketIssues', 0));
  return null;
end $$;

create trigger "lock_ticket_issues" before insert or update or delete on "link_ticket_issues" for each statement execute function "lock_ticket_issues"();

create function "check_escalation_ticket"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "escalations" where id = source_id) then
    select count(*) into n from "link_escalation_ticket" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'escalationTicket', 'ticket', 1, '1', n
        using errcode = '23514', constraint = 'escalationTicket.ticket.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "tickets" where id = source_id) then
    select count(*) into n from "link_escalation_ticket" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'escalationTicket', 'escalations', 0, 'unbounded', n
        using errcode = '23514', constraint = 'escalationTicket.escalations.bounds';
    end if;
  end if;
end $$;

create function "validate_escalation_ticket"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_escalation_ticket"(OLD.forward_id, 'forward');
    perform "check_escalation_ticket"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_escalation_ticket"(NEW.forward_id, 'forward');
    perform "check_escalation_ticket"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_escalation_ticket" after insert or update or delete on "link_escalation_ticket" deferrable initially deferred for each row execute function "validate_escalation_ticket"();

create function "lock_escalation_ticket"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:escalationTicket', 0));
  return null;
end $$;

create trigger "lock_escalation_ticket" before insert or update or delete on "link_escalation_ticket" for each statement execute function "lock_escalation_ticket"();

create function "require_escalation_ticket_forward"() returns trigger language plpgsql as $$
begin
  perform "check_escalation_ticket"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_escalation_ticket_forward" after insert on "escalations" deferrable initially deferred for each row execute function "require_escalation_ticket_forward"();

create function "check_escalation_issue"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "escalations" where id = source_id) then
    select count(*) into n from "link_escalation_issue" where "forward_id" = source_id;
    if n < 1 or n > 1 then
      raise exception 'Link % traversal % requires %..% targets; found %', 'escalationIssue', 'issue', 1, '1', n
        using errcode = '23514', constraint = 'escalationIssue.issue.bounds';
    end if;
  end if;
  if side = 'reverse' and exists (select 1 from "issues" where id = source_id) then
    select count(*) into n from "link_escalation_issue" where "reverse_id" = source_id;
    if n < 0 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'escalationIssue', 'escalations', 0, 'unbounded', n
        using errcode = '23514', constraint = 'escalationIssue.escalations.bounds';
    end if;
  end if;
end $$;

create function "validate_escalation_issue"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_escalation_issue"(OLD.forward_id, 'forward');
    perform "check_escalation_issue"(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_escalation_issue"(NEW.forward_id, 'forward');
    perform "check_escalation_issue"(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_escalation_issue" after insert or update or delete on "link_escalation_issue" deferrable initially deferred for each row execute function "validate_escalation_issue"();

create function "lock_escalation_issue"() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('link:escalationIssue', 0));
  return null;
end $$;

create trigger "lock_escalation_issue" before insert or update or delete on "link_escalation_issue" for each statement execute function "lock_escalation_issue"();

create function "require_escalation_issue_forward"() returns trigger language plpgsql as $$
begin
  perform "check_escalation_issue"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_escalation_issue_forward" after insert on "escalations" deferrable initially deferred for each row execute function "require_escalation_issue_forward"();

create function "unique_application_candidate_job"() returns trigger language plpgsql as $$
begin
  if exists (select 1 from "applications" o join "link_application_candidate" e0 on e0."forward_id" = o.id join "link_application_job" e1 on e1."forward_id" = o.id where e0."reverse_id" is not null and e1."reverse_id" is not null group by e0."reverse_id", e1."reverse_id" having count(*) > 1) then
    raise exception 'Unique relationship rule % violated', 'application.candidateJob' using errcode = '23505', constraint = 'applications_candidate_job_unique';
  end if;
  return null;
end $$;

create function "lock_unique_application_candidate_job"() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(hashtextextended('unique:application:candidateJob', 0)); return null; end $$;

create trigger "lock_unique_application_candidate_job" before insert or update or delete on "applications" for each statement execute function "lock_unique_application_candidate_job"();

create constraint trigger "unique_application_candidate_job" after insert or update or delete on "applications" deferrable initially deferred for each row execute function "unique_application_candidate_job"();

create trigger "lock_unique_application_candidate_job" before insert or update or delete on "link_application_candidate" for each statement execute function "lock_unique_application_candidate_job"();

create constraint trigger "unique_application_candidate_job" after insert or update or delete on "link_application_candidate" deferrable initially deferred for each row execute function "unique_application_candidate_job"();

create trigger "lock_unique_application_candidate_job" before insert or update or delete on "link_application_job" for each statement execute function "lock_unique_application_candidate_job"();

create constraint trigger "unique_application_candidate_job" after insert or update or delete on "link_application_job" deferrable initially deferred for each row execute function "unique_application_candidate_job"();

create function "unique_escalation_ticket"() returns trigger language plpgsql as $$
begin
  if exists (select 1 from "escalations" o join "link_escalation_ticket" e0 on e0."forward_id" = o.id where e0."reverse_id" is not null group by e0."reverse_id" having count(*) > 1) then
    raise exception 'Unique relationship rule % violated', 'escalation.ticket' using errcode = '23505', constraint = 'escalations_ticket_unique';
  end if;
  return null;
end $$;

create function "lock_unique_escalation_ticket"() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(hashtextextended('unique:escalation:ticket', 0)); return null; end $$;

create trigger "lock_unique_escalation_ticket" before insert or update or delete on "escalations" for each statement execute function "lock_unique_escalation_ticket"();

create constraint trigger "unique_escalation_ticket" after insert or update or delete on "escalations" deferrable initially deferred for each row execute function "unique_escalation_ticket"();

create trigger "lock_unique_escalation_ticket" before insert or update or delete on "link_escalation_ticket" for each statement execute function "lock_unique_escalation_ticket"();

create constraint trigger "unique_escalation_ticket" after insert or update or delete on "link_escalation_ticket" deferrable initially deferred for each row execute function "unique_escalation_ticket"();

-- ===========================================================================
-- Cross-table constraints
-- ===========================================================================
-- Declared after all domain tables to support cyclic references.

alter table "objects"
  add constraint "objects_created_by_id_interface_actor_id_fkey"
  foreign key ("created_by_id") references "interface_actor" ("id")
  on delete restrict deferrable initially deferred;

alter table "objects"
  add constraint "objects_updated_by_id_interface_actor_id_fkey"
  foreign key ("updated_by_id") references "interface_actor" ("id")
  on delete restrict deferrable initially deferred;

alter table "link_contact_primary_company"
  add constraint "link_contact_primary_company_membership_fk"
  foreign key ("forward_id", "reverse_id")
  references "link_contact_companies" ("forward_id", "reverse_id") deferrable initially deferred;

-- ===========================================================================
-- Application infrastructure
-- ===========================================================================

-- Maps verified provider subjects to local identities. Credentials remain
-- provider-owned.
create table "identity_bindings" (
  "issuer" text not null,
  "subject" text not null,
  "identity_id" text not null,
  "created_at" timestamp with time zone not null default now(),
  primary key ("issuer", "subject"),
  foreign key ("identity_id") references "interface_identity" ("id") on delete cascade
);

-- Local asset payloads; business-facing file metadata lives on the asset
-- record.
create table "asset_blobs" (
  "asset_id" text not null,
  "bytes" bytea not null,
  primary key ("asset_id"),
  foreign key ("asset_id") references "assets" ("id") on delete cascade
);

-- Tracks which record fields retain an asset and prevents deletion while
-- referenced.
create table "asset_references" (
  "record_id" text not null,
  "field" text not null,
  "asset_id" text not null,
  primary key ("record_id", "field"),
  foreign key ("record_id") references "objects" ("id") on delete cascade,
  foreign key ("asset_id") references "assets" ("id") on delete restrict
);

create index "asset_references_asset_id_idx" on "asset_references" ("asset_id");

-- One row locked at commit to assign journal positions in commit order.
create table "event_journal_state" (
  "id" integer not null,
  "position" bigint not null default 0,
  primary key ("id")
);

-- Append-only business facts recorded atomically with the writes they
-- describe.
create table "event_journal" (
  "position" bigint not null,
  "id" text not null,
  "transaction_id" text not null,
  "type" text not null,
  "version" integer not null,
  -- Historical subject snapshots deliberately have no live foreign keys; they
  -- survive record deletion.
  "subjects" jsonb not null,
  "actor_id" text not null,
  "data" jsonb not null,
  "occurred_at" timestamp with time zone not null,
  "recorded_at" timestamp with time zone not null default clock_timestamp(),
  primary key ("position"),
  unique ("id")
);

create index "event_journal_type_position_idx" on "event_journal" ("type", "position");

create function "reject_event_journal_mutation"()
returns trigger
language plpgsql as $$
begin
  raise exception 'The event journal is append-only' using errcode = '55000';
end;
$$;

create trigger "event_journal_append_only"
  before update or delete on "event_journal"
  for each statement execute function "reject_event_journal_mutation"();

-- Rebuildable search projection. Live records remain authoritative for
-- identity and access.
create table "record_search" (
  "id" text not null,
  "title" text not null,
  "subtitle" text,
  "image" jsonb,
  "status" text,
  "document" tsvector not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create index "record_search_document_idx" on "record_search" using gin ("document");

-- Tracks the search projection definition so changes trigger an atomic
-- rebuild.
create table "search_index_state" (
  "id" integer not null,
  "definition" text not null,
  primary key ("id")
);

-- Development scenario receipts, separate from business records and system
-- bootstrap.
create table "seed_runs" (
  "name" text not null,
  "parameters" text not null,
  "completed_at" timestamp with time zone not null default now(),
  primary key ("name")
);
