# Plan: GLEN app over JOTR Portolan catalogs

A dev loop for a static glen core app over two Portolan catalogs: an NPS vegetation map
built by a colleague, and the fire-recovery-backend burn-severity catalogs. Hacks are
expected while the catalogs settle. Each one goes in `HACKS.md` with the change that
retires it, and the work is done when that table is empty.

Facts below were checked on 2026-11-13. The design behind the severity side is in
fire-recovery-backend's `PORTOLAN_UPDATES_V2.md`.

## Starting state

- **This repo:** a copy of glen-portolan-template at `ced79b3`. GitHub Pages isn't enabled.
  This repo's AGENTS.md limits edits to `layers-input.json`, the `<title>`, the glen pin and
  the geo-query-wasm pin. No JavaScript of our own; the one exception is Rung 2.
- **Branch `first-light-jotr-vegmap`** (uncommitted when handed over) already holds Rung 0:
  - the glen pin bump;
  - the new `layers-input.json`;
  - the title;
  - `HACKS.md`;
  - the `dev-catalog/` ignore line.

  Re-create the mirror with the command in `HACKS.md`.
- **Why glen v3.51.1:** v3.47.0 has no `items` support, and both catalogs keep their data in
  items. All six `glen@` URLs (five in `index.html`, one in `layers-input.json`) must name
  the same ref. jsDelivr serves v3.51.1, and the third-party libraries match the template's,
  so SRI hashes are unchanged.

## Decisions

- **2026-11-13: no mirror.** We wait for the vegetation host to send CORS headers instead of
  serving `dev-catalog/`. The vegetation entry points at the live URL and loads once the host
  is fixed. Rung 0's checks wait until then.
- **2026-11-13: Rung 1 config is in.** The severity, perimeter and vegetation entries all live
  in `layers-input.json`. The map opens on the burn scar (−116.33, 34.07, z13). Only RBR is
  switched on at start, so the three indices don't stack. dNBR and RdNBR are one click away.
- **Dev tools:** the container has `pixi` (Python 3.12 and `pmtiles`) but no `git`, `curl` or
  `unzip`. Those will come from pixi or the Dockerfile.

## Rung 0: first light on the vegetation catalog

Catalog: `https://jotr-nps-portolan.org/catalog.json`.

- **What's there:** one collection, `jotr-vegmap`, with no collection-level assets. Two items,
  `park-boundary` and `vegetation-map`, each with GeoParquet (`data`) and PMTiles (`visual`)
  under `../../assets/`. License CC0-1.0. `inspect_collection.py` reports "nothing to draw"
  because it doesn't look inside items.
- **Blocker: no CORS.** The host (Apache) sends no `Access-Control-Allow-Origin` on any file.
  Range requests work.
  - Ask the owner to add `Access-Control-Allow-Origin: *` and expose
    `Range, Content-Range, Accept-Ranges, ETag`.
  - Until then, serve a git-ignored mirror (`dev-catalog/`, about 63 MB) with the app from
    `python3 -m http.server 8000`, so it's same-origin.
- **Config:** one collection entry pointing at the mirror, with
  `items: ["park-boundary", "vegetation-map"]`.
  - Boundary: outline only (`default_style` fill-opacity 0 plus `outline_style`).
  - Vegetation: default paint. 67 map units is too many for a hand-written `match`.
- **Tile fields (from PMTiles metadata):**
  - boundary: `Park_Code`, `Park_Name`, `State`, `Acres`, `Hectares`;
  - vegetation, 16,499 polygons: `Poly_ID`, `MapUnit_ID`, `MapUnit_Name`, `Acres`, `Hectares`.
- **Real names for examples:** `Joshua Tree Woodland Alliance`;
  `Creosote Bush - White Bursage Shrubland Association` (the largest by acreage).
- **Done when:**
  - both layers appear in the panel and draw;
  - the console shows no `[Portolan]` warnings;
  - the chat can filter on `MapUnit_Name` with a user's OpenRouter key.
- **Expected gap:** SQL lists no tables. glen's MCP plugin lists only collection-level
  Parquet `data` assets, and local `http://` paths aren't in geo-query-wasm's allowed list.
  Keep it in `HACKS.md`; it's a candidate glen issue.

