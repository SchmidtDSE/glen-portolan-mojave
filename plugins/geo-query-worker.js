/**
 * The geo-query-wasm worker, started from this app's own origin.
 *
 * glen core's MCP plugin starts this file as a Web Worker for the server entry
 * in layers-input.json that names it with `worker`. A page may start a Worker
 * only from its own origin, so this file stands in for geo-query-wasm's
 * src/worker.js. The worker reads the entry's `worker_config` from this file's
 * URL (`?config=…`).
 *
 * HACK (see HACKS.md): this imports a local copy of geo-query-wasm v0.6.0 with
 * changes to zonal_stats (a `histogram` statistic with per-bin sums and means,
 * an exact pixel rule, and hectares beside counts), not a release on jsDelivr.
 * plugins/geo-query-wasm/README.md says where it came from. When the changes
 * are released upstream, go back to the pinned release:
 *
 *   import 'https://cdn.jsdelivr.net/gh/SchmidtDSE/geo-query-wasm@<tag>/src/worker.js';
 */
import './geo-query-wasm/src/worker.js';
