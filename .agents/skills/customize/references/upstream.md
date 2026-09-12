# Upstream updates

Verify the source and merge base, isolate unrelated work, and resolve conflicts from upstream and
company intent. Follow the pre-release storage policy in [AGENTS.md](../../../../AGENTS.md).
For unrelated materialized history, recover the recorded
source revision and integrate only its delta; `--allow-unrelated-histories` alone is not sufficient.
If provenance is missing, ask for it. Record the new baseline and verify the resulting change.
