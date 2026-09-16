-- Company OS: desired PostgreSQL schema
-- Generated from the model. Edit model or runtime storage source,
-- then run pnpm db:generate.
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
    'user',
    'serviceAccount',
    'anonymousActor',
    'asset',
    'note',
    'moduleSetting',
    'controller',
    'controllerInstance',
    'account',
    'contact',
    'activity',
    'affiliation',
    'lead',
    'opportunity',
    'lineItem',
    'campaign',
    'content',
    'campaignMember',
    'outreach',
    'project',
    'issue',
    'githubConnection',
    'githubRepository',
    'githubPullRequest',
    'githubIssue',
    'jobPosting',
    'candidate',
    'application',
    'ticket',
    'reply'
  ))
);

create index "objects_object_type_idx" on "objects" ("object_type");

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

-- Controller target membership (controllerTarget)
-- A record maintained by controllers.
create table "interface_controller_target" (
  "id" text not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Party membership (party)
-- An account or contact involved in your business.
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

-- Note (note)
-- Notes on conversations, decisions, or next steps.
create table "notes" (
  "id" text not null,
  "content" text not null,
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

-- Controller (controller)
-- A code-defined operation that continuously reconciles records toward a
-- desired state.
create table "controllers" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "module_id" text,
  "paused" boolean not null default false,
  "definition_id" text not null,
  "name" text not null,
  "description" text not null,
  "target_object_type" text not null,
  "scope" text not null,
  "watch" text[] not null,
  "schedule" jsonb,
  "min_interval" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "controllers_definition_unique" on "controllers" ("definition_id");

-- Controller instance (controllerInstance)
-- The current reconciliation state of one controller for one record, or its
-- whole collection.
create table "controller_instances" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "controller_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "record_id" text,
  "state" text not null default 'pending',
  "runs" integer not null default 0,
  "failures" integer not null default 0,
  "last_started_at" timestamp with time zone,
  "last_succeeded_at" timestamp with time zone,
  "requeue_at" timestamp with time zone,
  "last_error" text,
  "agent_session_id" text,
  "agent_session_url" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: CRM
-- ===========================================================================

-- Account (account)
-- A customer, prospect, or partner organization.
create table "accounts" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
  "name" text not null,
  "logo" jsonb,
  "domain" text,
  "website" text,
  "industry" text,
  -- Manual assessment of how closely this account matches your ideal
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
  -- An agent-maintained summary of this person's background and current
  -- relationship context, with sources where available.
  "summary" text,
  -- Manual assessment of your team’s relationship with this person, from 0
  -- (no established relationship) to 100 (strong, active relationship).
  "relationship_strength" integer,
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

-- Activity (activity)
-- A task, call, or meeting with a customer or prospect.
create table "activities" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
  "title" text not null,
  "kind" text not null default 'task',
  "status" text not null default 'planned',
  "due_at" timestamp with time zone,
  "outcome" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Affiliation (affiliation)
-- A person's role at an account. Separate affiliations can represent
-- different roles or periods.
create table "affiliations" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "contact_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "account_id" text,
  "job_title" text,
  "start_date" date,
  "end_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

alter table "affiliations" add constraint "affiliations_check_dates" check ("start_date" <= "end_date");

-- ===========================================================================
-- Domain objects: Sales
-- ===========================================================================

-- Lead (lead)
-- A sales inquiry to qualify for an account and contact. Identity details
-- live on the linked CRM records.
create table "leads" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "account_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "contact_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "opportunity_id" text,
  "name" text not null,
  "source" text not null default 'unknown',
  "status" text not null default 'new',
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Opportunity (opportunity)
-- A sales opportunity with its value, stage, and next steps.
create table "opportunities" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
  "name" text not null,
  "stage" text not null default 'discovery',
  -- Manual assessment of opportunity health, from 0 (at risk) to 100
  -- (strong), based on engagement, next steps, timing, and blockers.
  "health_score" integer,
  -- Expected or agreed opportunity value.
  "amount" jsonb,
  "expected_close_date" date,
  "next_step" text,
  "next_step_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Line item (lineItem)
-- A product or service included in a opportunity.
create table "line_items" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "opportunity_id" text,
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
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
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

alter table "campaigns" add constraint "campaigns_check_dates" check ("start_date" <= "end_date");

-- Content (content)
-- Track an article, post, or ad. Saving does not publish it.
create table "contents" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "campaign_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
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

-- Campaign member (campaignMember)
-- Track a contact's progress and next follow-up in a campaign.
create table "campaign_members" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "campaign_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "contact_id" text,
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
  -- Relationship reference; requiredness is checked at transaction commit.
  "campaign_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "contact_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
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
-- Domain objects: Product
-- ===========================================================================

-- Project (project)
-- Related work organized around a goal and target date.
create table "projects" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
  "name" text not null,
  "objective" text,
  "status" text not null default 'planned',
  "target_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Issue (issue)
-- A bug, request, or task to investigate and resolve.
create table "issues" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "project_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "assignee_id" text,
  "title" text not null,
  "description" text,
  "kind" text not null default 'task',
  "priority" text not null default 'normal',
  "due_date" date,
  "status" text not null default 'backlog',
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Domain objects: Engineering
-- ===========================================================================

-- GitHub connection (githubConnection)
-- A GitHub account selected for synchronization, with an optional GitHub App
-- installation.
create table "github_connections" (
  "id" text not null,
  "account_login" text not null,
  "installation_id" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "github_connections_installation_unique" on "github_connections" ("installation_id");

-- GitHub repository (githubRepository)
-- A GitHub repository connected to internal projects and its imported issues
-- and pull requests.
create table "github_repositories" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "connection_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "maintainer_id" text,
  "node_id" text not null,
  "full_name" text not null,
  "url" text not null,
  "description" text,
  "default_branch" text,
  "visibility" text not null,
  "archived" boolean not null default false,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "github_repositories_github_unique" on "github_repositories" ("node_id");

-- GitHub pull request (githubPullRequest)
-- Track a code change, its reviews, and checks. Merge it in GitHub.
create table "github_pull_requests" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "repository_id" text,
  "node_id" text not null,
  "body" text,
  "title" text not null,
  "number" integer not null,
  "url" text not null,
  "status" text not null default 'draft',
  "review" text not null default 'pending',
  "checks" text not null default 'pending',
  "head_commit" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "github_pull_requests_github_unique" on "github_pull_requests" ("node_id");

-- GitHub issue (githubIssue)
-- An issue tracked in GitHub, separate from internal product planning.
create table "github_issues" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "repository_id" text,
  "node_id" text not null,
  "number" integer not null,
  "title" text not null,
  "body" text,
  "url" text not null,
  "state" text not null default 'open',
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "github_issues_github_unique" on "github_issues" ("node_id");

-- ===========================================================================
-- Domain objects: Hiring
-- ===========================================================================

-- Job posting (jobPosting)
-- A role your account is hiring for.
create table "job_postings" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "hiring_manager_id" text,
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
  -- Relationship reference; requiredness is checked at transaction commit.
  "job_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "candidate_id" text,
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
-- Domain objects: Service
-- ===========================================================================

-- Ticket (ticket)
-- A customer request or problem to investigate and resolve.
create table "tickets" (
  "id" text not null,
  -- Relationship reference; requiredness is checked at transaction commit.
  "account_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "requester_id" text,
  -- Relationship reference; requiredness is checked at transaction commit.
  "owner_id" text,
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
  -- Relationship reference; requiredness is checked at transaction commit.
  "ticket_id" text,
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
-- Relationships
-- ===========================================================================
-- Association pairs and cardinality constraints.

create view "link_controller_module" as select "id" as forward_id, "module_id" as reverse_id from "controllers" where "module_id" is not null;

create index "controller_module_target_idx" on "controllers" ("module_id");

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

create view "link_controller_instance_controller" as select "id" as forward_id, "controller_id" as reverse_id from "controller_instances" where "controller_id" is not null;

create index "controller_instance_controller_target_idx" on "controller_instances" ("controller_id");

create view "link_controller_instance_record" as select "id" as forward_id, "record_id" as reverse_id from "controller_instances" where "record_id" is not null;

create index "controller_instance_record_target_idx" on "controller_instances" ("record_id");

create view "link_account_owner" as select "id" as forward_id, "owner_id" as reverse_id from "accounts" where "owner_id" is not null;

create index "account_owner_target_idx" on "accounts" ("owner_id");

create view "link_affiliation_contact" as select "id" as forward_id, "contact_id" as reverse_id from "affiliations" where "contact_id" is not null;

create index "affiliation_contact_target_idx" on "affiliations" ("contact_id");

create view "link_affiliation_account" as select "id" as forward_id, "account_id" as reverse_id from "affiliations" where "account_id" is not null;

create index "affiliation_account_target_idx" on "affiliations" ("account_id");

-- Activity Account (activityAccounts)
create table "link_activity_accounts" (
  -- References activities.id.
  "forward_id" text not null,
  -- References accounts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "accounts" ("id") on delete cascade
);

create index "link_activity_accounts_forward_id_idx" on "link_activity_accounts" ("forward_id");
create index "link_activity_accounts_reverse_id_idx" on "link_activity_accounts" ("reverse_id");

-- Activity Contact (activityContacts)
create table "link_activity_contacts" (
  -- References activities.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create index "link_activity_contacts_forward_id_idx" on "link_activity_contacts" ("forward_id");
create index "link_activity_contacts_reverse_id_idx" on "link_activity_contacts" ("reverse_id");

create view "link_activity_owner" as select "id" as forward_id, "owner_id" as reverse_id from "activities" where "owner_id" is not null;

create index "activity_owner_target_idx" on "activities" ("owner_id");

create view "link_opportunity_line_items" as select "opportunity_id" as forward_id, "id" as reverse_id from "line_items" where "opportunity_id" is not null;

create index "opportunity_line_items_target_idx" on "line_items" ("opportunity_id");

-- Opportunity accounts (opportunityAccounts)
create table "link_opportunity_accounts" (
  -- References opportunities.id.
  "forward_id" text not null,
  -- References accounts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "opportunities" ("id") on delete cascade,
  foreign key ("reverse_id") references "accounts" ("id") on delete cascade
);

create index "link_opportunity_accounts_forward_id_idx" on "link_opportunity_accounts" ("forward_id");
create index "link_opportunity_accounts_reverse_id_idx" on "link_opportunity_accounts" ("reverse_id");

-- Opportunity contacts (opportunityContacts)
create table "link_opportunity_contacts" (
  -- References opportunities.id.
  "forward_id" text not null,
  -- References contacts.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "opportunities" ("id") on delete cascade,
  foreign key ("reverse_id") references "contacts" ("id") on delete cascade
);

create index "link_opportunity_contacts_forward_id_idx" on "link_opportunity_contacts" ("forward_id");
create index "link_opportunity_contacts_reverse_id_idx" on "link_opportunity_contacts" ("reverse_id");

-- Activity Opportunity (activityOpportunities)
create table "link_activity_opportunities" (
  -- References activities.id.
  "forward_id" text not null,
  -- References opportunities.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "activities" ("id") on delete cascade,
  foreign key ("reverse_id") references "opportunities" ("id") on delete cascade
);

create index "link_activity_opportunities_forward_id_idx" on "link_activity_opportunities" ("forward_id");
create index "link_activity_opportunities_reverse_id_idx" on "link_activity_opportunities" ("reverse_id");

create view "link_opportunity_owner" as select "id" as forward_id, "owner_id" as reverse_id from "opportunities" where "owner_id" is not null;

create index "opportunity_owner_target_idx" on "opportunities" ("owner_id");

create view "link_lead_account" as select "id" as forward_id, "account_id" as reverse_id from "leads" where "account_id" is not null;

create index "lead_account_target_idx" on "leads" ("account_id");

create view "link_lead_owner" as select "id" as forward_id, "owner_id" as reverse_id from "leads" where "owner_id" is not null;

create index "lead_owner_target_idx" on "leads" ("owner_id");

create view "link_lead_contact" as select "id" as forward_id, "contact_id" as reverse_id from "leads" where "contact_id" is not null;

create index "lead_contact_target_idx" on "leads" ("contact_id");

create view "link_lead_opportunity" as select "id" as forward_id, "opportunity_id" as reverse_id from "leads" where "opportunity_id" is not null;

create view "link_campaign_owner" as select "id" as forward_id, "owner_id" as reverse_id from "campaigns" where "owner_id" is not null;

create index "campaign_owner_target_idx" on "campaigns" ("owner_id");

create view "link_content_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "contents" where "campaign_id" is not null;

create index "content_campaign_target_idx" on "contents" ("campaign_id");

create view "link_content_owner" as select "id" as forward_id, "owner_id" as reverse_id from "contents" where "owner_id" is not null;

create index "content_owner_target_idx" on "contents" ("owner_id");

create view "link_campaign_member_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "campaign_members" where "campaign_id" is not null;

create index "campaign_member_campaign_target_idx" on "campaign_members" ("campaign_id");

create view "link_campaign_member_contact" as select "id" as forward_id, "contact_id" as reverse_id from "campaign_members" where "contact_id" is not null;

create index "campaign_member_contact_target_idx" on "campaign_members" ("contact_id");

create view "link_outreach_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "outreaches" where "campaign_id" is not null;

create index "outreach_campaign_target_idx" on "outreaches" ("campaign_id");

create view "link_outreach_contact" as select "id" as forward_id, "contact_id" as reverse_id from "outreaches" where "contact_id" is not null;

create index "outreach_contact_target_idx" on "outreaches" ("contact_id");

create view "link_outreach_owner" as select "id" as forward_id, "owner_id" as reverse_id from "outreaches" where "owner_id" is not null;

create index "outreach_owner_target_idx" on "outreaches" ("owner_id");

create view "link_project_owner" as select "id" as forward_id, "owner_id" as reverse_id from "projects" where "owner_id" is not null;

create index "project_owner_target_idx" on "projects" ("owner_id");

create view "link_issue_project" as select "id" as forward_id, "project_id" as reverse_id from "issues" where "project_id" is not null;

create index "issue_project_target_idx" on "issues" ("project_id");

create view "link_issue_assignee" as select "id" as forward_id, "assignee_id" as reverse_id from "issues" where "assignee_id" is not null;

create index "issue_assignee_target_idx" on "issues" ("assignee_id");

create view "link_github_repository_connection" as select "id" as forward_id, "connection_id" as reverse_id from "github_repositories" where "connection_id" is not null;

create index "github_repository_connection_target_idx" on "github_repositories" ("connection_id");

-- GitHub repository projects (githubRepositoryProjects)
create table "link_github_repository_projects" (
  -- References github_repositories.id.
  "forward_id" text not null,
  -- References projects.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "github_repositories" ("id") on delete cascade,
  foreign key ("reverse_id") references "projects" ("id") on delete cascade
);

create index "link_github_repository_projects_forward_id_idx" on "link_github_repository_projects" ("forward_id");
create index "link_github_repository_projects_reverse_id_idx" on "link_github_repository_projects" ("reverse_id");

create view "link_github_repository_maintainer" as select "id" as forward_id, "maintainer_id" as reverse_id from "github_repositories" where "maintainer_id" is not null;

create index "github_repository_maintainer_target_idx" on "github_repositories" ("maintainer_id");

create view "link_github_issue_repository" as select "id" as forward_id, "repository_id" as reverse_id from "github_issues" where "repository_id" is not null;

create index "github_issue_repository_target_idx" on "github_issues" ("repository_id");

create view "link_github_pull_request_repository" as select "id" as forward_id, "repository_id" as reverse_id from "github_pull_requests" where "repository_id" is not null;

create index "github_pull_request_repository_target_idx" on "github_pull_requests" ("repository_id");

-- GitHub issue pull requests (githubIssuePullRequests)
create table "link_github_issue_pull_requests" (
  -- References github_issues.id.
  "forward_id" text not null,
  -- References github_pull_requests.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "github_issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "github_pull_requests" ("id") on delete cascade
);

create index "link_github_issue_pull_requests_forward_id_idx" on "link_github_issue_pull_requests" ("forward_id");
create index "link_github_issue_pull_requests_reverse_id_idx" on "link_github_issue_pull_requests" ("reverse_id");

-- Product issue GitHub issues (issueGithubIssues)
create table "link_issue_github_issues" (
  -- References issues.id.
  "forward_id" text not null,
  -- References github_issues.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "github_issues" ("id") on delete cascade
);

create index "link_issue_github_issues_forward_id_idx" on "link_issue_github_issues" ("forward_id");
create index "link_issue_github_issues_reverse_id_idx" on "link_issue_github_issues" ("reverse_id");

-- Product issue GitHub pull requests (issueGithubPullRequests)
create table "link_issue_github_pull_requests" (
  -- References issues.id.
  "forward_id" text not null,
  -- References github_pull_requests.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "issues" ("id") on delete cascade,
  foreign key ("reverse_id") references "github_pull_requests" ("id") on delete cascade
);

create index "link_issue_github_pull_requests_forward_id_idx" on "link_issue_github_pull_requests" ("forward_id");
create index "link_issue_github_pull_requests_reverse_id_idx" on "link_issue_github_pull_requests" ("reverse_id");

create view "link_application_job" as select "id" as forward_id, "job_id" as reverse_id from "applications" where "job_id" is not null;

create index "application_job_target_idx" on "applications" ("job_id");

create view "link_application_candidate" as select "id" as forward_id, "candidate_id" as reverse_id from "applications" where "candidate_id" is not null;

create index "application_candidate_target_idx" on "applications" ("candidate_id");

create view "link_job_posting_hiring_manager" as select "id" as forward_id, "hiring_manager_id" as reverse_id from "job_postings" where "hiring_manager_id" is not null;

create index "job_posting_hiring_manager_target_idx" on "job_postings" ("hiring_manager_id");

create view "link_reply_ticket" as select "id" as forward_id, "ticket_id" as reverse_id from "replies" where "ticket_id" is not null;

create index "reply_ticket_target_idx" on "replies" ("ticket_id");

create view "link_ticket_account" as select "id" as forward_id, "account_id" as reverse_id from "tickets" where "account_id" is not null;

create index "ticket_account_target_idx" on "tickets" ("account_id");

create view "link_ticket_requester" as select "id" as forward_id, "requester_id" as reverse_id from "tickets" where "requester_id" is not null;

create index "ticket_requester_target_idx" on "tickets" ("requester_id");

create view "link_ticket_owner" as select "id" as forward_id, "owner_id" as reverse_id from "tickets" where "owner_id" is not null;

create index "ticket_owner_target_idx" on "tickets" ("owner_id");

-- Customer reported issues (ticketIssues)
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

-- Opportunity product needs (opportunityIssues)
create table "link_opportunity_issues" (
  -- References opportunities.id.
  "forward_id" text not null,
  -- References issues.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "opportunities" ("id") on delete cascade,
  foreign key ("reverse_id") references "issues" ("id") on delete cascade
);

create index "link_opportunity_issues_forward_id_idx" on "link_opportunity_issues" ("forward_id");
create index "link_opportunity_issues_reverse_id_idx" on "link_opportunity_issues" ("reverse_id");

create function "check_controller_module"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "controllers" where id = source_id) then
    select count(*) into n from "link_controller_module" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'controllerModule', 'module', 1, '1', n
        using errcode = '23514', constraint = 'controllerModule.module.bounds';
    end if;
  end if;
end $$;

create function "validate_controller_module"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_controller_module"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_controller_module"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_controller_module" after insert or delete on "controllers" deferrable initially deferred for each row execute function "validate_controller_module"();

create constraint trigger "validate_controller_module_update" after update on "controllers" deferrable initially deferred for each row when (OLD."module_id" is distinct from NEW."module_id") execute function "validate_controller_module"();

create function "lock_controller_module"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_controller_module" before insert or delete on "controllers" for each row execute function "lock_controller_module"();

create trigger "lock_controller_module_update" before update on "controllers" for each row when (OLD."module_id" is distinct from NEW."module_id") execute function "lock_controller_module"();

create function "require_controller_module_forward"() returns trigger language plpgsql as $$
begin
  perform "check_controller_module"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_controller_module_forward" after insert on "controllers" deferrable initially deferred for each row execute function "require_controller_module_forward"();

create function "check_controller_instance_controller"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "controller_instances" where id = source_id) then
    select count(*) into n from "link_controller_instance_controller" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'controllerInstanceController', 'controller', 1, '1', n
        using errcode = '23514', constraint = 'controllerInstanceController.controller.bounds';
    end if;
  end if;
end $$;

create function "validate_controller_instance_controller"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_controller_instance_controller"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_controller_instance_controller"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_controller_instance_controller" after insert or delete on "controller_instances" deferrable initially deferred for each row execute function "validate_controller_instance_controller"();

create constraint trigger "validate_controller_instance_controller_update" after update on "controller_instances" deferrable initially deferred for each row when (OLD."controller_id" is distinct from NEW."controller_id") execute function "validate_controller_instance_controller"();

create function "lock_controller_instance_controller"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_controller_instance_controller" before insert or delete on "controller_instances" for each row execute function "lock_controller_instance_controller"();

create trigger "lock_controller_instance_controller_update" before update on "controller_instances" for each row when (OLD."controller_id" is distinct from NEW."controller_id") execute function "lock_controller_instance_controller"();

create function "require_controller_instance_controller_forward"() returns trigger language plpgsql as $$
begin
  perform "check_controller_instance_controller"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_controller_instance_controller_forward" after insert on "controller_instances" deferrable initially deferred for each row execute function "require_controller_instance_controller_forward"();

create function "check_affiliation_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "affiliations" where id = source_id) then
    select count(*) into n from "link_affiliation_contact" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'affiliationContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'affiliationContact.contact.bounds';
    end if;
  end if;
end $$;

create function "validate_affiliation_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_affiliation_contact"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_affiliation_contact"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_affiliation_contact" after insert or delete on "affiliations" deferrable initially deferred for each row execute function "validate_affiliation_contact"();

create constraint trigger "validate_affiliation_contact_update" after update on "affiliations" deferrable initially deferred for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "validate_affiliation_contact"();

create function "lock_affiliation_contact"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_affiliation_contact" before insert or delete on "affiliations" for each row execute function "lock_affiliation_contact"();

create trigger "lock_affiliation_contact_update" before update on "affiliations" for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "lock_affiliation_contact"();

create function "require_affiliation_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_affiliation_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_affiliation_contact_forward" after insert on "affiliations" deferrable initially deferred for each row execute function "require_affiliation_contact_forward"();

create function "check_affiliation_account"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "affiliations" where id = source_id) then
    select count(*) into n from "link_affiliation_account" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'affiliationAccount', 'account', 1, '1', n
        using errcode = '23514', constraint = 'affiliationAccount.account.bounds';
    end if;
  end if;
end $$;

create function "validate_affiliation_account"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_affiliation_account"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_affiliation_account"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_affiliation_account" after insert or delete on "affiliations" deferrable initially deferred for each row execute function "validate_affiliation_account"();

create constraint trigger "validate_affiliation_account_update" after update on "affiliations" deferrable initially deferred for each row when (OLD."account_id" is distinct from NEW."account_id") execute function "validate_affiliation_account"();

create function "lock_affiliation_account"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_affiliation_account" before insert or delete on "affiliations" for each row execute function "lock_affiliation_account"();

create trigger "lock_affiliation_account_update" before update on "affiliations" for each row when (OLD."account_id" is distinct from NEW."account_id") execute function "lock_affiliation_account"();

create function "require_affiliation_account_forward"() returns trigger language plpgsql as $$
begin
  perform "check_affiliation_account"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_affiliation_account_forward" after insert on "affiliations" deferrable initially deferred for each row execute function "require_affiliation_account_forward"();

create function "check_opportunity_line_items"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'reverse' and exists (select 1 from "line_items" where id = source_id) then
    select count(*) into n from "link_opportunity_line_items" where "reverse_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'opportunityLineItems', 'opportunity', 1, '1', n
        using errcode = '23514', constraint = 'opportunityLineItems.opportunity.bounds';
    end if;
  end if;
end $$;

create function "validate_opportunity_line_items"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_opportunity_line_items"(OLD.id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_opportunity_line_items"(NEW.id, 'reverse');
  end if;
  return null;
end $$;

create constraint trigger "validate_opportunity_line_items" after insert or delete on "line_items" deferrable initially deferred for each row execute function "validate_opportunity_line_items"();

create constraint trigger "validate_opportunity_line_items_update" after update on "line_items" deferrable initially deferred for each row when (OLD."opportunity_id" is distinct from NEW."opportunity_id") execute function "validate_opportunity_line_items"();

create function "lock_opportunity_line_items"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_opportunity_line_items" before insert or delete on "line_items" for each row execute function "lock_opportunity_line_items"();

create trigger "lock_opportunity_line_items_update" before update on "line_items" for each row when (OLD."opportunity_id" is distinct from NEW."opportunity_id") execute function "lock_opportunity_line_items"();

create function "require_opportunity_line_items_reverse"() returns trigger language plpgsql as $$
begin
  perform "check_opportunity_line_items"(NEW.id, 'reverse');
  return null;
end $$;

create constraint trigger "require_opportunity_line_items_reverse" after insert on "line_items" deferrable initially deferred for each row execute function "require_opportunity_line_items_reverse"();

create function "check_lead_account"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "leads" where id = source_id) then
    select count(*) into n from "link_lead_account" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadAccount', 'account', 1, '1', n
        using errcode = '23514', constraint = 'leadAccount.account.bounds';
    end if;
  end if;
end $$;

create function "validate_lead_account"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_lead_account"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_lead_account"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_lead_account" after insert or delete on "leads" deferrable initially deferred for each row execute function "validate_lead_account"();

create constraint trigger "validate_lead_account_update" after update on "leads" deferrable initially deferred for each row when (OLD."account_id" is distinct from NEW."account_id") execute function "validate_lead_account"();

create function "lock_lead_account"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_lead_account" before insert or delete on "leads" for each row execute function "lock_lead_account"();

create trigger "lock_lead_account_update" before update on "leads" for each row when (OLD."account_id" is distinct from NEW."account_id") execute function "lock_lead_account"();

create function "require_lead_account_forward"() returns trigger language plpgsql as $$
begin
  perform "check_lead_account"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_lead_account_forward" after insert on "leads" deferrable initially deferred for each row execute function "require_lead_account_forward"();

create function "check_lead_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "leads" where id = source_id) then
    select count(*) into n from "link_lead_contact" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'leadContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'leadContact.contact.bounds';
    end if;
  end if;
end $$;

create function "validate_lead_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_lead_contact"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_lead_contact"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_lead_contact" after insert or delete on "leads" deferrable initially deferred for each row execute function "validate_lead_contact"();

create constraint trigger "validate_lead_contact_update" after update on "leads" deferrable initially deferred for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "validate_lead_contact"();

create function "lock_lead_contact"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_lead_contact" before insert or delete on "leads" for each row execute function "lock_lead_contact"();

create trigger "lock_lead_contact_update" before update on "leads" for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "lock_lead_contact"();

create function "require_lead_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_lead_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_lead_contact_forward" after insert on "leads" deferrable initially deferred for each row execute function "require_lead_contact_forward"();

create function "check_campaign_member_campaign"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "campaign_members" where id = source_id) then
    select count(*) into n from "link_campaign_member_campaign" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'campaignMemberCampaign', 'campaign', 1, '1', n
        using errcode = '23514', constraint = 'campaignMemberCampaign.campaign.bounds';
    end if;
  end if;
