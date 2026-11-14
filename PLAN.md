# Plan: GLEN app over JOTR Portolan catalogs

A dev loop for a static glen core app over two Portolan catalogs: an NPS vegetation map
built by a colleague, and the fire-recovery-backend burn-severity catalogs. Hacks are
expected while the catalogs settle. Each one goes in `HACKS.md` with the change that
retires it, and the work is done when that table is empty.

Facts below were checked on 2026-11-13 and 2026-11-14. The design behind the severity side is in
fire-recovery-backend's `PORTOLAN_UPDATES_V2.md`.

## Status (2026-11-14)

- **Rung 0:** config is in, served from a local mirror. The park boundary draws; the vegetation
  polygons don't. Parked until the vegetation catalog is reworked (see `HACKS.md`).
- **Rung 1:** config is in. RBR and the CAL FIRE perimeter look right in the browser. dNBR, RdNBR
  and the chat checks haven't been run yet.
- **Rung 2:** in progress on branch `jotr-zonal-stats`. The config-only `zonal_stats` test passed;
  the `histogram` statistic is next.

## Starting state

- **This repo:** a copy of glen-portolan-template at `ced79b3`. GitHub Pages isn't enabled.
  This repo's AGENTS.md limits edits to `layers-input.json`, the `<title>`, the glen pin and
  the geo-query-wasm pin. No JavaScript of our own; the one exception is Rung 2.
- **Branch `jotr-eureka-severity`** holds Rungs 0 and 1: the glen pin bump, `layers-input.json`,
  the title, `HACKS.md`, the mirror setup and this plan. Rung 0 has no branch of its own; it
  became config waiting on the vegetation host.
- **Why glen v3.51.1:** v3.47.0 has no `items` support, and both catalogs keep their data in
  items. All six `glen@` URLs (five in `index.html`, one in `layers-input.json`) must name
  the same ref. jsDelivr serves v3.51.1, and the third-party libraries match the template's,
  so SRI hashes are unchanged.

## Decisions

- **2026-11-13: no mirror.** We would wait for the vegetation host to send CORS headers.
  Replaced the next day.
- **2026-11-14: a local mirror after all.** The vegetation entry points at a git-ignored copy in
  `dev-catalog/`, made with `curl` because `portolan clone` needs a `versions.json` the host
  doesn't publish. `pixi run serve` runs `RangeHTTPServer`, since PMTiles need byte ranges and
  `http.server` ignores them. All three are hacks in `HACKS.md`, removed when the host is fixed.
- **2026-11-14: vegetation polygons parked.** Against the mirror the boundary draws but the
  vegetation polygons don't, and the browser never requests a vegetation tile. The catalog is
  being reworked, so we re-test after that rather than chase it now.
- **2026-11-13: Rung 1 config is in.** The severity, perimeter and vegetation entries all live
  in `layers-input.json`. The map opens on the burn scar (−116.33, 34.07, z13). Only RBR is
  switched on at start, so the three indices don't stack. dNBR and RdNBR are one click away.
- **Dev tools:** the dev container has `git`, `gh`, `curl` and `unzip`, and the pixi environment
  has Python 3.12, `pmtiles`, `portolan-cli` and `rangehttpserver`. There is no browser, so
  checks that need one are done by hand.

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
    `pixi run serve`, so it's same-origin. `HACKS.md` has the command that re-creates it.
- **Config:** one collection entry pointing at the mirror
  (`http://localhost:8000/dev-catalog/jotr-vegmap/collection.json`), with
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
  - Checked 2026-11-14: the tiles carry `FIRE_NAME` (string) and `YEAR_` (number), so the
    filter matches their types.
- **Expect the layout to change:** the backend is moving to one item per index (`dnbr`,
  `rdnbr`, `rbr`). Keep the Eureka entry easy to edit.
- **Done when:** the three indices draw with sensible colours over the perimeter, and the
  chat can switch and recolour them.

## Rung 2: native-resolution stats with `zonal_stats`

- **Turn it on:** in the MCP plugin's server entry, set:
  - `worker_config`: `"zonalStats": true`;
  - `include`: `["query", "zonal_stats"]`;
  - `allowedDirectories`: v0.6.0's four defaults (`s3://`, `https://s3-west.nrp-nautilus.io/`,
    the two source.coop https prefixes) plus
    `https://storage.googleapis.com/dse-nps-fire-severity-storage/`. A list replaces the
    defaults, and each entry is a directory, so it needs the trailing slash.
- **First test:** "mean RBR inside the Eureka perimeter", with the zone from CAL FIRE's
  `firep.parquet`. This checks the open question of whether geotiff.js decodes the severity
  COGs (DEFLATE with the floating-point predictor).
  - Reference values (current data): 2,158 pixels inside the perimeter (213.3 acres) and mean
    RBR 0.234.
  - **Result, 2026-11-14: passed.** With geo-query-wasm v0.6.0 unchanged (commit `8bc7adb`),
    `zonal_stats` returned 2,158 pixels, mean 0.233733 and sum 504.395641 at the pixel-centre
    rule, matching the reference. geotiff.js decodes the severity COGs (EPSG:32611). The model
    called `get_stac_details` first and read the perimeter as
    `s3://public-fire/calfire-2025/firep.parquet`.
  - **Seen in passing:** the legend for RBR draws a grey-to-black ramp over 0–0.5 while the map
    uses `rdylgn_r`. Possibly glen's legend ignoring a per-asset `colormap`; not yet checked.
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

- **Vegetation host fixes CORS:** point at the live URL, delete `dev-catalog/` and put
  `pixi run serve` back on `http.server` (the first group in `HACKS.md`). Then re-run Rung 0's
  checks, starting with whether the vegetation polygons draw.
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
