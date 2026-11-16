# Vendored geo-query-wasm

A temporary copy of [SchmidtDSE/geo-query-wasm](https://github.com/SchmidtDSE/geo-query-wasm)
with changes to `zonal_stats`, so the app can use them before they are released upstream. It is
listed in `HACKS.md`.

- **Source:** tag `v0.6.0`, commit `727f39f1050432aef594c665e6e99e4c3d32e748`.
- **Copied:** `src/`, `vendor/` (`src/server.js` imports `../vendor/mcp-server-sdk.js`) and
  `LICENSE`. Everything else the worker needs (DuckDB-wasm, geotiff.js, geo-query's guidance)
  still loads from jsDelivr.
- **License:** Apache-2.0, in `LICENSE`.
- **The changes,** all in `src/zonal.js`:
  - **A `histogram` statistic.** n increasing `breaks` make n + 1 bins: below the first,
    `[b[k-1], b[k])` between, and at or above the last.
    - The output is one row per zone and bin with `lower`, `upper` (null for an open end),
      `count`, and the `sum` and `mean` of the values in the bin.
    - These are weighted by coverage under the area and exact rules, and scaled when read from an
      overview.
    - The last bin's `mean` is the mean above a threshold.
  - **An exact pixel rule,** `pixel_rule: "exact"`. Each pixel is weighted by the area of its
    square inside the zone, as exactextract computes it.
    - Holes and multipolygons are handled, and rings may run either way round.
    - It works in one pass over each zone's edges, accumulating covered area along each pixel
      row (`exactCoverage`).
    - It is faster than the 64-point `"area"` rule: about 21 ms against 300 ms for a
      2,000-vertex zone over a million pixels, in Node.
  - **Hectares beside counts.** When the raster's CRS is in true ground metres (UTM zones and
    common equal-area systems, not Web Mercator), every row with a count also has `hectares`, and
    the tool's output states the pixel area. Models converted pixel counts to hectares by hand and
    sometimes got it 10× wrong; now they read the column.
- **`zonal-stats.patch`:** the full diff against v0.6.0, including the README lines and the tests
  in `test/zonal.test.js` (not copied here). Apply it to a geo-query-wasm checkout with
  `git apply` to open the upstream PR.
  - In that checkout, `test/zonal.test.js` passes all 44 tests.
  - The whole suite passes (118 tests) under Node 20. Under Node 18, `test/hex.test.js` fails
    on v0.6.0 itself, because Node 18 has no global `crypto`.

Don't edit `src/` here except by changing the patch to match. To remove this copy, see the
geo-query-wasm group in `HACKS.md`.