end $$;

create function "validate_campaign_member_campaign"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_campaign_member_campaign"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_campaign_member_campaign"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_campaign_member_campaign" after insert or delete on "campaign_members" deferrable initially deferred for each row execute function "validate_campaign_member_campaign"();

create constraint trigger "validate_campaign_member_campaign_update" after update on "campaign_members" deferrable initially deferred for each row when (OLD."campaign_id" is distinct from NEW."campaign_id") execute function "validate_campaign_member_campaign"();

create function "lock_campaign_member_campaign"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_campaign_member_campaign" before insert or delete on "campaign_members" for each row execute function "lock_campaign_member_campaign"();

create trigger "lock_campaign_member_campaign_update" before update on "campaign_members" for each row when (OLD."campaign_id" is distinct from NEW."campaign_id") execute function "lock_campaign_member_campaign"();

create function "require_campaign_member_campaign_forward"() returns trigger language plpgsql as $$
begin
  perform "check_campaign_member_campaign"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_campaign_member_campaign_forward" after insert on "campaign_members" deferrable initially deferred for each row execute function "require_campaign_member_campaign_forward"();

create function "check_campaign_member_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "campaign_members" where id = source_id) then
    select count(*) into n from "link_campaign_member_contact" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'campaignMemberContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'campaignMemberContact.contact.bounds';
    end if;
  end if;
