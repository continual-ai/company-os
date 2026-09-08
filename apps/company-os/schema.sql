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
  constraint objects_object_type_check check (object_type in ('root', 'user', 'serviceAccount', 'anonymousActor', 'group', 'principalSet', 'groupMembership', 'role', 'roleAssignment', 'asset')),
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

-- Relationships: association pairs and cardinality constraints

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