## Rung 1: add the burn-severity catalog

No mirror is needed for this one.

- **Eureka collection:**
  `https://storage.googleapis.com/dse-nps-fire-severity-storage/v2/fires/eureka-9c3382ee/eureka-9c3382ee/collection.json`.
  CORS `*`, Range and anonymous listing work, and NRP TiTiler reads the COGs.
- **Item config:** `items: [{ "id": "severity", "assets": [...] }]` with per-asset hacks until
  the backend publishes `renders`. The default stretch draws one solid colour because of
  outliers in the current data.
  - `dnbr`: `rescale "-0.1,0.66"`;
  - `rdnbr`: `rescale "0,0.8"`;
  - `rbr`: `rescale "0,0.5"`;
  - colormap `rdylgn_r` for all three.
- **Perimeter layer:**
  `https://s3-west.nrp-nautilus.io/public-fire/calfire-2025/firep/stac-collection.json`,
  which has a `rel: pmtiles` link and published styles.
  - Filter to Eureka 2025: unit JTP, alarm 2025-05-30, 214 acres.
  - Check the field names in the PMTiles metadata first. The Parquet has `FIRE_NAME` and
    `YEAR_`, but tiles can carry fewer fields.
- **Expect the layout to change:** the backend is moving to one item per index (`dnbr`,
  `rdnbr`, `rbr`). Keep the Eureka entry easy to edit.
- **Done when:** the three indices draw with sensible colours over the perimeter, and the
  chat can switch and recolour them.

## Rung 2: native-resolution stats with `zonal_stats`

- **Turn it on:** in the MCP plugin's server entry, set:
  - `worker_config`: `"zonalStats": true`;
  - `include`: `["query", "zonal_stats"]`;
  - `allowedDirectories`: the severity bucket's https prefix plus the defaults still needed
    (NRP, `s3://`). A list replaces geo-query-wasm's defaults; check the exact format in its
    README.
- **First test:** "mean RBR inside the Eureka perimeter", with the zone from CAL FIRE's
  `firep.parquet`. This checks the open question of whether geotiff.js decodes the severity
  COGs (DEFLATE with the floating-point predictor).
  - Reference values (current data): 2,158 pixels inside the perimeter (213.3 acres) and mean
    RBR 0.234.
- **Vendor the worker (a deliberate workaround):**
  - Copy geo-query-wasm v0.6.0's `src/` (Apache-2.0; keep its LICENSE and note the source
    commit) into `plugins/geo-query-wasm/`.
  - Point `plugins/geo-query-worker.js` at the local copy.
  - Add a `HACKS.md` row, retired when the change lands upstream and the pin returns to a
    release.
- **The change:** add a `histogram` statistic to `zonal_stats` in `zonal.js` with
  caller-supplied `breaks`.
  - Output: one row per (zone, bin) with a count, coverage-weighted under
    `pixel_rule: "area"`. Same output shape as `classes`.
  - The accumulation is in `summarize()`.
  - Keep it a small diff so it can go upstream as a PR.
- **Done when:** "area with RBR ≥ 0.5 inside the perimeter" returns 6 pixels at the
  pixel-centre rule (current data), and the area-weighted variant runs.

## Rung 3: retire hacks as upstream and backend changes land

- **Vegetation host fixes CORS:** point at the live URL and delete `dev-catalog/`.
- **Backend re-runs Eureka** (one item per index, collection title, `renders`, AGENTS.md):
  drop the per-asset `rescale`, `colormap` and `display_name`. The entry shrinks to the URL
  plus the item list.
- **Then:** enable Pages from `main`.

## Later (don't start yet)

- h10 hex tables and an MTBS join recipe.
- The fire's own perimeter catalog, once the backend's `geometry_kind` request field exists.
- A couple of nearby fires in one app.
- A backend script that writes `layers-input.json` from a finished job.

## Rules

- Branch per rung. Don't push or open PRs without asking.
- Never commit API keys (`config.json` is git-ignored).
- Upstream problems (glen, geo-query-wasm, a catalog host, the backend) get written up for the
  user, not patched here. The one exception is the vendored worker in Rung 2.
- Before pinning a new glen or geo-query-wasm ref, check that jsDelivr returns `HTTP/2 200`
  for it.