end $$;

create function "validate_campaign_member_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_campaign_member_contact"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_campaign_member_contact"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_campaign_member_contact" after insert or delete on "campaign_members" deferrable initially deferred for each row execute function "validate_campaign_member_contact"();

create constraint trigger "validate_campaign_member_contact_update" after update on "campaign_members" deferrable initially deferred for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "validate_campaign_member_contact"();

create function "lock_campaign_member_contact"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_campaign_member_contact" before insert or delete on "campaign_members" for each row execute function "lock_campaign_member_contact"();

create trigger "lock_campaign_member_contact_update" before update on "campaign_members" for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "lock_campaign_member_contact"();

create function "require_campaign_member_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_campaign_member_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_campaign_member_contact_forward" after insert on "campaign_members" deferrable initially deferred for each row execute function "require_campaign_member_contact_forward"();

create function "check_outreach_contact"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "outreaches" where id = source_id) then
    select count(*) into n from "link_outreach_contact" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'outreachContact', 'contact', 1, '1', n
        using errcode = '23514', constraint = 'outreachContact.contact.bounds';
    end if;
  end if;
end $$;

create function "validate_outreach_contact"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_outreach_contact"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_outreach_contact"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_outreach_contact" after insert or delete on "outreaches" deferrable initially deferred for each row execute function "validate_outreach_contact"();

