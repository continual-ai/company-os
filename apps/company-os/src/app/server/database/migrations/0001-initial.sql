-- Generated current schema. Edit the model or runtime storage definitions.

-- Core record storage

create table "objects" (
  "id" text not null,
  "object_type" text not null,
  "parent_id" text,
  "ancestor_ids" text[] not null default '{}',
  "metadata" jsonb not null default '{}',
  "system_managed" boolean not null default false,
  "etag" text not null default '1',
  "created_at" timestamp with time zone not null default now(),
  "created_by_id" text not null,
  "updated_at" timestamp with time zone not null default now(),
  "updated_by_id" text not null,
  primary key (id),
  foreign key (parent_id) references objects(id) on delete restrict,
  constraint objects_object_type_check check (object_type in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'asset', 'note', 'activity', 'company', 'contact', 'lead', 'deal', 'lineItem', 'campaign', 'content', 'enrollment', 'outreach', 'issue', 'project', 'repository', 'pullRequest', 'ticket', 'reply', 'escalation')),
  constraint objects_parent_required check ((object_type='root' and parent_id is null) or (object_type<>'root' and parent_id is not null)),
  constraint objects_id_parent_id_unique unique(id,parent_id)
);

comment on table "objects" is 'Shared record identity, ownership, audit fields, and concurrency state. Domain properties live in their object tables.';

comment on column "objects"."id" is 'Stable identity shared by the domain row and its interface memberships.';

comment on column "objects"."object_type" is 'Object type declared in the company model.';

comment on column "objects"."parent_id" is 'Ownership parent. Only the root has no parent.';

comment on column "objects"."ancestor_ids" is 'Ownership ancestry used when filtering records by access scope.';

comment on column "objects"."etag" is 'Version precondition for optimistic writes.';

create index objects_object_type_idx on objects(object_type);

create index objects_parent_id_idx on objects(parent_id);

create index objects_ancestor_ids_idx on objects using gin(ancestor_ids);

create table "roots" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "roots" is 'Root membership for the company ownership tree.';

create table "record_aliases" (
  "alias" text not null,
  "object_id" text not null,
  primary key (alias),
  foreign key (object_id) references objects(id) on delete cascade
);

comment on table "record_aliases" is 'Alternate identifiers resolving to one canonical record.';

create index record_aliases_object_id_idx on record_aliases(object_id);

-- Interface membership: each row identifies an implementing record; no duplicated domain properties

create table "interface_actor" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_actor" is 'Membership in Actor (actor). IDs refer to implementing records; properties remain on their domain tables. Who performed an action, such as a user, agent, or anonymous visitor.';

create table "interface_authorization_scope" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_authorization_scope" is 'Membership in Authorization scope (authorizationScope). IDs refer to implementing records; properties remain on their domain tables. A resource where roles can be granted and inherited by records it owns.';

create table "interface_identity" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_identity" is 'Membership in Identity (identity). IDs refer to implementing records; properties remain on their domain tables. A signed-in user or authenticated service account.';

create table "interface_principal" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_principal" is 'Membership in Principal (principal). IDs refer to implementing records; properties remain on their domain tables. A user, service account, group, or audience that can receive access.';

create table "interface_note_subject" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_note_subject" is 'Membership in Note subject (noteSubject). IDs refer to implementing records; properties remain on their domain tables. A business record that can have notes attached.';

