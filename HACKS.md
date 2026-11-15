# Hacks ledger

Each entry is a temporary workaround and the change that retires it. Done when empty.

The hacks are grouped by what they wait on. When a blocker clears, run its check, remove every
hack in its group together, then do the re-test listed for that group.

## Blocked on the vegetation host (`jotr-nps-portolan.org`)

**Blocker:** the host sends no `Access-Control-Allow-Origin` and publishes no `versions.json`
(checked 2026-11-13 and 2026-11-14). The data itself is fine.

**Check it has cleared:**

```bash
curl -sI -H 'Origin: http://example.org' https://jotr-nps-portolan.org/jotr-vegmap/collection.json | grep -i access-control
curl -s -o /dev/null -w '%{http_code}\n' https://jotr-nps-portolan.org/jotr-vegmap/versions.json   # 200
```

| Hack | Why | Remove by |
|---|---|---|
| The vegetation entry in `layers-input.json` points at a local mirror, `http://localhost:8000/dev-catalog/jotr-vegmap/collection.json`, so it loads only from `pixi run serve` at the repository root. `dev-catalog/` is git-ignored (63 MB); re-create it with the command below | Without CORS, browsers can't read the host from another origin. The URL must be absolute: glen reads a bare path as a collection id | Pointing the entry back at `https://jotr-nps-portolan.org/jotr-vegmap/collection.json` and deleting `dev-catalog/` |
| The mirror is made with `curl` and a hand-written file list, not `portolan clone` (`portolan-cli` is in the pixi environment) | `portolan clone` reads each collection's `versions.json`; the host returns 404 for it, for the root `versions.json` and for `.portolan/config.yaml`. The items' assets also sit outside the collection, under `../../assets/` | Deleting the mirror once CORS works. If a mirror is still wanted, `pixi run portolan clone <catalog URL> dev-catalog` once `versions.json` exists |
| `pixi run serve` runs `RangeHTTPServer` (PyPI `rangehttpserver`), not `python -m http.server` | The PMTiles in `dev-catalog/` are read by byte range, and `http.server` ignores `Range` (it returns the whole 30 MB file with a 200) | Deleting the mirror. Then set the `serve` task in `.devcontainer/pixi.toml` back to `python -m http.server 8000` and run `pixi remove --pypi rangehttpserver` |

**Untested:** Rung 0's checks haven't passed yet: both vegetation layers appearing and drawing, no
`[Portolan]` warnings, and the chat filtering on `MapUnit_Name`. Run them again against the live URL
once the host is fixed.

**Known issue, not chased (2026-11-14):** against the mirror, the park boundary draws but the
vegetation polygons don't, even when ticked and zoomed in. The server log shows the browser reading
`vegetation-map.pmtiles` only twice (header and metadata) and never requesting a tile. The file
itself looks sound: zoom 8–14, one `vegetation-map` layer with 16,499 polygons, the same extent as
the boundary, which draws. The catalog is being reworked, so re-test after that before digging in.

### Re-creating the vegetation mirror

From the repository root:

```bash
B=https://jotr-nps-portolan.org
for f in catalog.json AGENTS.md README.md \
         jotr-vegmap/collection.json jotr-vegmap/AGENTS.md jotr-vegmap/README.md \
         jotr-vegmap/park-boundary/park-boundary.json \
         jotr-vegmap/vegetation-map/vegetation-map.json \
         assets/park-boundary.parquet assets/park-boundary.pmtiles \
         assets/vegetation-map.parquet assets/vegetation-map.pmtiles; do
  curl -sfS --create-dirs -o "dev-catalog/$f" "$B/$f" || echo "failed: $f"
done
```

The list covers every file that the catalog, collection and items link to. If the catalog gains an
item or asset, add it here.

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
- **The per-bin sum and mean, and `pixel_rule: "exact"`:** the unit tests pass (40 in
  `zonal.test.js`). Not yet run in a browser.

Re-test after removing the hack: the same question should give the same answers under all three
rules.