create constraint trigger "validate_outreach_contact_update" after update on "outreaches" deferrable initially deferred for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "validate_outreach_contact"();

create function "lock_outreach_contact"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_outreach_contact" before insert or delete on "outreaches" for each row execute function "lock_outreach_contact"();

create trigger "lock_outreach_contact_update" before update on "outreaches" for each row when (OLD."contact_id" is distinct from NEW."contact_id") execute function "lock_outreach_contact"();

create function "require_outreach_contact_forward"() returns trigger language plpgsql as $$
begin
  perform "check_outreach_contact"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_outreach_contact_forward" after insert on "outreaches" deferrable initially deferred for each row execute function "require_outreach_contact_forward"();

create function "check_github_repository_connection"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "github_repositories" where id = source_id) then
    select count(*) into n from "link_github_repository_connection" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'githubRepositoryConnection', 'connection', 1, '1', n
        using errcode = '23514', constraint = 'githubRepositoryConnection.connection.bounds';
    end if;
  end if;
end $$;

create function "validate_github_repository_connection"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_github_repository_connection"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_github_repository_connection"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_github_repository_connection" after insert or delete on "github_repositories" deferrable initially deferred for each row execute function "validate_github_repository_connection"();

create constraint trigger "validate_github_repository_connection_update" after update on "github_repositories" deferrable initially deferred for each row when (OLD."connection_id" is distinct from NEW."connection_id") execute function "validate_github_repository_connection"();

