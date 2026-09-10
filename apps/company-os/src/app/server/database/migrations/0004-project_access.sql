-- Preserve retired configuration outside each application's active schema.
-- Hash non-public schema names to keep archive names unique and within PostgreSQL's identifier limit.
do $$
declare
  archive_schema text := case when current_schema() = 'public' then 'company_os_archive'
    else 'company_os_archive_' || md5(current_schema()) end;
  retired_table text;
begin
  execute format('create schema if not exists %I', archive_schema);
  execute format('revoke all on schema %I from public', archive_schema);
  execute format('create table %I.access_v1 (object jsonb not null, data jsonb not null, aliases jsonb not null)', archive_schema);
  foreach retired_table in array array['groups', 'group_memberships', 'roles', 'role_assignments', 'principal_sets'] loop
    execute format(
      'insert into %I.access_v1 select to_jsonb(o), to_jsonb(d), coalesce((select jsonb_agg(to_jsonb(a)) from record_aliases a where a.object_id = o.id), ''[]''::jsonb) from objects o join %I d on d.id = o.id',
      archive_schema, retired_table);
  end loop;
  execute format('create table %I.scope_placement_v1 as select id, parent_id, ancestor_ids from objects where object_type in (''asset'', ''deal'')', archive_schema);
  execute format('create table %I.identity_state_v1 as select id, status from users union all select id, status from service_accounts', archive_schema);
end;
$$;

-- Retain commercial Links while removing former scope placement.
alter table assets drop constraint assets_parent_authorization_scope_fk;
alter table deals drop constraint deals_parent_authorization_scope_fk;
alter table assets drop constraint assets_object_parent_fk;
alter table deals drop constraint deals_object_parent_fk;
update assets set parent_id = 'platform_system';
update deals set parent_id = 'platform_system';
update objects set parent_id = 'platform_system' where object_type in ('asset', 'deal');
-- Descendants retain their ownership, with ancestry rebuilt from the remaining parent chain.
with recursive ancestry as (
 select id, array[]::text[] as ids from objects where parent_id is null
 union all
 select child.id, array[parent.id] || parent.ids from objects child join ancestry parent on child.parent_id = parent.id
)
update objects o set ancestor_ids = ancestry.ids from ancestry where o.id = ancestry.id;
set constraints all immediate;
alter table assets add constraint assets_object_parent_fk foreign key (id, parent_id) references objects (id, parent_id) on delete cascade;
alter table deals add constraint deals_object_parent_fk foreign key (id, parent_id) references objects (id, parent_id) on delete cascade;
drop table role_assignments, group_memberships, roles, groups, principal_sets;
drop table interface_principal, interface_authorization_scope;
delete from objects where object_type in ('group', 'groupMembership', 'role', 'roleAssignment', 'principalSet');
set constraints all immediate;
alter table objects drop constraint objects_object_type_check;
alter table "assets" add constraint "assets_parent_root_fk" FOREIGN KEY (parent_id) REFERENCES roots(id) ON DELETE RESTRICT;
alter table "deals" add constraint "deals_parent_root_fk" FOREIGN KEY (parent_id) REFERENCES roots(id) ON DELETE RESTRICT;
alter table "objects" add constraint "objects_object_type_check" CHECK ((object_type = ANY (ARRAY['root'::text, 'user'::text, 'serviceAccount'::text, 'anonymousActor'::text, 'asset'::text, 'moduleSetting'::text, 'note'::text, 'activity'::text, 'company'::text, 'contact'::text, 'lead'::text, 'deal'::text, 'lineItem'::text, 'campaign'::text, 'content'::text, 'enrollment'::text, 'outreach'::text, 'issue'::text, 'project'::text, 'repository'::text, 'pullRequest'::text, 'jobPosting'::text, 'candidate'::text, 'application'::text, 'ticket'::text, 'reply'::text, 'escalation'::text])));

-- Local status flags are retired with local authorization.
alter table users drop column status;
alter table service_accounts drop column status;
