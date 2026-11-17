# Portolan to glen: Joshua Tree fire demo

**The question:** how far does a stock [glen](https://github.com/SchmidtDSE/glen) app get on real burn-severity analysis questions, given Portolan catalogs as published and only configuration on our side?

**The data:** two 2025 fires in Joshua Tree NP. Each has severity COGs (RBR, dNBR, RdNBR; 20 m, EPSG:32611), a perimeter and H3 hex tables at r12 and r13. Alongside them are the park's vegetation map and boundary.

State as of 2026-11-17 (glen v4.0.6).

## Outcome

- **It works for a demo.** With no changes to glen core, the app answers questions like "hectares and mean RBR per vegetation class above a threshold I choose", draws hex maps of where a condition holds, and charts the results. A question takes 1 to 3 tool calls and 6 to 70 s.
- **The numbers are right when the tools get the right arguments.** Exact answers match an independent reference (rasterio and shapely) to within 0.03 ha. H3 r13 answers are within about 1 % of exact for every vegetation class over 1 ha.
- **What it took:**
  - four additions to geo-query-wasm's `zonal_stats` (vendored here until upstream);
  - a modified system prompt;
  - choosing a model that keeps tool arguments;
  - small catalog changes by the publishers.
- **What remains unreliable:** some OpenRouter providers strip array arguments from tool calls. Exact answers then fail, though since the latest prompt they fail honestly. See [Testing](#testing).
- **What Portolan gave us for free:**
  - layers, styles (`renders`), licences and perimeters, all found from the catalogs;
  - the hex tables, added as one more collection;
  - the move to the final catalogs, which was a config edit.

## Upstream asks

### 1. geo-query-wasm

**PR ready:** [`plugins/geo-query-wasm/zonal-stats.patch`](plugins/geo-query-wasm/zonal-stats.patch) is the full diff against v0.6.0 (727f39f), tests included. The upstream suite passes, 118/118 on Node 20.

| Change to `zonal_stats` | Why |
|---|---|
| `histogram` statistic with caller-given `breaks`, giving `lower`/`upper`/`count` per bin | "Hectares with RBR ≥ t" on a continuous raster. `classes` is for categorical rasters only |
| `sum` and `mean` per bin | "Mean RBR of the pixels above t" |
| `pixel_rule: "exact"` | Weights each pixel by the exact share of its square inside the zone, as exactextract does. One pass over zone edges, faster than the existing 64-point `area` rule |
| `hectares` beside every count, when the raster's CRS is in ground metres (UTM, NAD83 UTM, common equal-area CRSs) | Models convert pixel counts to hectares in their heads and get it wrong (10× errors). The allowlist of metre CRSs is a judgement call reviewers may want to change |

**To raise with the maintainers:**

- Should `stats` and `breaks` also accept strings (`"histogram"`, `"0.1, 0.27"`)? String arguments survive the OpenRouter providers that strip arrays (glen feature request 2 below). This is a workaround for a provider bug, so it's their call.
- **Hex guidance:** `h3_polygon_wkt_to_cells` returns no cells for a MULTIPOLYGON, so split with `ST_Dump` first. Also, `register_hex_tiles` says it is "only for density", which made models hesitate to use it for threshold maps. This ties to glen design question 1.

### 2. glen

#### Bugs

- **The raster legend reads "0 dimensionless0.5 dimensionless".**
  The unit is repeated after every tick with no space; a unitless index should show no unit at all.
- **Chart x-axis labels clip long class names.**
  Vegetation class names run past 50 characters, so the labels need wrapping or rotating.

Fixed upstream: the vegetation PMTiles never drew because glen v3 gave the park boundary and vegetation items one source id (glen#492, fixed in v4.0.2).

#### Feature requests

In order of value:

1. **List item-level Parquet for SQL, and draw item assets without `items` in the config.** Both catalogs keep their data in items. Without this, the model can't find the vegetation table, so we hard-code every data path in the prompt. In short: glen should natively follow Portolan's item and asset layout (it already reads `items.parquet` for time series, but still needs the app to list items to draw).
2. **OpenRouter provider preferences in the `llm` config,** e.g. `provider: { ignore: [...] }`. In raw responses:
   - **InferenceNet** dropped `stats`/`breaks` from 34 of 36 `zonal_stats` calls;
   - **OpenInference** dropped them from 14 of 21;
   - every other provider kept them.

   OpenRouter picks the provider per request, so the same chat passes one run and fails the next. This is what we first blamed on DeepSeek V4 Flash. Hosts differ because each runs its own serving stack, whose chat template and tool-call parser sit between the model and the JSON tool call; the model's reasoning named the arrays, but the parsed call lacked them.
3. **Draw a geometry a tool returns.** That gives exact clipped footprints, the exact answer to "where".
4. **An interval colour map or `expression` in `set_raster_colormap`.** It would draw the COG stepped at the analyst's threshold, an exact single-raster "where". Today "where" maps use hex.
5. **Charts fed by tools other than `query`.** Today rows from `zonal_stats` reach `render_chart` by passing through the model as `data`. That's fine for tens of rows but doesn't scale.

#### Design questions

1. **May "where" answers be approximate?** Until glen can draw exact footprints (feature requests 3 and 4), the only way to map "where RBR ≥ t" is H3 hex tiles.
   - `register_hex_tiles`' description ("only for density"; see geo-query-wasm) steers models away from that.
   - We allowed hex for maps and labelled it approximate (with the assumption that accurate metrics on number of affected hectares for eg is likely more important than map precision on viewing where those areas are, particularly if the hex is fine enough)
   - Should glen allow hex as the default answer to "where", with a label, or keep it opt-in? Depends on direct render of tool-response Geometries
2. **Exact versus approximate, and who chooses.** We made exact the default for every reported number and hex the default for maps. Should glen define this split and its wording, or leave it to each app? We enforce exact only through our prompt (the tool itself defaults to the centre rule), and glen's full-app prompt does the opposite, preferring hex paths for SQL.
3. **Every number from a tool.** Models did arithmetic in their heads and got it wrong (10× errors). Our prompt forbids this: sums and percentages go through `query`, and areas come from tool output. Is that a sensible default for glen's base prompt whenever SQL tools are loaded? glen has no calculator tool, so without SQL there's no way to follow this rule.
4. **Domain classes belong to the user.** We stopped the model from naming severity classes ("high", "low") or picking thresholds itself. That rule is app-specific, but glen could offer a general hook for "terms the model must not introduce". GLEN is used in other policy-oriented applications (for eg the GYE / Yellowstone work), but neither glen prompt has an interpretation rule like this, so any pattern would live in those apps' own prompts.

### 3. Portolan (publishers and conventions)

| To | Ask |
|---|---|
| Fire-severity backend | **Drop the `h3` string column.** It duplicates `h13`, is 18 % of the r13 file, and no recipe or `hex.js` reads it |
| Vegetation host | **`versions.json`,** which `portolan clone` needs |
| Portolan conventions | **Data assets in items or at the collection level?** Clients and publishers should agree; see glen feature request 1 |
| Portolan conventions | **A way for a COG collection to point to its hex companion** (`{fire}-hex`). Today the link is by name only, and our prompt lists the paths |
| Portolan conventions | **Recommend `renders`.** It replaced all our per-layer styling config |

## What this repo contains

The repo holds configuration only, plus one vendored worker. [HACKS.md](HACKS.md) tracks each workaround and what retires it.

- **[`layers-input.json`](layers-input.json):** for each fire, severity (one item per index, RBR on) and the perimeter outline, plus the vegetation map and park boundary. It loads the plugins `mcp.js` (`query`, `zonal_stats`, hex tools), `charts.js` and `hex.js`, and lists GLM-5.3 Flash first.
- **[`system-prompt.md`](system-prompt.md):** appended to glen's short base prompt. Each rule was added after a test failed without it:
  - **full data paths and CRSs:** without them the model searched for 5 to 10 steps, and shortened paths lost the doubled `{id}/{id}/`;
  - **thresholds and classes belong to the analyst:** no "high", "moderate" or "low" unless the user defines them; values are described by index and threshold;
  - **no arithmetic in the model's head:** every number must come from a tool result, so areas come from `hectares` and sums go through `query`;
  - **exact `zonal_stats` for every reported number, hex for maps:** this route default is a decision still open below;
  - **a complete example call,** short arguments first;
  - **quote the "Pixel rule:" line,** and call a number exact only if that line says exact;
  - **a hex recipe** with `ST_Dump` and a bbox pre-filter (25 s → 8 s);
  - **a worked chart call** with numbered bins, which keeps the legend in order;
  - **answer per fire;** never add across fires.
- **[`plugins/geo-query-wasm/`](plugins/geo-query-wasm/):** v0.6.0 with the patch applied. The patch is the only JavaScript we ship. Delete the folder once upstream releases the changes.

## Precision and routes

"Exact" means exact under the pixel model: each 20 m pixel has one value, weighted by the share of its square inside the zone.

Measured on vegetation classes clipped to fire perimeters:

| Compared | Difference |
|---|---|
| Exact vs reference | within 0.03 ha |
| H3 r13 vs exact | within ~1 % for classes over 1 ha |
| H3 r12 vs exact | up to −33 % on classes under 0.5 ha |
| Pixel centre vs exact | under 0.1 ha, which matters only for classes under 0.5 ha |

These method differences are smaller than the other uncertainties: pixel size, geolocation (about a pixel), vegetation boundaries and the thresholds themselves. Exactness matters for small or thin zones, and when numbers sit beside a desktop GIS analysis. r13 is good enough everywhere we tested; r12 only for large classes.

| Question | Route |
|---|---|
| Hectares or mean index per class above t | Exact `zonal_stats`, as a table or chart |
| The same, faster or over larger areas | Hex r13, labelled approximate |
| Where index ≥ t, for any combination of layers | Hex r13 tiles on the map |
| Raster × raster numbers | Hex (an estimate) now; exact needs server-side compute (deferred) |