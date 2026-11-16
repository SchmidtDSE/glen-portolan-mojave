# Plan: GLEN app over JOTR Portolan catalogs

A dev loop for a static glen core app over two Portolan catalogs: an NPS vegetation map
built by a colleague, and the fire-recovery-backend burn-severity catalogs. Hacks are
expected while the catalogs settle. Each one goes in `HACKS.md` with the change that
retires it, and the work is done when that table is empty.

Facts below were checked on 2026-11-13 and 2026-11-14. The design behind the severity side is in
fire-recovery-backend's `PORTOLAN_UPDATES_V2.md`.

## Status (2026-11-15)

- **Rung 0:** config is in, served from a local mirror. The park boundary draws; the vegetation
  polygons don't. Parked until the vegetation catalog is reworked (see `HACKS.md`).
- **Rung 1:** config is in. RBR and the CAL FIRE perimeter look right in the browser. dNBR, RdNBR
  and the chat checks haven't been run yet.
- **Rung 2:** done on branch `jotr-zonal-stats`. The config-only `zonal_stats` test passed, and
  the vendored `histogram` passed in a browser on 2026-11-15.
- **Rung 4 (planned 2026-11-15):** the demo questions. The approximate route is H3 from the
  backend; the exact route is `zonal_stats` on the COG. Details are in `AGGREGATION.md`; the
  tiers are in `TIERS.md`.

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
- **2026-11-15: two routes for the demo, agreed with the backend.**
  - The demo questions:
    - where the fire was most severe;
    - hectares and mean RBR by vegetation class above the analyst's thresholds;
    - Joshua tree climate futures from the USGS SDM.
  - The analyst chooses the breaks. Nothing stores classes.
  - **The COG is the source of truth** for exact numbers and maps. No pixel table and no pixel
    PMTiles: they would turn the raster into vectors.
  - **Exact route:** `zonal_stats` on the COG. Zones come from exact vector SQL (vegetation ×
    SDM × perimeter). It is near exact under `pixel_rule: "area"`, and exact after we add an
    exact pixel rule.
  - **Approximate route:**
    - the backend's opt-in hex tables (`options.h3_resolutions: [12, 13]`, in a `{fire_id}-hex`
      collection);
    - drawn with glen's `hex.js` from tiles geo-query-wasm builds in the browser;
    - the only browser path for raster × raster.
  - **Route default, the user's decision:** approximate by default with exact on request, or
    exact for every reported number (the backend's view).
  - **Close enough means within about 1 ha per fire.**
  - **BAER is the baseline, never the comparison.** The app is BAER's dNBR plus the analyses
    BAER doesn't offer. It is never "faster BAER", and no number is set beside a BAER product's.
  - **The contract** (request options, hex schema, backend steps, joint benchmark) is the
    backend's "Aggregation workplan", final for this round.
  - Charts come from glen core's `plugins/charts.js`. glen-charts doesn't fit: it's a separate
    dashboard library on H3 at resolutions 8–10.
  - **Wanted upstream in glen:** drawing a geometry a tool returns, and a stepped raster colour
    map. How charts take exact numbers and how hex tools are worded are general glen
    questions; hack them for the demo if needed.
  - **Deferred:** the Nautilus exactextract MCP tool. CORS on the vegetation host will be fixed
    and isn't planned here.
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
- **Result, 2026-11-15: passed.** In a browser, the vendored `histogram` with `breaks: [0.5]`
  gave 6 pixels (2,400 m², 0.24 ha) under both the centre rule and `pixel_rule: "area"`, out of
  2,158 inside the perimeter.
  - **Seen in passing:** the model called RBR ≥ 0.5 "high-severity burn". That's a class name
    the analyst didn't give. The phase 1 prompt (1d) should forbid naming classes the user
    didn't define.

## Rung 3: retire hacks as upstream and backend changes land

- **Vegetation host fixes CORS:** point at the live URL, delete `dev-catalog/` and put
  `pixi run serve` back on `http.server` (the first group in `HACKS.md`). Then re-run Rung 0's
  checks, starting with whether the vegetation polygons draw.
- **Backend re-runs Eureka** (one item per index, collection title, `renders`, AGENTS.md):
  drop the per-asset `rescale`, `colormap` and `display_name`. The entry shrinks to the URL
  plus the item list.
- **Then:** enable Pages from `main`.

## Rung 4: aggregation for the demo questions

The full requirements are in `AGGREGATION.md`, and the routes are in `TIERS.md`.

### Sequence

The demo needs nothing new from glen: hex tiles, charts and `zonal_stats` all work at v3.51.1.
The main dependency is the backend's step 5 (the resubmitted fires).

**Phase 0: finish Rung 2 (branch `jotr-zonal-stats`).**

- Run the vendored `histogram` in a browser: "area with RBR ≥ 0.5 inside the perimeter" should
  give 6 pixels at the centre rule. **Done 2026-11-15** (see Rung 2).

**Phase 1: work that doesn't wait on the backend (in parallel).**

| # | Work | Branch |
|---|---|---|
| 1a | Per-bin sum and an exact `pixel_rule` in the vendored geo-query-wasm, with tests and the upstream patch. **Done 2026-11-15**; browser check passed 2026-11-16 | `jotr-exact-zonal` |
| 1b | Config: `charts.js`, `hex.js`, `register_hex_tiles` and `get_hex_tile_status`. Check against the current Eureka COG | `jotr-demo-config` |
| 1c | Browser checks (below). Their results decide whether the recipes need changing | `jotr-demo-config` |
| 1d | System prompt via `system_prompt_url`: framing, breaks, method labels, and the route default once decided | `jotr-demo-config` |
| 1e | Early run of benchmark row 4 on the published v2 Eureka COG, with the EDA's `JOTR_VegPolys`. Proves the recipe; rerun in phase 2 | none |
| 1f | SDM: the user downloads it; convert it and write a Portolan collection. Needs a host | `jotr-sdm` |
| 1g | Fix AGENTS.md's out-of-date line on hex tiles | `jotr-demo-config` |

**Upstream, in parallel, written up for the user to file** (in priority order):

1. geo-query-wasm PR: `histogram`, the per-bin sum and the exact rule.
2. glen: draw a geometry a tool or query returns.
3. glen: a stepped colour map or `expression` in `set_raster_colormap`.
4. glen: list item-level Parquet for SQL.
5. glen: one discussion issue on charts from non-`query` tools, hex tool wording, and exact or
   approximate route language.

**Demo workarounds if glen is slow:**

- Hex wording and route language go in the prompt.
- Exact numbers reach charts as `data` from `zonal_stats`.
- Anything needing our own JavaScript is asked of the user first. This repo's rules allow only
  the vendored worker.

**Phase 2: when the backend delivers step 5.**

- Swap in the resubmitted Eureka and add Black Rock, with their perimeter and hex collections.
- Retire the CAL FIRE perimeter hack, and the per-asset `rescale` and `colormap` if the new
  catalogs carry `renders`.
- Run benchmark row 4 for real, and confirm r12 and r13 from row 5.
- Run the coarse-level experiment.
- Tell the backend whether to drop the `h3` string column and whether to pre-compute any coarse
  level.
- Write welcome examples with real class names and analyst-stated thresholds.

**Phase 3: as glen releases land.**

- Move the glen pin (all six URLs; check jsDelivr returns 200).
- Turn on the new tools, and remove the demo workarounds they replace.
- When the geo-query-wasm release is out: point the worker back at it, delete
  `plugins/geo-query-wasm/`, and close that `HACKS.md` group.

**Phase 4: demo-ready.**

- "Done when" (below) passes for both fires.
- `HACKS.md` lists only known leftovers.
- Pages is enabled from `main` (Rung 3).

**Decisions waiting on the user:**

- the route default (blocks the route part of 1d);
- where the SDM collection is hosted (blocks 1f);
- PR #46: close or rework (the backend's work);
- whether our own JavaScript is allowed as a temporary workaround.

### Backend (theirs; for reference)

In order, each a PR to their `dev`:

1. Merge `v2-perimeter-catalog` (`geometry_kind: "perimeter"`, `{fire_id}-perimeter`).
2. PR #46: they recommend closing it and starting fresh. The user decides.
3. `options.h3_resolutions` and the `{fire_id}-hex` collection.
   - Columns: `h{n}`, `h10`, `h8` (UBIGINT); `h0`; a string `h3`; `rbr`, `dnbr` and `rdnbr`.
   - Each cell is a cell-centre sample. Rows are sorted by cell, with collection-level assets.
4. The benchmark script: exactextract on `refined_rbr.tif` and on the v2 COG, and every H3
   level from r13 to r8.
5. Deploy, then resubmit Eureka and Black Rock as perimeter requests with
   `h3_resolutions: [12, 13]`, and hand us the catalog URLs.

### Exact route (this repo)

- **Done 2026-11-15 (branch `jotr-exact-zonal`).** Added to the vendored geo-query-wasm
  `zonal_stats`:
  - `pixel_rule: "exact"`, which weights each pixel by the area of its square inside the zone,
    as exactextract does;
  - `sum` and `mean` per `histogram` bin, so the last bin's `mean` is the mean above t (the EDA's
    mean is over the RBR > 0 area only).

  About the implementation and tests:
  - It's one pass over each zone's edges, faster than the 64-point area rule.
  - 40 tests in `zonal.test.js`. They check exact shares, the sum against the polygon's
    area, agreement with dense sampling, holes, multipolygons, ring direction and windows.
  - The upstream suite passes (114 tests, Node 20).
  - `histogram.patch` became `zonal-stats.patch`, and `HACKS.md` is updated.
