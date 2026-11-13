# Hacks ledger

Each entry is a temporary workaround and the change that retires it. Done when empty.

| Hack | Why | Retired by |
|---|---|---|
| The vegetation entry points at the live `https://jotr-nps-portolan.org/jotr-vegmap/collection.json`, which browsers can't read yet; the app skips it with a `[Portolan]` console warning | That host sends no `Access-Control-Allow-Origin` (checked 2026-11-13). We chose to wait for the fix rather than serve a local mirror | The host adds `Access-Control-Allow-Origin: *` and exposes `Range`, `Content-Range`, `Accept-Ranges` and `ETag`. Nothing in this repo changes; the layers appear on the next load |
| Every layer listed under `items` (vegetation and Eureka severity) | Both catalogs keep their data in items. glen core draws item assets only when `items` names them (needs glen ≥ v3.51.1, hence the pin bump) | glen drawing item assets without config, or the catalogs publishing collection-level assets |
| Eureka severity: per-asset `rescale` (dNBR `-0.1,0.66`, RdNBR `0,0.8`, RBR `0,0.5`), `colormap: rdylgn_r` and `display_name` | The item has no `renders`, its assets say `viridis`, and outliers in the band statistics (e.g. RBR max 204.6) make the default stretch draw one solid colour | fire-recovery-backend re-runs Eureka with `renders`, a collection title and one item per index; the entry shrinks to the URL plus the item list |
| Eureka perimeter comes from CAL FIRE's statewide `firep` collection, filtered to `FIRE_NAME == "EUREKA"` and `YEAR_ == 2025` | The fire's own catalog has no perimeter | The backend publishing the fire's own perimeter (`geometry_kind` request field) |
| SQL sees no vegetation or severity tables (only the CAL FIRE `firep.parquet`) | glen's MCP plugin lists only collection-level Parquet `data` assets; the vegetation Parquet files are item assets, and severity is COG only | glen listing item Parquet assets, then Rung 2's `zonal_stats` for the COGs |