create function "lock_github_repository_connection"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_github_repository_connection" before insert or delete on "github_repositories" for each row execute function "lock_github_repository_connection"();

create trigger "lock_github_repository_connection_update" before update on "github_repositories" for each row when (OLD."connection_id" is distinct from NEW."connection_id") execute function "lock_github_repository_connection"();

create function "require_github_repository_connection_forward"() returns trigger language plpgsql as $$
begin
  perform "check_github_repository_connection"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_github_repository_connection_forward" after insert on "github_repositories" deferrable initially deferred for each row execute function "require_github_repository_connection_forward"();

create function "check_github_issue_repository"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "github_issues" where id = source_id) then
    select count(*) into n from "link_github_issue_repository" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'githubIssueRepository', 'repository', 1, '1', n
        using errcode = '23514', constraint = 'githubIssueRepository.repository.bounds';
    end if;
  end if;
end $$;

create function "validate_github_issue_repository"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_github_issue_repository"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_github_issue_repository"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_github_issue_repository" after insert or delete on "github_issues" deferrable initially deferred for each row execute function "validate_github_issue_repository"();

create constraint trigger "validate_github_issue_repository_update" after update on "github_issues" deferrable initially deferred for each row when (OLD."repository_id" is distinct from NEW."repository_id") execute function "validate_github_issue_repository"();

