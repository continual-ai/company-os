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
    'connector',
    'connection',
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
    'task',
    'githubRepository',
    'githubPullRequest',
    'githubIssue',
    'jobPosting',
    'candidate',
    'application',
    'ticket',
    'reply',
    'feedback'
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
create table "link_graph_guards" (
  "link_id" text not null,
  "revision" bigint not null default 0,
  primary key ("link_id")
);

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
  -- Link reference.
  "module_id" text not null,
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
  -- Link reference.
  "controller_id" text not null,
  -- Link reference.
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

alter table "controller_instances" add constraint "controller_instances_target_unique" unique ("controller_id", "record_id") deferrable initially deferred;

-- Connector (connector)
-- A code-defined integration available to configured connections.
create table "connectors" (
  "id" text not null,
  -- Link reference.
  "module_id" text not null,
  "definition_id" text not null,
  "name" text not null,
  "description" text not null,
  "authentication" text not null,
  "available" boolean not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "connectors_definition_unique" on "connectors" ("definition_id");

-- Connection (connection)
-- Select a connector and enter the organization or username and access token.
-- Sync starts automatically and imports only data owned by that account and
-- accessible to the token.
create table "connections" (
  "id" text not null,
  -- Link reference.
  "connector_id" text not null,
  -- Enter the account's username or organization slug, not a display name or
  -- URL.
  "account" text not null,
  -- The token must have read access to the data you want to sync. Stored
  -- securely; never returned in record reads.
  "token" jsonb,
  "status" text,
  "last_error" text,
  "discovery_cursor" text,
  "discovered_at" timestamp with time zone,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

alter table "connections" add constraint "connections_account_unique" unique ("connector_id", "account") deferrable initially deferred;

-- ===========================================================================
-- Domain objects: CRM
-- ===========================================================================

-- Account (account)
-- A customer, prospect, or partner organization.
create table "accounts" (
  "id" text not null,
  -- Link reference.
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
  -- Link reference.
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
  -- Link reference.
  "contact_id" text not null,
  -- Link reference.
  "account_id" text not null,
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
  -- Link reference.
  "account_id" text not null,
  -- Link reference.
  "owner_id" text,
  -- Link reference.
  "contact_id" text not null,
  -- Link reference.
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
  -- Link reference.
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
  -- Link reference.
  "opportunity_id" text not null,
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
  -- Link reference.
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
  -- Link reference.
  "campaign_id" text,
  -- Link reference.
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
  -- Link reference.
  "campaign_id" text not null,
  -- Link reference.
  "contact_id" text not null,
  "status" text not null default 'queued',
  "step" integer not null default 0,
  "next_touch_at" timestamp with time zone,
  "context" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

alter table "campaign_members" add constraint "campaign_members_membership_unique" unique ("campaign_id", "contact_id") deferrable initially deferred;

-- Outreach (outreach)
-- Track a message and its delivery status. Saving does not send it.
create table "outreaches" (
  "id" text not null,
  -- Link reference.
  "campaign_id" text,
  -- Link reference.
  "contact_id" text not null,
  -- Link reference.
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
-- Domain objects: Work
-- ===========================================================================

-- Project (project)
-- Related work organized around a goal and target date.
create table "projects" (
  "id" text not null,
  -- Link reference.
  "owner_id" text,
  "name" text not null,
  "objective" text,
  "status" text not null default 'planned',
  "target_date" date,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- Task (task)
-- Work with an accountable owner and completion criteria. Tasks may stand
-- alone, belong to a project, or contain subtasks.
create table "tasks" (
  "id" text not null,
  -- Link reference.
  "project_id" text,
  -- Link reference.
  "owner_id" text,
  -- Link reference.
  "parent_id" text,
  "title" text not null,
  -- Context, instructions, and the intended outcome.
  "description" text,
  -- The observable result and evidence needed to accept this work.
  "acceptance_criteria" text,
  "priority" text not null default 'normal',
  "due_date" date,
  "planned_start_date" date,
  "planned_finish_date" date,
  "status" text not null default 'backlog',
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

alter table "tasks" add constraint "tasks_check_plannedDates" check ("planned_start_date" <= "planned_finish_date");

-- ===========================================================================
-- Domain objects: Engineering
-- ===========================================================================

-- GitHub repository (githubRepository)
-- A GitHub repository connected to internal projects and its imported issues
-- and pull requests.
create table "github_repositories" (
  "id" text not null,
  -- Link reference.
  "connection_id" text not null,
  -- Link reference.
  "maintainer_id" text,
  "sync_error" text,
  "sync_page" integer,
  "sync_started_at" timestamp with time zone,
  "sync_since_at" timestamp with time zone,
  "synced_at" timestamp with time zone,
  "full_synced_at" timestamp with time zone,
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
  -- Link reference.
  "repository_id" text not null,
  "node_id" text not null,
  "body" text,
  "title" text not null,
  "number" integer not null,
  "url" text not null,
  "status" text not null default 'draft',
  "review" text not null default 'unknown',
  "checks" text not null default 'unknown',
  "head_commit" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create unique index "github_pull_requests_github_unique" on "github_pull_requests" ("node_id");

alter table "github_pull_requests" add constraint "github_pull_requests_number_unique" unique ("repository_id", "number") deferrable initially deferred;

-- GitHub issue (githubIssue)
-- An issue tracked in GitHub, separate from internal product planning.
create table "github_issues" (
  "id" text not null,
  -- Link reference.
  "repository_id" text not null,
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

alter table "github_issues" add constraint "github_issues_number_unique" unique ("repository_id", "number") deferrable initially deferred;

-- ===========================================================================
-- Domain objects: Hiring
-- ===========================================================================

-- Job posting (jobPosting)
-- A role your account is hiring for.
create table "job_postings" (
  "id" text not null,
  -- Link reference.
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
  -- Link reference.
  "job_id" text not null,
  -- Link reference.
  "candidate_id" text not null,
  "stage" text not null default 'new',
  "source" text not null default 'unknown',
  "cover_letter" text,
  "resume" jsonb,
  "rating" integer,
  "review_notes" text,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

alter table "applications" add constraint "applications_candidate_job_unique" unique ("candidate_id", "job_id") deferrable initially deferred;

-- ===========================================================================
-- Domain objects: Service
-- ===========================================================================

-- Ticket (ticket)
-- A customer request or problem to investigate and resolve.
create table "tickets" (
  "id" text not null,
  -- Link reference.
  "account_id" text,
  -- Link reference.
  "requester_id" text,
  -- Link reference.
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
  -- Link reference.
  "ticket_id" text not null,
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
-- Domain objects: Feedback
-- ===========================================================================

-- Feedback (feedback)
-- An observation, request, or report to consider. Feedback preserves the
-- evidence independently of any work it leads to.
create table "feedback" (
  "id" text not null,
  -- Link reference.
  "owner_id" text,
  -- Link reference.
  "reporter_id" text,
  "title" text not null,
  -- Preserve the original words, context, and observed impact.
  "description" text,
  -- Review progress, independent of the status of linked tasks.
  "status" text not null default 'new',
  -- Where this came from, such as an interview or field inspection.
  "source" text,
  "source_url" text,
  -- The assessment, decision, and reason for any next steps.
  "review_notes" text,
  "attachments" jsonb not null default '[]'::jsonb,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

-- ===========================================================================
-- Links
-- ===========================================================================
-- Association pairs and cardinality constraints.

create view "link_controller_module" as select "id" as forward_id, "module_id" as reverse_id from "controllers" where "module_id" is not null;

create index "controller_module_target_idx" on "controllers" ("module_id", "id");

create view "link_connector_module" as select "id" as forward_id, "module_id" as reverse_id from "connectors" where "module_id" is not null;

create index "connector_module_target_idx" on "connectors" ("module_id", "id");

create view "link_connection_connector" as select "id" as forward_id, "connector_id" as reverse_id from "connections" where "connector_id" is not null;

create index "connection_connector_target_idx" on "connections" ("connector_id", "id");

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

create index "link_note_subjects_reverse_id_idx" on "link_note_subjects" ("reverse_id", "forward_id");

create view "link_controller_instance_controller" as select "id" as forward_id, "controller_id" as reverse_id from "controller_instances" where "controller_id" is not null;

create index "controller_instance_controller_target_idx" on "controller_instances" ("controller_id", "id");

create view "link_controller_instance_record" as select "id" as forward_id, "record_id" as reverse_id from "controller_instances" where "record_id" is not null;

create index "controller_instance_record_target_idx" on "controller_instances" ("record_id", "id");

create view "link_account_owner" as select "id" as forward_id, "owner_id" as reverse_id from "accounts" where "owner_id" is not null;

create index "account_owner_target_idx" on "accounts" ("owner_id", "id");

create view "link_affiliation_contact" as select "id" as forward_id, "contact_id" as reverse_id from "affiliations" where "contact_id" is not null;

create index "affiliation_contact_target_idx" on "affiliations" ("contact_id", "id");

create view "link_affiliation_account" as select "id" as forward_id, "account_id" as reverse_id from "affiliations" where "account_id" is not null;

create index "affiliation_account_target_idx" on "affiliations" ("account_id", "id");

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

create index "link_activity_accounts_reverse_id_idx" on "link_activity_accounts" ("reverse_id", "forward_id");

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

create index "link_activity_contacts_reverse_id_idx" on "link_activity_contacts" ("reverse_id", "forward_id");

create view "link_activity_owner" as select "id" as forward_id, "owner_id" as reverse_id from "activities" where "owner_id" is not null;

create index "activity_owner_target_idx" on "activities" ("owner_id", "id");

create view "link_opportunity_line_items" as select "opportunity_id" as forward_id, "id" as reverse_id from "line_items" where "opportunity_id" is not null;

create index "opportunity_line_items_target_idx" on "line_items" ("opportunity_id", "id");

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

create index "link_opportunity_accounts_reverse_id_idx" on "link_opportunity_accounts" ("reverse_id", "forward_id");

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

create index "link_opportunity_contacts_reverse_id_idx" on "link_opportunity_contacts" ("reverse_id", "forward_id");

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

create index "link_activity_opportunities_reverse_id_idx" on "link_activity_opportunities" ("reverse_id", "forward_id");

create view "link_opportunity_owner" as select "id" as forward_id, "owner_id" as reverse_id from "opportunities" where "owner_id" is not null;

create index "opportunity_owner_target_idx" on "opportunities" ("owner_id", "id");

create view "link_lead_account" as select "id" as forward_id, "account_id" as reverse_id from "leads" where "account_id" is not null;

create index "lead_account_target_idx" on "leads" ("account_id", "id");

create view "link_lead_owner" as select "id" as forward_id, "owner_id" as reverse_id from "leads" where "owner_id" is not null;

create index "lead_owner_target_idx" on "leads" ("owner_id", "id");

create view "link_lead_contact" as select "id" as forward_id, "contact_id" as reverse_id from "leads" where "contact_id" is not null;

create index "lead_contact_target_idx" on "leads" ("contact_id", "id");

create view "link_lead_opportunity" as select "id" as forward_id, "opportunity_id" as reverse_id from "leads" where "opportunity_id" is not null;

create view "link_campaign_owner" as select "id" as forward_id, "owner_id" as reverse_id from "campaigns" where "owner_id" is not null;

create index "campaign_owner_target_idx" on "campaigns" ("owner_id", "id");

create view "link_content_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "contents" where "campaign_id" is not null;

create index "content_campaign_target_idx" on "contents" ("campaign_id", "id");

create view "link_content_owner" as select "id" as forward_id, "owner_id" as reverse_id from "contents" where "owner_id" is not null;

create index "content_owner_target_idx" on "contents" ("owner_id", "id");

create view "link_campaign_member_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "campaign_members" where "campaign_id" is not null;

create index "campaign_member_campaign_target_idx" on "campaign_members" ("campaign_id", "id");

create view "link_campaign_member_contact" as select "id" as forward_id, "contact_id" as reverse_id from "campaign_members" where "contact_id" is not null;

create index "campaign_member_contact_target_idx" on "campaign_members" ("contact_id", "id");

create view "link_outreach_campaign" as select "id" as forward_id, "campaign_id" as reverse_id from "outreaches" where "campaign_id" is not null;

create index "outreach_campaign_target_idx" on "outreaches" ("campaign_id", "id");

create view "link_outreach_contact" as select "id" as forward_id, "contact_id" as reverse_id from "outreaches" where "contact_id" is not null;

create index "outreach_contact_target_idx" on "outreaches" ("contact_id", "id");

create view "link_outreach_owner" as select "id" as forward_id, "owner_id" as reverse_id from "outreaches" where "owner_id" is not null;

create index "outreach_owner_target_idx" on "outreaches" ("owner_id", "id");

create view "link_project_owner" as select "id" as forward_id, "owner_id" as reverse_id from "projects" where "owner_id" is not null;

create index "project_owner_target_idx" on "projects" ("owner_id", "id");

create view "link_task_project" as select "id" as forward_id, "project_id" as reverse_id from "tasks" where "project_id" is not null;

create index "task_project_target_idx" on "tasks" ("project_id", "id");

create view "link_task_owner" as select "id" as forward_id, "owner_id" as reverse_id from "tasks" where "owner_id" is not null;

create index "task_owner_target_idx" on "tasks" ("owner_id", "id");

create view "link_task_parent" as select "id" as forward_id, "parent_id" as reverse_id from "tasks" where "parent_id" is not null;

create index "task_parent_target_idx" on "tasks" ("parent_id", "id");

-- Task dependencies (taskDependencies)
create table "link_task_dependencies" (
  -- References tasks.id.
  "forward_id" text not null,
  -- References tasks.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tasks" ("id") on delete cascade,
  foreign key ("reverse_id") references "tasks" ("id") on delete cascade
);

create index "link_task_dependencies_reverse_id_idx" on "link_task_dependencies" ("reverse_id", "forward_id");

create view "link_github_repository_connection" as select "id" as forward_id, "connection_id" as reverse_id from "github_repositories" where "connection_id" is not null;

create index "github_repository_connection_target_idx" on "github_repositories" ("connection_id", "id");

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

create index "link_github_repository_projects_reverse_id_idx" on "link_github_repository_projects" ("reverse_id", "forward_id");

create view "link_github_repository_maintainer" as select "id" as forward_id, "maintainer_id" as reverse_id from "github_repositories" where "maintainer_id" is not null;

create index "github_repository_maintainer_target_idx" on "github_repositories" ("maintainer_id", "id");

create view "link_github_issue_repository" as select "id" as forward_id, "repository_id" as reverse_id from "github_issues" where "repository_id" is not null;

create index "github_issue_repository_target_idx" on "github_issues" ("repository_id", "id");

create view "link_github_pull_request_repository" as select "id" as forward_id, "repository_id" as reverse_id from "github_pull_requests" where "repository_id" is not null;

create index "github_pull_request_repository_target_idx" on "github_pull_requests" ("repository_id", "id");

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

create index "link_github_issue_pull_requests_reverse_id_idx" on "link_github_issue_pull_requests" ("reverse_id", "forward_id");

-- Task GitHub issues (taskGithubIssues)
create table "link_task_github_issues" (
  -- References tasks.id.
  "forward_id" text not null,
  -- References github_issues.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tasks" ("id") on delete cascade,
  foreign key ("reverse_id") references "github_issues" ("id") on delete cascade
);

create index "link_task_github_issues_reverse_id_idx" on "link_task_github_issues" ("reverse_id", "forward_id");

-- Task GitHub pull requests (taskGithubPullRequests)
create table "link_task_github_pull_requests" (
  -- References tasks.id.
  "forward_id" text not null,
  -- References github_pull_requests.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tasks" ("id") on delete cascade,
  foreign key ("reverse_id") references "github_pull_requests" ("id") on delete cascade
);

create index "link_task_github_pull_requests_reverse_id_idx" on "link_task_github_pull_requests" ("reverse_id", "forward_id");

create view "link_application_job" as select "id" as forward_id, "job_id" as reverse_id from "applications" where "job_id" is not null;

create index "application_job_target_idx" on "applications" ("job_id", "id");

create view "link_application_candidate" as select "id" as forward_id, "candidate_id" as reverse_id from "applications" where "candidate_id" is not null;

create index "application_candidate_target_idx" on "applications" ("candidate_id", "id");

create view "link_job_posting_hiring_manager" as select "id" as forward_id, "hiring_manager_id" as reverse_id from "job_postings" where "hiring_manager_id" is not null;

create index "job_posting_hiring_manager_target_idx" on "job_postings" ("hiring_manager_id", "id");

create view "link_reply_ticket" as select "id" as forward_id, "ticket_id" as reverse_id from "replies" where "ticket_id" is not null;

create index "reply_ticket_target_idx" on "replies" ("ticket_id", "id");

create view "link_ticket_account" as select "id" as forward_id, "account_id" as reverse_id from "tickets" where "account_id" is not null;

create index "ticket_account_target_idx" on "tickets" ("account_id", "id");

create view "link_ticket_requester" as select "id" as forward_id, "requester_id" as reverse_id from "tickets" where "requester_id" is not null;

create index "ticket_requester_target_idx" on "tickets" ("requester_id", "id");

create view "link_ticket_owner" as select "id" as forward_id, "owner_id" as reverse_id from "tickets" where "owner_id" is not null;

create index "ticket_owner_target_idx" on "tickets" ("owner_id", "id");

create view "link_feedback_owner" as select "id" as forward_id, "owner_id" as reverse_id from "feedback" where "owner_id" is not null;

create index "feedback_owner_target_idx" on "feedback" ("owner_id", "id");

create view "link_feedback_reporter" as select "id" as forward_id, "reporter_id" as reverse_id from "feedback" where "reporter_id" is not null;

create index "feedback_reporter_target_idx" on "feedback" ("reporter_id", "id");

-- Feedback tasks (feedbackTasks)
create table "link_feedback_tasks" (
  -- References feedback.id.
  "forward_id" text not null,
  -- References tasks.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "feedback" ("id") on delete cascade,
  foreign key ("reverse_id") references "tasks" ("id") on delete cascade
);

create index "link_feedback_tasks_reverse_id_idx" on "link_feedback_tasks" ("reverse_id", "forward_id");

-- Feedback source tickets (feedbackTickets)
create table "link_feedback_tickets" (
  -- References feedback.id.
  "forward_id" text not null,
  -- References tickets.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "feedback" ("id") on delete cascade,
  foreign key ("reverse_id") references "tickets" ("id") on delete cascade
);

create index "link_feedback_tickets_reverse_id_idx" on "link_feedback_tickets" ("reverse_id", "forward_id");

-- Customer reported tasks (ticketTasks)
create table "link_ticket_tasks" (
  -- References tickets.id.
  "forward_id" text not null,
  -- References tasks.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "tickets" ("id") on delete cascade,
  foreign key ("reverse_id") references "tasks" ("id") on delete cascade
);

create index "link_ticket_tasks_reverse_id_idx" on "link_ticket_tasks" ("reverse_id", "forward_id");

-- Opportunity work (opportunityTasks)
create table "link_opportunity_tasks" (
  -- References opportunities.id.
  "forward_id" text not null,
  -- References tasks.id.
  "reverse_id" text not null,
  primary key ("forward_id", "reverse_id"),
  foreign key ("forward_id") references "opportunities" ("id") on delete cascade,
  foreign key ("reverse_id") references "tasks" ("id") on delete cascade
);

create index "link_opportunity_tasks_reverse_id_idx" on "link_opportunity_tasks" ("reverse_id", "forward_id");

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

alter table "controllers" add constraint "controller_module_target_fk" foreign key ("module_id") references "module_settings" (id) on delete no action deferrable initially deferred;

alter table "connectors" add constraint "connector_module_target_fk" foreign key ("module_id") references "module_settings" (id) on delete no action deferrable initially deferred;

alter table "connections" add constraint "connection_connector_target_fk" foreign key ("connector_id") references "connectors" (id) on delete no action deferrable initially deferred;

alter table "controller_instances" add constraint "controller_instance_controller_target_fk" foreign key ("controller_id") references "controllers" (id) on delete no action deferrable initially deferred;

alter table "controller_instances" add constraint "controller_instance_record_target_fk" foreign key ("record_id") references "interface_controller_target" (id) on delete set null deferrable initially deferred;

alter table "accounts" add constraint "account_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "affiliations" add constraint "affiliation_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete no action deferrable initially deferred;

alter table "affiliations" add constraint "affiliation_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete no action deferrable initially deferred;

alter table "activities" add constraint "activity_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "line_items" add constraint "opportunity_line_items_target_fk" foreign key ("opportunity_id") references "opportunities" (id) on delete no action deferrable initially deferred;

alter table "opportunities" add constraint "opportunity_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete no action deferrable initially deferred;

alter table "leads" add constraint "lead_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete no action deferrable initially deferred;

alter table "leads" add constraint "lead_opportunity_target_fk" foreign key ("opportunity_id") references "opportunities" (id) on delete set null deferrable initially deferred;

alter table "leads" add constraint "lead_opportunity_target_unique" unique ("opportunity_id") deferrable initially deferred;

alter table "campaigns" add constraint "campaign_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "contents" add constraint "content_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete set null deferrable initially deferred;

alter table "contents" add constraint "content_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "campaign_members" add constraint "campaign_member_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete no action deferrable initially deferred;

alter table "campaign_members" add constraint "campaign_member_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete no action deferrable initially deferred;

alter table "outreaches" add constraint "outreach_campaign_target_fk" foreign key ("campaign_id") references "campaigns" (id) on delete set null deferrable initially deferred;

alter table "outreaches" add constraint "outreach_contact_target_fk" foreign key ("contact_id") references "contacts" (id) on delete no action deferrable initially deferred;

alter table "outreaches" add constraint "outreach_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "projects" add constraint "project_owner_target_fk" foreign key ("owner_id") references "interface_identity" (id) on delete set null deferrable initially deferred;

alter table "tasks" add constraint "task_project_target_fk" foreign key ("project_id") references "projects" (id) on delete set null deferrable initially deferred;

alter table "tasks" add constraint "task_owner_target_fk" foreign key ("owner_id") references "interface_identity" (id) on delete set null deferrable initially deferred;

alter table "tasks" add constraint "task_parent_target_fk" foreign key ("parent_id") references "tasks" (id) on delete set null deferrable initially deferred;

alter table "github_repositories" add constraint "github_repository_connection_target_fk" foreign key ("connection_id") references "connections" (id) on delete no action deferrable initially deferred;

alter table "github_repositories" add constraint "github_repository_maintainer_target_fk" foreign key ("maintainer_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "github_issues" add constraint "github_issue_repository_target_fk" foreign key ("repository_id") references "github_repositories" (id) on delete no action deferrable initially deferred;

alter table "github_pull_requests" add constraint "github_pull_request_repository_target_fk" foreign key ("repository_id") references "github_repositories" (id) on delete no action deferrable initially deferred;

alter table "applications" add constraint "application_job_target_fk" foreign key ("job_id") references "job_postings" (id) on delete no action deferrable initially deferred;

alter table "applications" add constraint "application_candidate_target_fk" foreign key ("candidate_id") references "candidates" (id) on delete no action deferrable initially deferred;

alter table "job_postings" add constraint "job_posting_hiring_manager_target_fk" foreign key ("hiring_manager_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "replies" add constraint "reply_ticket_target_fk" foreign key ("ticket_id") references "tickets" (id) on delete no action deferrable initially deferred;

alter table "tickets" add constraint "ticket_account_target_fk" foreign key ("account_id") references "accounts" (id) on delete set null deferrable initially deferred;

alter table "tickets" add constraint "ticket_requester_target_fk" foreign key ("requester_id") references "contacts" (id) on delete set null deferrable initially deferred;

alter table "tickets" add constraint "ticket_owner_target_fk" foreign key ("owner_id") references "users" (id) on delete set null deferrable initially deferred;

alter table "feedback" add constraint "feedback_owner_target_fk" foreign key ("owner_id") references "interface_identity" (id) on delete set null deferrable initially deferred;

alter table "feedback" add constraint "feedback_reporter_target_fk" foreign key ("reporter_id") references "contacts" (id) on delete set null deferrable initially deferred;

create function "task_parent_acyclic"() returns trigger language plpgsql as $$
begin
  -- Removed edges and empty references cannot introduce a cycle.
  if not exists (select 1 from "link_task_parent" where forward_id = new."id" and reverse_id = new."parent_id") then
    return null;
  end if;
  -- A write serializes graph validation and rejects stale repeatable-read snapshots.
  -- Endpoint row locks alone cannot protect cycles formed by disjoint new edges.
  insert into "link_graph_guards" ("link_id", "revision") values ('taskParent', 1)
    on conflict ("link_id") do update set "revision" = "link_graph_guards"."revision" + 1;
  if exists (
      with recursive reachable(id) as (
        select new."parent_id"
        union
        select edge.reverse_id from "link_task_parent" edge join reachable on edge.forward_id = reachable.id
      )
      select 1 from reachable where id = new."id"
    ) then
    raise exception using errcode = '23514', constraint = 'task_parent_acyclic', message = 'Link cannot contain a cycle.';
  end if;
  return null;
end
$$;

create constraint trigger "task_parent_acyclic" after insert or update of "parent_id" on "tasks" deferrable initially deferred for each row execute function "task_parent_acyclic"();

create function "task_dependencies_acyclic"() returns trigger language plpgsql as $$
begin
  -- Removed edges and empty references cannot introduce a cycle.
  if not exists (select 1 from "link_task_dependencies" where forward_id = new."forward_id" and reverse_id = new."reverse_id") then
    return null;
  end if;
  -- A write serializes graph validation and rejects stale repeatable-read snapshots.
  -- Endpoint row locks alone cannot protect cycles formed by disjoint new edges.
  insert into "link_graph_guards" ("link_id", "revision") values ('taskDependencies', 1)
    on conflict ("link_id") do update set "revision" = "link_graph_guards"."revision" + 1;
  if exists (
      with recursive reachable(id) as (
        select new."reverse_id"
        union
        select edge.reverse_id from "link_task_dependencies" edge join reachable on edge.forward_id = reachable.id
      )
      select 1 from reachable where id = new."forward_id"
    ) then
    raise exception using errcode = '23514', constraint = 'task_dependencies_acyclic', message = 'Link cannot contain a cycle.';
  end if;
  return null;
end
$$;

create constraint trigger "task_dependencies_acyclic" after insert or update of "forward_id", "reverse_id" on "link_task_dependencies" deferrable initially deferred for each row execute function "task_dependencies_acyclic"();

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
