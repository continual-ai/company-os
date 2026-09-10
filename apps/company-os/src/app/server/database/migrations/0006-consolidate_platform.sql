-- The core objects keep their existing IDs and tables. Only the two retired
-- activation records disappear; Platform now owns their always-enabled capabilities.
delete from objects
where id in (
  select id from module_settings where module_id in ('access', 'assets')
);