create table "interface_party" (
  "id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "interface_party" is 'Membership in Party (party). IDs refer to implementing records; properties remain on their domain tables. A company or contact involved in your business.';

-- Domain objects: Access

create table "users" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "email" text not null,
  "image" jsonb,
  "status" text not null default 'active',
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "users" is 'User (user). Someone who can sign in and use this application.';

comment on column "users"."id" is 'Same identity as the corresponding row in objects.';

comment on column "users"."parent_id" is 'Ownership parent implementing root.';

create index "users_parent_id_idx" on "users"(parent_id);

create table "service_accounts" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "description" text,
  "status" text not null default 'active',
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "service_accounts" is 'Service account (serviceAccount). An account for an integration, application, or agent.';

comment on column "service_accounts"."id" is 'Same identity as the corresponding row in objects.';

comment on column "service_accounts"."parent_id" is 'Ownership parent implementing root.';

create index "service_accounts_parent_id_idx" on "service_accounts"(parent_id);

create table "anonymous_actors" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "anonymous_actors" is 'Anonymous actor (anonymousActor). Identifies activity from visitors who are not signed in.';

comment on column "anonymous_actors"."id" is 'Same identity as the corresponding row in objects.';

comment on column "anonymous_actors"."parent_id" is 'Ownership parent implementing root.';

create index "anonymous_actors_parent_id_idx" on "anonymous_actors"(parent_id);

create table "groups" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "description" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "groups" is 'Group (group). Manage access for a group of users and service accounts.';

comment on column "groups"."id" is 'Same identity as the corresponding row in objects.';

comment on column "groups"."parent_id" is 'Ownership parent implementing root.';

create index "groups_parent_id_idx" on "groups"(parent_id);

create table "principal_sets" (
  "id" text not null,
  "parent_id" text not null,
  "kind" text not null,
  "name" text not null,
  "description" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "principal_sets" is 'Principal set (principalSet). A built-in audience, such as everyone or signed-in users.';

comment on column "principal_sets"."id" is 'Same identity as the corresponding row in objects.';

comment on column "principal_sets"."parent_id" is 'Ownership parent implementing root.';

create index "principal_sets_parent_id_idx" on "principal_sets"(parent_id);

create unique index "principal_sets_kind_unique" on "principal_sets" ("kind");

create table "group_memberships" (
  "id" text not null,
  "parent_id" text not null,
  "member_id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "group_memberships" is 'Group membership (groupMembership). Add a user or service account to a group.';

comment on column "group_memberships"."id" is 'Same identity as the corresponding row in objects.';

comment on column "group_memberships"."parent_id" is 'Ownership parent implementing group.';

create index "group_memberships_parent_id_idx" on "group_memberships"(parent_id);

create index "group_memberships_member_id_idx" on "group_memberships"("member_id");

create unique index "group_memberships_membership_unique" on "group_memberships" ("parent_id", "member_id");

create table "roles" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "description" text,
  "scope_type" text not null,
  "permissions" text[] not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "roles" is 'Role (role). The actions someone can perform when given this role.';

comment on column "roles"."id" is 'Same identity as the corresponding row in objects.';

comment on column "roles"."parent_id" is 'Ownership parent implementing root.';

create index "roles_parent_id_idx" on "roles"(parent_id);

create table "role_assignments" (
  "id" text not null,
  "parent_id" text not null,
  "principal_id" text not null,
  "role_id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "role_assignments" is 'Role assignment (roleAssignment). Give a user, group, or service account a role on a resource.';

comment on column "role_assignments"."id" is 'Same identity as the corresponding row in objects.';

comment on column "role_assignments"."parent_id" is 'Ownership parent implementing authorizationScope.';

create index "role_assignments_parent_id_idx" on "role_assignments"(parent_id);

create index "role_assignments_principal_id_idx" on "role_assignments"("principal_id");

create index "role_assignments_role_id_idx" on "role_assignments"("role_id");

create unique index "role_assignments_assignment_unique" on "role_assignments" ("parent_id", "principal_id", "role_id");

-- Domain objects: Assets

create table "assets" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "content_type" text not null,
  "size" integer not null,
  "state" text not null default 'pending',
  "width" integer,
  "height" integer,
  "checksum" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "assets" is 'Asset (asset). A file or image attached to your work.';

comment on column "assets"."id" is 'Same identity as the corresponding row in objects.';

comment on column "assets"."parent_id" is 'Ownership parent implementing authorizationScope.';

create index "assets_parent_id_idx" on "assets"(parent_id);

-- Domain objects: Notes

create table "notes" (
  "id" text not null,
  "parent_id" text not null,
  "content" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "notes" is 'Note (note). Notes on conversations, decisions, or next steps.';

comment on column "notes"."id" is 'Same identity as the corresponding row in objects.';

comment on column "notes"."parent_id" is 'Ownership parent implementing root.';

create index "notes_parent_id_idx" on "notes"(parent_id);

-- Domain objects: Sales

create table "activities" (
  "id" text not null,
  "parent_id" text not null,
  "title" text not null,
  "company_id" text,
  "contact_id" text,
  "deal_id" text,
  "owner_id" text,
  "kind" text not null default 'task',
  "status" text not null default 'planned',
  "due_at" timestamp with time zone,
  "outcome" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "activities" is 'Activity (activity). A task, call, or meeting with a customer or prospect.';

comment on column "activities"."id" is 'Same identity as the corresponding row in objects.';

comment on column "activities"."parent_id" is 'Ownership parent implementing root.';

create index "activities_parent_id_idx" on "activities"(parent_id);

create index "activities_company_id_idx" on "activities"("company_id");

create index "activities_contact_id_idx" on "activities"("contact_id");

create index "activities_deal_id_idx" on "activities"("deal_id");

create index "activities_owner_id_idx" on "activities"("owner_id");

create table "companies" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "logo" jsonb,
  "domain" text,
  "website" text,
  "industry" text,
  "lifecycle_stage" text not null default 'prospect',
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "companies" is 'Company (company). A customer, prospect, or partner organization.';

comment on column "companies"."id" is 'Same identity as the corresponding row in objects.';

comment on column "companies"."parent_id" is 'Ownership parent implementing root.';

create index "companies_parent_id_idx" on "companies"(parent_id);

create table "contacts" (
  "id" text not null,
  "parent_id" text not null,
  "photo" jsonb,
  "name" text not null,
  "job_title" text,
  "email" text,
  "marketing_status" text not null default 'nonMarketing',
  "email_permission" text not null default 'unknown',
  "phone" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "contacts" is 'Contact (contact). A customer, prospect, or partner you work with.';

comment on column "contacts"."id" is 'Same identity as the corresponding row in objects.';

comment on column "contacts"."parent_id" is 'Ownership parent implementing root.';

comment on column "contacts"."marketing_status" is 'Choose whether to include this person in marketing audiences.';

comment on column "contacts"."email_permission" is 'Record permission to send marketing emails. Marketing status alone is not consent.';

create index "contacts_parent_id_idx" on "contacts"(parent_id);

create table "leads" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "company_name" text,
  "company_id" text,
  "email" text,
  "phone" text,
  "source" text not null default 'unknown',
  "status" text not null default 'new',
  "converted_company_id" text,
  "converted_contact_id" text,
  "converted_at" timestamp with time zone,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "leads" is 'Lead (lead). A potential customer to qualify and follow up with.';

comment on column "leads"."id" is 'Same identity as the corresponding row in objects.';

comment on column "leads"."parent_id" is 'Ownership parent implementing root.';

comment on column "leads"."company_name" is 'For a new company. Leave blank when linking an existing company.';

create index "leads_parent_id_idx" on "leads"(parent_id);

create index "leads_company_id_idx" on "leads"("company_id");

create index "leads_converted_company_id_idx" on "leads"("converted_company_id");

create index "leads_converted_contact_id_idx" on "leads"("converted_contact_id");

create table "deals" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "stage" text not null default 'discovery',
  "amount" jsonb,
  "expected_close_date" date,
  "owner_id" text,
  "next_step" text,
  "next_step_date" date,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "deals" is 'Deal (deal). A sales opportunity with its value, stage, and next steps.';

comment on column "deals"."id" is 'Same identity as the corresponding row in objects.';

comment on column "deals"."parent_id" is 'Ownership parent implementing authorizationScope.';

comment on column "deals"."amount" is 'Expected or agreed deal value.';

create index "deals_parent_id_idx" on "deals"(parent_id);

create index "deals_owner_id_idx" on "deals"("owner_id");

create table "line_items" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "quantity" integer not null default 1,
  "unit_price" jsonb,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "line_items" is 'Line item (lineItem). A product or service included in a deal.';

comment on column "line_items"."id" is 'Same identity as the corresponding row in objects.';

comment on column "line_items"."parent_id" is 'Ownership parent implementing deal.';

create index "line_items_parent_id_idx" on "line_items"(parent_id);

-- Domain objects: Marketing

create table "campaigns" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "objective" text,
  "channel" text not null default 'content',
  "status" text not null default 'draft',
  "owner_id" text,
  "budget" jsonb,
  "start_date" date,
  "end_date" date,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "campaigns" is 'Campaign (campaign). Plan a marketing campaign and track its budget, dates, and audience.';

comment on column "campaigns"."id" is 'Same identity as the corresponding row in objects.';

comment on column "campaigns"."parent_id" is 'Ownership parent implementing root.';

create index "campaigns_parent_id_idx" on "campaigns"(parent_id);

create index "campaigns_owner_id_idx" on "campaigns"("owner_id");

create table "contents" (
  "id" text not null,
  "parent_id" text not null,
  "title" text not null,
  "campaign_id" text,
  "format" text not null default 'article',
  "status" text not null default 'draft',
  "owner_id" text,
  "brief" text,
  "body" text,
  "scheduled_at" timestamp with time zone,
  "published_url" text,
  "attachments" jsonb not null default '[]'::jsonb,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "contents" is 'Content (content). Track an article, post, or ad. Saving does not publish it.';

comment on column "contents"."id" is 'Same identity as the corresponding row in objects.';

comment on column "contents"."parent_id" is 'Ownership parent implementing root.';

create index "contents_parent_id_idx" on "contents"(parent_id);

create index "contents_campaign_id_idx" on "contents"("campaign_id");

create index "contents_owner_id_idx" on "contents"("owner_id");

create table "enrollments" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "campaign_id" text not null,
  "contact_id" text not null,
  "status" text not null default 'queued',
  "step" integer not null default 0,
  "next_touch_at" timestamp with time zone,
  "context" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "enrollments" is 'Enrollment (enrollment). Track a contact''s progress and next follow-up in a campaign.';

comment on column "enrollments"."id" is 'Same identity as the corresponding row in objects.';

comment on column "enrollments"."parent_id" is 'Ownership parent implementing root.';

create index "enrollments_parent_id_idx" on "enrollments"(parent_id);

create index "enrollments_campaign_id_idx" on "enrollments"("campaign_id");

create index "enrollments_contact_id_idx" on "enrollments"("contact_id");

create table "outreaches" (
  "id" text not null,
  "parent_id" text not null,
  "subject" text not null,
  "campaign_id" text,
  "contact_id" text not null,
  "channel" text not null default 'email',
  "status" text not null default 'draft',
  "owner_id" text,
  "body" text,
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "external_id" text,
  "failure" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "outreaches" is 'Outreach (outreach). Track a message and its delivery status. Saving does not send it.';

comment on column "outreaches"."id" is 'Same identity as the corresponding row in objects.';

comment on column "outreaches"."parent_id" is 'Ownership parent implementing root.';

create index "outreaches_parent_id_idx" on "outreaches"(parent_id);

create index "outreaches_campaign_id_idx" on "outreaches"("campaign_id");

create index "outreaches_contact_id_idx" on "outreaches"("contact_id");

create index "outreaches_owner_id_idx" on "outreaches"("owner_id");

-- Domain objects: Engineering

create table "issues" (
  "id" text not null,
  "parent_id" text not null,
  "title" text not null,
  "description" text,
  "project_id" text,
  "priority" text not null default 'normal',
  "due_date" date,
  "assignee_id" text,
  "status" text not null default 'backlog',
  "attachments" jsonb not null default '[]'::jsonb,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "issues" is 'Issue (issue). A bug, request, or task to investigate and resolve.';

comment on column "issues"."id" is 'Same identity as the corresponding row in objects.';

comment on column "issues"."parent_id" is 'Ownership parent implementing root.';

create index "issues_parent_id_idx" on "issues"(parent_id);

create index "issues_project_id_idx" on "issues"("project_id");

create index "issues_assignee_id_idx" on "issues"("assignee_id");

create table "projects" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "objective" text,
  "owner_id" text,
  "status" text not null default 'planned',
  "target_date" date,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "projects" is 'Project (project). Related work organized around a goal and target date.';

comment on column "projects"."id" is 'Same identity as the corresponding row in objects.';

comment on column "projects"."parent_id" is 'Ownership parent implementing root.';

create index "projects_parent_id_idx" on "projects"(parent_id);

create index "projects_owner_id_idx" on "projects"("owner_id");

create table "repositories" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "url" text,
  "default_branch" text not null default 'main',
  "project_id" text,
  "owner_id" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "repositories" is 'Repository (repository). A codebase connected to your projects, issues, and pull requests.';

comment on column "repositories"."id" is 'Same identity as the corresponding row in objects.';

comment on column "repositories"."parent_id" is 'Ownership parent implementing root.';

create index "repositories_parent_id_idx" on "repositories"(parent_id);

create index "repositories_project_id_idx" on "repositories"("project_id");

create index "repositories_owner_id_idx" on "repositories"("owner_id");

create table "pull_requests" (
  "id" text not null,
  "parent_id" text not null,
  "title" text not null,
  "repository_id" text not null,
  "number" integer,
  "url" text,
  "status" text not null default 'draft',
  "review" text not null default 'pending',
  "checks" text not null default 'pending',
  "head_commit" text,
  "observed_at" timestamp with time zone,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "pull_requests" is 'Pull request (pullRequest). Track a code change, its reviews, and checks. Merge it in your code hosting service.';

comment on column "pull_requests"."id" is 'Same identity as the corresponding row in objects.';

comment on column "pull_requests"."parent_id" is 'Ownership parent implementing root.';

create index "pull_requests_parent_id_idx" on "pull_requests"(parent_id);

create index "pull_requests_repository_id_idx" on "pull_requests"("repository_id");

-- Domain objects: Support

create table "tickets" (
  "id" text not null,
  "parent_id" text not null,
  "subject" text not null,
  "description" text,
  "company_id" text,
  "requester_id" text,
  "owner_id" text,
  "priority" text not null default 'normal',
  "status" text not null default 'new',
  "respond_by_at" timestamp with time zone,
  "resolution" text,
  "external_id" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "tickets" is 'Ticket (ticket). A customer request or problem to investigate and resolve.';

comment on column "tickets"."id" is 'Same identity as the corresponding row in objects.';

comment on column "tickets"."parent_id" is 'Ownership parent implementing root.';

create index "tickets_parent_id_idx" on "tickets"(parent_id);

create index "tickets_company_id_idx" on "tickets"("company_id");

create index "tickets_requester_id_idx" on "tickets"("requester_id");

create index "tickets_owner_id_idx" on "tickets"("owner_id");

create table "replies" (
  "id" text not null,
  "parent_id" text not null,
  "subject" text not null,
  "ticket_id" text not null,
  "direction" text not null default 'inbound',
  "status" text not null default 'draft',
  "body" text not null,
  "external_id" text,
  "sent_at" timestamp with time zone,
  "attachments" jsonb not null default '[]'::jsonb,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "replies" is 'Reply (reply). A message about a support ticket. Saving does not send it.';

comment on column "replies"."id" is 'Same identity as the corresponding row in objects.';

comment on column "replies"."parent_id" is 'Ownership parent implementing root.';

create index "replies_parent_id_idx" on "replies"(parent_id);

create index "replies_ticket_id_idx" on "replies"("ticket_id");

-- Domain objects: Support engineering

create table "escalations" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "ticket_id" text not null,
  "issue_id" text not null,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "escalations" is 'Engineering escalation (escalation). A support request handed to engineering, with a durable receipt for retries.';

comment on column "escalations"."id" is 'Same identity as the corresponding row in objects.';

comment on column "escalations"."parent_id" is 'Ownership parent implementing root.';

create index "escalations_parent_id_idx" on "escalations"(parent_id);

create index "escalations_ticket_id_idx" on "escalations"("ticket_id");

create index "escalations_issue_id_idx" on "escalations"("issue_id");

create unique index "escalations_ticket_unique" on "escalations" ("ticket_id");

-- Relationships: association pairs and cardinality constraints

create table "note_subjects" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "notes"(id) on delete cascade,
  foreign key(reverse_id) references "interface_note_subject"(id) on delete cascade
);

comment on table "note_subjects" is 'Note subjects (noteSubjects).';

comment on column "note_subjects"."forward_id" is 'note: subjects.';

comment on column "note_subjects"."reverse_id" is 'noteSubject: notes.';

create index "note_subjects_forward_id_idx" on "note_subjects"(forward_id);

create index "note_subjects_reverse_id_idx" on "note_subjects"(reverse_id);

create table "contact_companies" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "contacts"(id) on delete cascade,
  foreign key(reverse_id) references "companies"(id) on delete cascade
);

comment on table "contact_companies" is 'Contact companies (contactCompanies).';

comment on column "contact_companies"."forward_id" is 'contact: companies.';

comment on column "contact_companies"."reverse_id" is 'company: contacts.';

create index "contact_companies_forward_id_idx" on "contact_companies"(forward_id);

create index "contact_companies_reverse_id_idx" on "contact_companies"(reverse_id);

create table "contact_primary_company" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "contacts"(id) on delete cascade,
  foreign key(reverse_id) references "companies"(id) on delete cascade
);

comment on table "contact_primary_company" is 'Contact primary company (contactPrimaryCompany). A selection from contactCompanies; removing membership clears the selection.';

comment on column "contact_primary_company"."forward_id" is 'contact: primaryCompany.';

comment on column "contact_primary_company"."reverse_id" is 'company: primaryContacts.';

create unique index "contact_primary_company_forward_id_unique" on "contact_primary_company"(forward_id);

create index "contact_primary_company_reverse_id_idx" on "contact_primary_company"(reverse_id);

create table "deal_companies" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "deals"(id) on delete cascade,
  foreign key(reverse_id) references "companies"(id) on delete cascade
);

comment on table "deal_companies" is 'Deal companies (dealCompanies).';

comment on column "deal_companies"."forward_id" is 'deal: companies.';

comment on column "deal_companies"."reverse_id" is 'company: deals.';

create index "deal_companies_forward_id_idx" on "deal_companies"(forward_id);

create index "deal_companies_reverse_id_idx" on "deal_companies"(reverse_id);

create table "issue_pull_requests" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "issues"(id) on delete cascade,
  foreign key(reverse_id) references "pull_requests"(id) on delete cascade
);

comment on table "issue_pull_requests" is 'Pull requests (issuePullRequests).';

comment on column "issue_pull_requests"."forward_id" is 'issue: pullRequests.';

comment on column "issue_pull_requests"."reverse_id" is 'pullRequest: issues.';

create index "issue_pull_requests_forward_id_idx" on "issue_pull_requests"(forward_id);

create index "issue_pull_requests_reverse_id_idx" on "issue_pull_requests"(reverse_id);

create table "ticket_issues" (
  "forward_id" text not null,
  "reverse_id" text not null,
  primary key(forward_id,reverse_id),
  foreign key(forward_id) references "tickets"(id) on delete cascade,
  foreign key(reverse_id) references "issues"(id) on delete cascade
);

comment on table "ticket_issues" is 'Engineering issues (ticketIssues).';

comment on column "ticket_issues"."forward_id" is 'ticket: issues.';

comment on column "ticket_issues"."reverse_id" is 'issue: tickets.';

create index "ticket_issues_forward_id_idx" on "ticket_issues"(forward_id);

create index "ticket_issues_reverse_id_idx" on "ticket_issues"(reverse_id);

-- Cross-table constraints (declared after their targets to support cycles)

alter table objects add constraint "objects_created_by_id_interface_actor_id_fkey" foreign key (created_by_id) references "interface_actor"(id) on delete restrict deferrable initially deferred;

alter table objects add constraint "objects_updated_by_id_interface_actor_id_fkey" foreign key (updated_by_id) references "interface_actor"(id) on delete restrict deferrable initially deferred;

alter table "users" add constraint "users_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "users" add constraint "users_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "service_accounts" add constraint "service_accounts_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "service_accounts" add constraint "service_accounts_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "anonymous_actors" add constraint "anonymous_actors_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "anonymous_actors" add constraint "anonymous_actors_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "groups" add constraint "groups_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "groups" add constraint "groups_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "principal_sets" add constraint "principal_sets_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "principal_sets" add constraint "principal_sets_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "group_memberships" add foreign key ("member_id") references "interface_identity"(id) on delete restrict;

alter table "group_memberships" add constraint "group_memberships_parent_group_fk" foreign key(parent_id) references "groups"(id) on delete restrict;

alter table "group_memberships" add constraint "group_memberships_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "roles" add constraint "roles_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "roles" add constraint "roles_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "role_assignments" add foreign key ("principal_id") references "interface_principal"(id) on delete restrict;

alter table "role_assignments" add foreign key ("role_id") references "roles"(id) on delete restrict;

alter table "role_assignments" add constraint "role_assignments_parent_authorization_scope_fk" foreign key(parent_id) references "interface_authorization_scope"(id) on delete restrict;

alter table "role_assignments" add constraint "role_assignments_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "assets" add constraint "assets_parent_authorization_scope_fk" foreign key(parent_id) references "interface_authorization_scope"(id) on delete restrict;

alter table "assets" add constraint "assets_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "notes" add constraint "notes_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "notes" add constraint "notes_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "activities" add foreign key ("company_id") references "companies"(id) on delete restrict;

alter table "activities" add foreign key ("contact_id") references "contacts"(id) on delete restrict;

alter table "activities" add foreign key ("deal_id") references "deals"(id) on delete restrict;

alter table "activities" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "activities" add constraint "activities_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "activities" add constraint "activities_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "companies" add constraint "companies_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "companies" add constraint "companies_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "contacts" add constraint "contacts_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "contacts" add constraint "contacts_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "leads" add foreign key ("company_id") references "companies"(id) on delete restrict;

alter table "leads" add foreign key ("converted_company_id") references "companies"(id) on delete restrict;

alter table "leads" add foreign key ("converted_contact_id") references "contacts"(id) on delete restrict;

alter table "leads" add constraint "leads_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "leads" add constraint "leads_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "deals" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "deals" add constraint "deals_parent_authorization_scope_fk" foreign key(parent_id) references "interface_authorization_scope"(id) on delete restrict;

alter table "deals" add constraint "deals_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "line_items" add constraint "line_items_parent_deal_fk" foreign key(parent_id) references "deals"(id) on delete restrict;

alter table "line_items" add constraint "line_items_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "campaigns" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "campaigns" add constraint "campaigns_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "campaigns" add constraint "campaigns_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "contents" add foreign key ("campaign_id") references "campaigns"(id) on delete restrict;

alter table "contents" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "contents" add constraint "contents_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "contents" add constraint "contents_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "enrollments" add foreign key ("campaign_id") references "campaigns"(id) on delete restrict;

alter table "enrollments" add foreign key ("contact_id") references "contacts"(id) on delete restrict;

alter table "enrollments" add constraint "enrollments_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "enrollments" add constraint "enrollments_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "outreaches" add foreign key ("campaign_id") references "campaigns"(id) on delete restrict;

alter table "outreaches" add foreign key ("contact_id") references "contacts"(id) on delete restrict;

alter table "outreaches" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "outreaches" add constraint "outreaches_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "outreaches" add constraint "outreaches_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "issues" add foreign key ("project_id") references "projects"(id) on delete restrict;

alter table "issues" add foreign key ("assignee_id") references "users"(id) on delete restrict;

alter table "issues" add constraint "issues_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "issues" add constraint "issues_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "projects" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "projects" add constraint "projects_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "projects" add constraint "projects_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "repositories" add foreign key ("project_id") references "projects"(id) on delete restrict;

alter table "repositories" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "repositories" add constraint "repositories_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "repositories" add constraint "repositories_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "pull_requests" add foreign key ("repository_id") references "repositories"(id) on delete restrict;

alter table "pull_requests" add constraint "pull_requests_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "pull_requests" add constraint "pull_requests_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "tickets" add foreign key ("company_id") references "companies"(id) on delete restrict;

alter table "tickets" add foreign key ("requester_id") references "contacts"(id) on delete restrict;

alter table "tickets" add foreign key ("owner_id") references "users"(id) on delete restrict;

alter table "tickets" add constraint "tickets_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "tickets" add constraint "tickets_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "replies" add foreign key ("ticket_id") references "tickets"(id) on delete restrict;

alter table "replies" add constraint "replies_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "replies" add constraint "replies_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "escalations" add foreign key ("ticket_id") references "tickets"(id) on delete restrict;

alter table "escalations" add foreign key ("issue_id") references "issues"(id) on delete restrict;

alter table "escalations" add constraint "escalations_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;

alter table "escalations" add constraint "escalations_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;

alter table "contact_primary_company" add constraint "contact_primary_company_membership_fk" foreign key(forward_id,reverse_id) references "contact_companies"(forward_id,reverse_id) on delete cascade;

-- Application infrastructure

create table "identity_bindings" (
  "issuer" text not null,
  "subject" text not null,
  "identity_id" text not null,
  "created_at" timestamptz not null default now(),
  primary key(issuer,subject),
  foreign key(identity_id) references interface_identity(id) on delete cascade
);

comment on table "identity_bindings" is 'Maps verified provider subjects to local identities. Credentials remain provider-owned.';

create table "asset_blobs" (
  "asset_id" text not null,
  "bytes" bytea not null,
  primary key(asset_id),
  foreign key(asset_id) references assets(id) on delete cascade
);

comment on table "asset_blobs" is 'Local asset payloads; business-facing file metadata lives on the asset record.';

create table "asset_references" (
  "record_id" text not null,
  "field" text not null,
  "asset_id" text not null,
  primary key(record_id,field),
  foreign key(record_id) references objects(id) on delete cascade,
  foreign key(asset_id) references assets(id) on delete restrict
);

comment on table "asset_references" is 'Tracks which record fields retain an asset and prevents deletion while referenced.';

create index asset_references_asset_id_idx on asset_references(asset_id);

create table "event_journal_state" (
  "id" integer not null,
  "position" bigint not null default 0,
  primary key(id)
);

comment on table "event_journal_state" is 'One row locked at commit to assign journal positions in commit order.';

create table "event_journal" (
  "position" bigint not null,
  "id" text not null,
  "transaction_id" text not null,
  "type" text not null,
  "version" integer not null,
  "subjects" jsonb not null,
  "actor_id" text not null,
  "data" jsonb not null,
  "occurred_at" timestamptz not null,
  "recorded_at" timestamptz not null default clock_timestamp(),
  primary key(position),
  unique(id)
);

comment on table "event_journal" is 'Append-only business facts recorded atomically with the writes they describe.';

comment on column "event_journal"."subjects" is 'Historical subject snapshots deliberately have no live foreign keys; they survive record deletion.';

create index event_journal_type_position_idx on event_journal(type,position);

create function reject_event_journal_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'The event journal is append-only' using errcode = '55000';
end;
$$;

create trigger event_journal_append_only before update or delete on event_journal for each statement execute function reject_event_journal_mutation();

create table "record_search" (
  "id" text not null,
  "title" text not null,
  "subtitle" text,
  "image" jsonb,
  "status" text,
  "document" tsvector not null,
  primary key(id),
  foreign key(id) references objects(id) on delete cascade
);

comment on table "record_search" is 'Rebuildable search projection. Live records remain authoritative for identity and access.';

create index record_search_document_idx on record_search using gin(document);

create table "search_index_state" (
  "id" integer not null,
  "definition" text not null,
  primary key(id)
);

comment on table "search_index_state" is 'Tracks the search projection definition so changes trigger an atomic rebuild.';

create table "seed_runs" (
  "name" text not null,
  "parameters" text not null,
  "completed_at" timestamptz not null default now(),
  primary key(name)
);

comment on table "seed_runs" is 'Development scenario receipts, separate from business records and system bootstrap.';

insert into event_journal_state (id, position) values (1, 0);
