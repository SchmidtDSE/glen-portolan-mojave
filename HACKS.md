# Hacks ledger

Each entry is a temporary workaround and the change that retires it. Done when empty.

The hacks are grouped by what they wait on. When a blocker clears, run its check, remove every
hack in its group together, then do the re-test listed for that group.

## Blocked on fire-recovery-backend re-running Eureka

**Blocker:** the Eureka collection has no `renders` and no collection title, and it puts all three
indices in one `severity` item. The backend plans one item per index (see `PORTOLAN_UPDATES_V2.md`).

**Check it has cleared:** the collection or its items carry `renders`, and the items are `dnbr`,
`rdnbr` and `rbr`.

| Hack | Why | Remove by |
|---|---|---|
| Eureka severity: per-asset `rescale` (dNBR `-0.1,0.66`, RdNBR `0,0.8`, RBR `0,0.5`), `colormap: rdylgn_r` and `display_name` | Without `renders` the assets say `viridis`, and outliers in the band statistics (e.g. RBR max 204.6) make the default stretch draw one solid colour | Shrinking the entry to the URL plus the new item list |

**Untested:** Rung 1's checks haven't been run in a browser: the three indices drawing with
sensible colours over the perimeter, and the chat switching and recolouring them. Run them now,
and again after the re-run, since the layer ids change with the item layout.

## Blocked on the backend publishing fire perimeters

**Blocker:** the fire's own catalog has no perimeter; it waits on the backend's `geometry_kind`
request field.

| Hack | Why | Remove by |
|---|---|---|
| Eureka perimeter comes from CAL FIRE's statewide `firep` collection, filtered to `FIRE_NAME == "EUREKA"` and `YEAR_ == 2025` | No perimeter in the fire's catalog. The filter's types match the tiles (`FIRE_NAME` string, `YEAR_` number; checked 2026-11-14) | Pointing the perimeter entry at the fire's own perimeter and dropping the filter |

## Blocked on glen core

**Blocker:** glen draws item assets only when `items` names them, and its MCP plugin lists only
collection-level Parquet `data` assets for SQL.

| Hack | Why | Remove by |
|---|---|---|
| Every layer listed under `items` (vegetation and Eureka severity) | Both catalogs keep their data in items. glen core draws item assets only when `items` names them (needs glen ≥ v3.51.1, hence the pin bump) | glen drawing item assets without config, or the catalogs publishing collection-level assets |
| SQL sees no vegetation or severity tables (only the CAL FIRE `firep.parquet`) | The vegetation Parquet files are item assets, and severity is COG only | glen listing item Parquet assets for the vegetation tables; Rung 2's `zonal_stats` for the severity COGs |

## Blocked on geo-query-wasm releasing the `zonal_stats` changes

**Blocker:** `zonal_stats` in geo-query-wasm v0.6.0 lacks three things the demo needs:

- a `histogram` statistic, for "area with RBR ≥ t" questions;
- a sum and mean per bin, for "mean RBR above t";
- an exact pixel rule, for exactextract-level numbers.

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
- **2026-11-16, the per-bin sum and mean, and `pixel_rule: "exact"`:** the unit tests pass (40
  in `zonal.test.js`). In a browser, the same question under the exact rule gave 6.0 pixels with
  mean RBR 0.526, and the total coverage (86.47 ha) matched the perimeter's area to within 0.06 %.

Re-test after removing the hack: the same question should give the same answers under all three
rules.