- **Browser check** for the new features. Under each of the three rules, ask "area with
  RBR ≥ 0.5 inside the Eureka perimeter, and the mean RBR of those pixels". Expect 6 pixels at
  the centre rule, and a `mean` column in the histogram rows.
  - **Result, 2026-11-16: passed** for the exact rule. 9 steps, 53 s. RBR ≥ 0.5 gave 6.0
    pixels (0.24 ha), mean RBR 0.526 (sum 3.155). Below 0.5 gave 2,155.81 pixels, mean 0.232.
    The six pixels lie wholly inside the perimeter, so all three rules agree on them.
  - Total coverage is 2,161.81 pixels (86.47 ha). The perimeter's own figure is 213.8 acres
    (86.52 ha), so the two agree to within 0.06 %. That figure was probably computed in another
    projection.
  - **Seen again:** the model called the patch "high-severity" (for 1d). It also called
    `zonal_stats` twice, the second time only to get JSON, and ran five `query` steps first.
    The 1d recipe should cut those.
- Run benchmark row 4 in a browser for Eureka and Black Rock:
  - hectares and mean RBR by `MapUnit_Name`, within RBR > 0 (`breaks: [1e-9]`);
  - under the centre, area and exact rules.
  - **Zones:** the vegetation **not** clipped to the CAL FIRE perimeter. The EDA's area is
    vegetation ∩ the RBR > 0 pixels, and some fall outside the perimeter (Black Rock: 32.07 ha
    against CAL FIRE's 26.9 ha).
  - Check which vegetation source matches the EDA's `JOTR_VegPolys`.

### Approximate route (this repo)

- Add glen core's `plugins/hex.js` (option `geo_query_wasm: "v0.6.0"`).
- Add `register_hex_tiles` and `get_hex_tile_status` to the MCP entry's `include`.
- Add the `{fire_id}-hex` collections once they are published.
- Confirm r12 and r13 from benchmark row 5 in a browser.
- Coarse-level experiment, in SQL over `hex-r13.parquet` alone: a parent mean, a per-cell
  histogram, and the centre child (`h3_cell_to_center_child`). Ask the backend to pre-compute
  a level only if it's worth the storage.
- If the recipes never use the string `h3` column, tell the backend it can drop it.

### App config and prompt

- Add glen core's `plugins/charts.js` after the MCP entry.
- Add the SDM host to `allowedDirectories` (and the vegetation host, once its CORS is fixed).
- Route language in the tool descriptions and system prompt:
  - the route default, once the user decides it;
  - never choose breaks;
  - name the method and resolution in every answer.
- Framing in the welcome text, examples and prompt:
  - BAER's dNBR plus arbitrary zones, the analyst's thresholds, RBR and RdNBR, and recovery over
    time;
  - never "faster BAER", and no comparison with a BAER product.
- Demo hacks, if needed, each logged in `HACKS.md`:
  - feed exact `zonal_stats` rows to `render_chart`;
  - override `register_hex_tiles`' "only for density" wording.
- Fix AGENTS.md's out-of-date line that glen can't draw geo-query-wasm's hex tiles (`hex.js`
  exists at v3.51.1).

