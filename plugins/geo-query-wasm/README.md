# Vendored geo-query-wasm

A temporary copy of [SchmidtDSE/geo-query-wasm](https://github.com/SchmidtDSE/geo-query-wasm)
with one change, so the app can use it before it is released upstream. It is listed in `HACKS.md`.

- **Source:** tag `v0.6.0`, commit `727f39f1050432aef594c665e6e99e4c3d32e748`.
- **Copied:** `src/`, `vendor/` (`src/server.js` imports `../vendor/mcp-server-sdk.js`) and
  `LICENSE`. Everything else the worker needs (DuckDB-wasm, geotiff.js, geo-query's guidance)
  still loads from jsDelivr.
- **License:** Apache-2.0, in `LICENSE`.
- **The change:** a `histogram` statistic for `zonal_stats`, in `src/zonal.js`. n increasing
  `breaks` make n + 1 bins: below the first, `[b[k-1], b[k])` between, and at or above the last.
  The output is one row per zone and bin with `lower`, `upper` (null for an open end) and `count`,
  weighted by coverage under `pixel_rule: "area"` and scaled when read from an overview.
- **`histogram.patch`:** the full diff against v0.6.0, including the README line and the tests
  in `test/zonal.test.js` (not copied here). Apply it to a geo-query-wasm checkout with
  `git apply` to open the upstream PR. In that checkout, `npx vitest run test/zonal.test.js`
  passes all 27 tests.

Don't edit `src/` here except by changing the patch to match. To remove this copy, see the
geo-query-wasm group in `HACKS.md`.
