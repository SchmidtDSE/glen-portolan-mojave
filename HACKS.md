# Hacks ledger

Each entry is a temporary workaround and the change that retires it. Done when empty.

The hacks are grouped by what they wait on. When a blocker clears, run its check, remove every
hack in its group together, then do the re-test listed for that group.

## Blocked on glen core

**Blocker:** glen draws item assets only when `items` names them, and its MCP plugin lists only
collection-level Parquet `data` assets for SQL.

| Hack | Why | Remove by |
|---|---|---|
| Every layer listed under `items` (vegetation and both fires' severity) | Both catalogs keep their data in items. glen core draws item assets only when `items` names them (needs glen ≥ v3.51.1, hence the pin bump) | glen drawing item assets without config, or the catalogs publishing collection-level assets |
| `system-prompt.md` lists the data paths (severity COGs, perimeter, hex tables, vegetation, boundary), with their CRS | glen lists only collection-level Parquet for SQL, so the model can't find the vegetation Parquet, and it spends steps looking up the rest | glen listing item Parquet assets. The fire's paths stay in the prompt until glen's catalog listing gives the model what it needs in one step |
## Blocked on geo-query-wasm releasing the `zonal_stats` changes

**Blocker:** `zonal_stats` in geo-query-wasm v0.6.0 lacks four things the demo needs:

- a `histogram` statistic, for "area with RBR ≥ t" questions;
- a sum and mean per bin, for "mean RBR above t";
- an exact pixel rule, for exactextract-level numbers;
- hectares beside each count, so the model never converts pixel counts itself.

The changes are in `plugins/geo-query-wasm/zonal-stats.patch`, ready to go upstream as a PR.

**Check it has cleared:** a geo-query-wasm release whose `src/zonal.js` has `'histogram'` in
`STATS` and accepts `pixel_rule: "exact"`, served by jsDelivr:

```bash
curl -s https://cdn.jsdelivr.net/gh/SchmidtDSE/geo-query-wasm@<tag>/src/zonal.js | grep -c "'histogram'\|'exact'"   # 2 or more
```

| Hack | Why | Remove by |
|---|---|---|
| `plugins/geo-query-worker.js` imports a local copy of geo-query-wasm v0.6.0 (`plugins/geo-query-wasm/`: `src/`, `vendor/`, `LICENSE`) with the `zonal_stats` changes, not a pinned release | The changes aren't upstream yet; `plugins/geo-query-wasm/README.md` gives the source commit and the patch | Pointing the import back at `https://cdn.jsdelivr.net/gh/SchmidtDSE/geo-query-wasm@<tag>/src/worker.js` and deleting `plugins/geo-query-wasm/` |

**Tested:**

- **2026-11-15, `histogram`:** the unit tests pass, and in a browser "area with RBR ≥ 0.5 inside
  the perimeter" gave 6 pixels under both the centre rule and `pixel_rule: "area"`.
- **2026-11-16, `hectares`:** unit-tested (44 in `zonal.test.js`, 118 upstream). In a browser the model
  reported areas from the column (Eureka, RBR ≥ 0.5: 0.24 ha) and made no hand conversions.
- **2026-11-16, the per-bin sum and mean, and `pixel_rule: "exact"`:** the unit tests pass (40
  in `zonal.test.js`). In a browser, the same question under the exact rule gave 6.0 pixels with
  mean RBR 0.526, and the total coverage (86.47 ha) matched the perimeter's area to within 0.06 %.

Re-test after removing the hack: the same question should give the same answers under all three
rules.