create function "lock_github_issue_repository"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_github_issue_repository" before insert or delete on "github_issues" for each row execute function "lock_github_issue_repository"();

create trigger "lock_github_issue_repository_update" before update on "github_issues" for each row when (OLD."repository_id" is distinct from NEW."repository_id") execute function "lock_github_issue_repository"();

create function "require_github_issue_repository_forward"() returns trigger language plpgsql as $$
begin
  perform "check_github_issue_repository"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_github_issue_repository_forward" after insert on "github_issues" deferrable initially deferred for each row execute function "require_github_issue_repository_forward"();

create function "check_github_pull_request_repository"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "github_pull_requests" where id = source_id) then
    select count(*) into n from "link_github_pull_request_repository" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'githubPullRequestRepository', 'repository', 1, '1', n
        using errcode = '23514', constraint = 'githubPullRequestRepository.repository.bounds';
    end if;
  end if;
end $$;

create function "validate_github_pull_request_repository"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_github_pull_request_repository"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_github_pull_request_repository"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_github_pull_request_repository" after insert or delete on "github_pull_requests" deferrable initially deferred for each row execute function "validate_github_pull_request_repository"();

create constraint trigger "validate_github_pull_request_repository_update" after update on "github_pull_requests" deferrable initially deferred for each row when (OLD."repository_id" is distinct from NEW."repository_id") execute function "validate_github_pull_request_repository"();

