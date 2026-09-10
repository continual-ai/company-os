-- Ownership remains in parent_id. Historical event subjects and archived scope
-- placements are retained unchanged; new events no longer copy ancestry.
alter table objects drop column ancestor_ids;
