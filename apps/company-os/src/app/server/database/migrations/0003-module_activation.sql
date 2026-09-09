-- Store module activation without changing existing business records.
-- The system seed initializes installed modules and preserves subsequent choices.
alter table "objects" drop constraint "objects_object_type_check";
alter table "objects" add constraint "objects_object_type_check" check ("object_type" in (
    'root',
    'user',
    'serviceAccount',
    'anonymousActor',
    'group',
    'principalSet',
    'groupMembership',
    'role',
    'roleAssignment',
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
  ));

create table "module_settings" (
  "id" text not null,
  -- Ownership parent. References roots.id.
  "parent_id" text not null,
  "module_id" text not null,
  "enabled" boolean not null,
  primary key ("id"),
  foreign key ("id") references "objects" ("id") on delete cascade
);

create index "module_settings_parent_id_idx" on "module_settings" ("parent_id");
create unique index "module_settings_module_unique" on "module_settings" ("module_id");

alter table "module_settings"
  add constraint "module_settings_parent_root_fk"
  foreign key ("parent_id") references "roots" ("id")
  on delete restrict;

alter table "module_settings"
  add constraint "module_settings_object_parent_fk"
  foreign key ("id", "parent_id") references "objects" ("id", "parent_id")
  on delete cascade;