create function "lock_github_pull_request_repository"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_github_pull_request_repository" before insert or delete on "github_pull_requests" for each row execute function "lock_github_pull_request_repository"();

create trigger "lock_github_pull_request_repository_update" before update on "github_pull_requests" for each row when (OLD."repository_id" is distinct from NEW."repository_id") execute function "lock_github_pull_request_repository"();

create function "require_github_pull_request_repository_forward"() returns trigger language plpgsql as $$
begin
  perform "check_github_pull_request_repository"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_github_pull_request_repository_forward" after insert on "github_pull_requests" deferrable initially deferred for each row execute function "require_github_pull_request_repository_forward"();

create function "check_application_job"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "applications" where id = source_id) then
    select count(*) into n from "link_application_job" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationJob', 'job', 1, '1', n
        using errcode = '23514', constraint = 'applicationJob.job.bounds';
    end if;
  end if;
end $$;

create function "validate_application_job"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_application_job"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_application_job"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_application_job" after insert or delete on "applications" deferrable initially deferred for each row execute function "validate_application_job"();

create constraint trigger "validate_application_job_update" after update on "applications" deferrable initially deferred for each row when (OLD."job_id" is distinct from NEW."job_id") execute function "validate_application_job"();

create function "lock_application_job"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_application_job" before insert or delete on "applications" for each row execute function "lock_application_job"();

create trigger "lock_application_job_update" before update on "applications" for each row when (OLD."job_id" is distinct from NEW."job_id") execute function "lock_application_job"();

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
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'applicationCandidate', 'candidate', 1, '1', n
        using errcode = '23514', constraint = 'applicationCandidate.candidate.bounds';
    end if;
  end if;
end $$;

create function "validate_application_candidate"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_application_candidate"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_application_candidate"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_application_candidate" after insert or delete on "applications" deferrable initially deferred for each row execute function "validate_application_candidate"();

create constraint trigger "validate_application_candidate_update" after update on "applications" deferrable initially deferred for each row when (OLD."candidate_id" is distinct from NEW."candidate_id") execute function "validate_application_candidate"();

create function "lock_application_candidate"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_application_candidate" before insert or delete on "applications" for each row execute function "lock_application_candidate"();

create trigger "lock_application_candidate_update" before update on "applications" for each row when (OLD."candidate_id" is distinct from NEW."candidate_id") execute function "lock_application_candidate"();

create function "require_application_candidate_forward"() returns trigger language plpgsql as $$
begin
  perform "check_application_candidate"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_application_candidate_forward" after insert on "applications" deferrable initially deferred for each row execute function "require_application_candidate_forward"();

