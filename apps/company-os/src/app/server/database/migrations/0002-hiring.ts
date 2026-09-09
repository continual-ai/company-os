import type { SchemaMigration } from "#/runtime/server/migrations.ts"

/** Adds the hiring records without rewriting the applied initial baseline. */
export const hiringMigration = {
  id: 2,
  name: "hiring",
  sql: `
alter table objects drop constraint objects_object_type_check;

alter table objects add constraint objects_object_type_check check (object_type in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'asset', 'note', 'activity', 'company', 'contact', 'lead', 'deal', 'lineItem', 'campaign', 'content', 'enrollment', 'outreach', 'issue', 'project', 'repository', 'pullRequest', 'jobPosting', 'candidate', 'application', 'ticket', 'reply', 'escalation'));

create table "job_postings" (
  "id" text not null,
  "parent_id" text not null,
  "title" text not null,
  "description" text not null,
  "department" text,
  "location" text,
  "employment_type" text not null default 'fullTime',
  "status" text not null default 'draft',
  "hiring_manager_id" text,
  "published_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "job_postings" is 'Job posting (jobPosting). A role your company is hiring for.';
comment on column "job_postings"."id" is 'Same identity as the corresponding row in objects.';
comment on column "job_postings"."parent_id" is 'Ownership parent implementing root.';
create index "job_postings_parent_id_idx" on "job_postings"(parent_id);
create index "job_postings_hiring_manager_id_idx" on "job_postings"("hiring_manager_id");

create table "candidates" (
  "id" text not null,
  "parent_id" text not null,
  "name" text not null,
  "email" text not null,
  "phone" text,
  "linkedin_url" text,
  "portfolio_url" text,
  "resume" jsonb,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "candidates" is 'Candidate (candidate). A person who may apply for one or more roles.';
comment on column "candidates"."id" is 'Same identity as the corresponding row in objects.';
comment on column "candidates"."parent_id" is 'Ownership parent implementing root.';
create index "candidates_parent_id_idx" on "candidates"(parent_id);
create unique index "candidates_email_unique" on "candidates" ("email");

create table "applications" (
  "id" text not null,
  "parent_id" text not null,
  "job_id" text not null,
  "candidate_id" text not null,
  "stage" text not null default 'new',
  "source" text not null default 'unknown',
  "cover_letter" text,
  "resume" jsonb,
  "rating" integer,
  "review_notes" text,
  primary key (id),
  foreign key (id) references objects(id) on delete cascade
);

comment on table "applications" is 'Application (application). A candidate''s application for a specific job posting.';
comment on column "applications"."id" is 'Same identity as the corresponding row in objects.';
comment on column "applications"."parent_id" is 'Ownership parent implementing root.';
create index "applications_parent_id_idx" on "applications"(parent_id);
create index "applications_job_id_idx" on "applications"("job_id");
create index "applications_candidate_id_idx" on "applications"("candidate_id");
create unique index "applications_candidate_job_unique" on "applications" ("candidate_id", "job_id");

alter table "job_postings" add foreign key ("hiring_manager_id") references "users"(id) on delete restrict;
alter table "job_postings" add constraint "job_postings_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;
alter table "job_postings" add constraint "job_postings_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;
alter table "candidates" add constraint "candidates_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;
alter table "candidates" add constraint "candidates_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;
alter table "applications" add foreign key ("job_id") references "job_postings"(id) on delete restrict;
alter table "applications" add foreign key ("candidate_id") references "candidates"(id) on delete restrict;
alter table "applications" add constraint "applications_parent_root_fk" foreign key(parent_id) references "roots"(id) on delete restrict;
alter table "applications" add constraint "applications_object_parent_fk" foreign key(id,parent_id) references objects(id,parent_id) on delete cascade;
`.trim(),
  schemaHash:
    "67bca0adb935af22bbdcf7c7c45033b520ce9c9f62a6cd1e0b687c01664a9884",
} as const satisfies SchemaMigration
