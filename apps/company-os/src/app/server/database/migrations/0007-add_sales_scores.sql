-- Scores start unassessed; preserve existing records without inventing values.
alter table companies add column fit_score integer;
alter table contacts add column relationship_strength integer;
alter table deals add column health_score integer;