create function "check_reply_ticket"(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  if side = 'forward' and exists (select 1 from "replies" where id = source_id) then
    select count(*) into n from "link_reply_ticket" where "forward_id" = source_id;
    if n < 1 or false then
      raise exception 'Link % traversal % requires %..% targets; found %', 'replyTicket', 'ticket', 1, '1', n
        using errcode = '23514', constraint = 'replyTicket.ticket.bounds';
    end if;
  end if;
end $$;

create function "validate_reply_ticket"() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    perform "check_reply_ticket"(OLD.id, 'forward');
  end if;
  if TG_OP <> 'DELETE' then
    perform "check_reply_ticket"(NEW.id, 'forward');
  end if;
  return null;
end $$;

create constraint trigger "validate_reply_ticket" after insert or delete on "replies" deferrable initially deferred for each row execute function "validate_reply_ticket"();

create constraint trigger "validate_reply_ticket_update" after update on "replies" deferrable initially deferred for each row when (OLD."ticket_id" is distinct from NEW."ticket_id") execute function "validate_reply_ticket"();

create function "lock_reply_ticket"() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[OLD.id]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[NEW.id]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$;

create trigger "lock_reply_ticket" before insert or delete on "replies" for each row execute function "lock_reply_ticket"();

create trigger "lock_reply_ticket_update" before update on "replies" for each row when (OLD."ticket_id" is distinct from NEW."ticket_id") execute function "lock_reply_ticket"();

create function "require_reply_ticket_forward"() returns trigger language plpgsql as $$
begin
  perform "check_reply_ticket"(NEW.id, 'forward');
  return null;
end $$;

create constraint trigger "require_reply_ticket_forward" after insert on "replies" deferrable initially deferred for each row execute function "require_reply_ticket_forward"();

alter table "controller_instances" add constraint "controller_instances_target_unique" unique ("controller_id", "record_id") deferrable initially deferred;

alter table "campaign_members" add constraint "campaign_members_membership_unique" unique ("campaign_id", "contact_id") deferrable initially deferred;

alter table "github_pull_requests" add constraint "github_pull_requests_number_unique" unique ("repository_id", "number") deferrable initially deferred;

alter table "github_issues" add constraint "github_issues_number_unique" unique ("repository_id", "number") deferrable initially deferred;

alter table "applications" add constraint "applications_candidate_job_unique" unique ("candidate_id", "job_id") deferrable initially deferred;

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

alter table "controllers" add constraint "controller_module_target_fk" foreign key ("module_id") references "module_settings" (id) on delete set null deferrable initially deferred;

alter table "controller_instances" add constraint "controller_instance_controller_target_fk" foreign key ("controller_id") references "controllers" (id) on delete set null deferrable initially deferred;

alter table "controller_instances" add constraint "controller_instance_record_target_fk" foreign key ("record_id") references "interface_controller_target" (id) on delete set null deferrable initially deferred;

alter table "accounts" add constraint "account_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "affiliations" add constraint "affiliation_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "affiliations" add constraint "affiliation_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete set null deferrable initially deferred;

alter table "activities" add constraint "activity_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "line_items" add constraint "opportunity_line_items_target_fk" foreign key ("opportunity_id") references "opportunities" (id) on delete set null deferrable initially deferred;

alter table "opportunities" add constraint "opportunity_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_opportunity_target_fk" foreign key ("opportunity_id") references "opportunities" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_opportunity_target_unique" unique ("opportunity_id") deferrable initially deferred;

alter table "campaigns" add constraint "campaign_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "contents" add constraint "content_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete set null deferrable initially deferred;

alter table "contents" add constraint "content_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "campaign_members" add constraint "campaign_member_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete set null deferrable initially deferred;

alter table "campaign_members" add constraint "campaign_member_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "outreaches" add constraint "outreach_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete set null deferrable initially deferred;

alter table "outreaches" add constraint "outreach_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "outreaches" add constraint "outreach_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "projects" add constraint "project_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "issues" add constraint "issue_project_target_fk" foreign key ("project_id") references "projects" (id) on delete set null deferrable initially deferred;

alter table "issues" add constraint "issue_assignee_target_fk" foreign key ("assignee_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "github_repositories" add constraint "github_repository_connection_target_fk" foreign key ("connection_id") references "github_connections" (id) on delete set null deferrable initially deferred;

alter table "github_repositories" add constraint "github_repository_maintainer_target_fk" foreign key ("maintainer_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "github_issues" add constraint "github_issue_repository_target_fk" foreign key ("repository_id") references "github_repositories" (id) on delete set null deferrable initially deferred;

alter table "github_pull_requests" add constraint "github_pull_request_repository_target_fk" foreign key ("repository_id") references "github_repositories" (id) on delete set null deferrable initially deferred;

alter table "applications" add constraint "application_job_target_fk" foreign key ("job_id") references "job_postings" (id) on delete set null deferrable initially deferred;

alter table "applications" add constraint "application_candidate_target_fk" foreign key ("candidate_id") references "candidates" (id) on delete set null deferrable initially deferred;

alter table "job_postings" add constraint "job_posting_hiring_manager_target_fk" foreign key ("hiring_manager_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "replies" add constraint "reply_ticket_target_fk" foreign key ("ticket_id") references "tickets" (id) on delete set null deferrable initially deferred;

alter table "tickets" add constraint "ticket_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete set null deferrable initially deferred;

alter table "tickets" add constraint "ticket_requester_target_fk" foreign key ("requester_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "tickets" add constraint "ticket_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

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
  "controller_keys" jsonb not null default '{}'::jsonb,
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

create table "controller_consumers" (
  "controller_id" text not null,
  "cursor" text not null,
  primary key ("controller_id")
);