### Upstream, written up for the user (not patched here)

- glen: a tool to draw a geometry that a tool or query returns.
- glen: an interval colour map or `expression` in `set_raster_colormap`, for the exact
  single-raster "where".
- glen: list item-level Parquet for SQL.
- glen: general questions on charts from non-`query` tools, hex tool wording, and exact or
  approximate route language.
- geo-query-wasm: `histogram`, then the exact `pixel_rule`.

### Joshua tree SDM

- ScienceBase item `67a2c062d34e91a4ffc72e88` refuses automated fetches, so download the files
  by hand.
- Convert them to GeoParquet (EPSG:4326) and PMTiles, and publish them as a Portolan collection
  with collection-level assets.
- Record the attributes and scenarios for the prompts.

### Check in a browser

- The `h3` extension loads.
- `h3_polygon_wkt_to_cells`, `h3_cell_area` and `h3_cell_to_center_child` exist, with the names
  and types the recipes assume (UBIGINT cells).
- `ST_Union_Agg` is available.
- Whether `render_chart` stacks or groups bars by `series`.

### Done when

On the resubmitted Eureka and Black Rock, with a threshold the user chooses:

- "where is RBR ≥ t in Joshua tree woodland" draws hex cells;
- "exact hectares and mean RBR by vegetation class" is charted, and matches the benchmark:
  - the exact rule is within floating point of the backend's exactextract;
  - `pixel_rule: "area"` and r13 are within 1–2 % per class;
- the same question by the approximate route gives a labelled hex estimate;
- "what does the SDM predict for the burned Joshua tree woodland" answers per scenario.

## Later (don't start yet)

- An `exact_zonal` MCP tool on Nautilus (Python exactextract) for arbitrary zones and large
  areas.
- Exact clipped footprints (threshold, polygonize, intersect), once glen can draw a returned
  geometry.
- An MTBS join recipe.
- The fire's own perimeter: a `{fire_id}-perimeter` collection in its analysis catalog (backend
  branch `v2-perimeter-catalog`). Replaces the CAL FIRE filter.
- A couple of nearby fires in one app.
- A backend script that writes `layers-input.json` from a finished job.

## Rules

- Branch per rung. Don't push or open PRs without asking.
- Never commit API keys (`config.json` is git-ignored).
- Upstream problems (glen, geo-query-wasm, a catalog host, the backend) get written up for the
  user, not patched here. The one exception is the vendored geo-query-wasm (Rungs 2 and 4).
- Before pinning a new glen or geo-query-wasm ref, check that jsDelivr returns `HTTP/2 200`
  for it.
