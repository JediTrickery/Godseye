---
tags: [godseye, pattern, architecture, layers]
created: 2026-09-27
---

# Adding a Data Layer — The Reusable Pattern

Related: [[00-Overview]] · [[04-Severe-Weather-Alerts-Layer]] · [[05-Air-Quality-Layer]] · [[06-Lessons-Learned]]

This is the distilled, repeatable recipe for adding a new live data layer to God's Eye View, extracted from actually doing it twice ([[04-Severe-Weather-Alerts-Layer|NWS Alerts]] and [[05-Air-Quality-Layer|AirNow AQI]]). If a third layer gets added later, this note should still be accurate — follow it top to bottom.

## The mental model

A "layer" in this app is always the same shape, regardless of what data it shows:

```
raw upstream data → validate/normalize → snapshot → render as Cesium entities
```

Every existing layer (earthquakes, cyclones, FIRMS, the two built this session) follows this. The differences between layers are just: does normalization happen on the client or the server, and how complex is the rendering.

## Step 0 — Pick a template layer, don't start from scratch

Before writing anything, find the **existing layer most similar in shape** to what you're building and read it fully. This app has ~30 layers; one of them is almost always close enough to steal the skeleton from.

- **Point markers, client-direct fetch, no server involvement** → template on `src/layers/earthquakes/` (USGS feed, CORS-friendly JSON, no key).
- **Polygon/area geometry, client-direct fetch** → template on `src/layers/cyclones/` for the validation rigor, but note it also has camera-follow/selection complexity that a simpler polygon layer (like NWS alerts) doesn't need — earthquakes' lifecycle shape (`init/enable/disable/update/destroy`) is usually the better skeleton even for polygon data.
- **Data that needs server-side fetching** (large/non-JSON payload, unverified CORS, secrets, or heavy caching) → template on `server/providers/cyclones.js` or `server/providers/firms.js` for the proxy shape.

Both `earthquakes` and `firms` turned out to have **thousands of lines** across many files once you count viewport clustering, selection UI, and cinematic camera integration — that level of polish is real but not required for a first version. Both new layers this session deliberately scoped down to a simpler, still-real, still-tested version rather than trying to match that full fidelity on the first pass.

## Step 1 — Decide: client-direct fetch, or server proxy?

| | Client-direct | Server proxy |
|---|---|---|
| When | Upstream is JSON, confirmed CORS-friendly, small-to-medium payload | Upstream is non-JSON (CSV, `.dat`), CORS unverified, needs caching/dedup, or needs a secret key |
| Example | NWS Alerts (`api.weather.gov` — documented CORS-friendly public API) | AirNow AQI (large quoted-CSV file, CORS unverified from the dev sandbox, benefits from a shared cache since ~2,000 rows shouldn't be re-parsed per browser tab) |
| Client source shape | Fetches the upstream URL directly | Fetches `/api/<name>` (your own new server route) |

If server-proxy: the server does the heavy validation/parsing (see AirNow's `parseAirNowCsv`), and the **client still re-validates the server's own output** before touching Cesium — this project never trusts a payload across a network boundary, even its own. See `validateAirQualitySnapshot` / `validateCycloneSnapshot` for the pattern: re-check every field's type/range, don't just trust the shape.

## Step 2 — The client layer's four files

Under `src/layers/<name>/`:

1. **`records.js`** (or the validation lives in `model.js` for a client-direct layer) — pure functions, no Cesium/DOM. Takes raw upstream JSON, returns either a clean array of records or `null`/throws on structurally invalid input.
   - **Critical design decision**: does one malformed *individual record* reject the **entire** snapshot, or just get skipped? See [[06-Lessons-Learned]] — this is the single most consequential decision and got it wrong the first time.
2. **`source.js`** — the actual `fetch()` call (or, for a server-proxied layer, a call to your own `/api/...` route), wrapped in an abortable, timeout-bounded `getSnapshot({signal})` function.
3. **`model.js`** — presentation-layer pure functions: a color/category mapping (severity, AQI category, etc.), an "ambient overlay label" entry builder + cohort-selection function (see below), and `mapAnalystRecord()` for voice-query support.
4. **`index.js`** — the actual layer factory: `create<Name>Layer({source, overlayHost})`, implementing the standard lifecycle interface:
   ```js
   { id, name, icon, source, updateInterval,
     init(viewer), enable(viewer), disable(viewer),
     async update(viewer), destroy(viewer),
     getAnalystRecords(maxCount), getStats() }
   ```
   `update()` is the core: abort any in-flight request, fetch a snapshot, build fresh Cesium entities, swap them into a `CustomDataSource`, update the ambient-label overlay, and — this matters — **guard every awaited step against having been disabled/destroyed/superseded while it was in flight** (`if (request.signal.aborted || _request !== request || !_enabled) return false;`). Every existing layer does this; skipping it is how you get a "ghost" layer that keeps drawing after being turned off.

### The "ambient overlay label" sub-pattern

Layers with many entities (earthquakes, NWS alerts, AQI) don't label every single one — that would be visual noise and a performance problem. Instead:
- Every entity still gets a plain Cesium marker (point/polygon).
- Only the **highest-priority** entities (by magnitude, by severity, by AQI) get a text label, via a shared `overlayHost` service and a `selectXCohort(entries, limit)` helper that sorts by priority and slices to a cap (`COHORT_LIMIT`, typically 32–96).

## Step 3 — Wiring (five small edits to existing files)

This is where a correctly-built layer silently does nothing until every one of these is done. All five are one or two lines each:

1. **Register the source.** Client-direct → add to `createReferenceSources()` in `src/sources/reference.js`. Server-proxied → add to `createStandaloneLayerSources()` in `src/standalone/layerSources.js` instead.
2. **Server route** (proxied layers only): add the new provider's plugin to the array in `server/providers/local.js`.
3. **App-level wiring file**: `src/app/layers/<name>.js` — a two-line file that just injects the shared `overlayHost` into your layer factory (copy any existing one, e.g. `src/app/layers/earthquakes.js`).
4. **Catalog registration**: `src/app/constructCatalog.js` — three edits: an import, an entry in `SOURCE_METHODS` (`<name>: ['getSnapshot']`), and a `create...({source: sources.<name>})` push into the layers array.
5. **Layer-state registry** (`src/data/layerState.js`, `LAYER_STATE_REGISTRY`): a `{id, token, disposition}` entry. This is what makes the layer serializable into share links and give it a keyboard shortcut. **The array must stay alphabetically sorted by `id`** — a test enforces this (`layerState.test.mjs`, `assert.deepEqual(REGISTERED_LAYER_IDS, [...REGISTERED_LAYER_IDS].sort())`). The `token` must be a single character matching `[a-z0-9]` (not uppercase, not punctuation) and unique — check what's free before picking one; by the time the second new layer was added, every lowercase letter and the digit `1` were already taken, so this pool runs out faster than it looks.
6. **UI grouping**: `src/ui/layerPanel.js`, `PANEL_GROUPS` — add the id to whichever named group fits (`Movement`, `Cameras`, `Infrastructure`, `Events`, `Weather`, `Utilities`). This is what actually makes the toggle appear in the Data Layers panel and where.

## Step 4 — The boundary manifest (the part that isn't obvious)

This project enforces a strict module-ownership check (`npm run check:boundaries`, backed by `scripts/package-boundaries.json`) — every `package.json` "export" declares exactly which source files it's allowed to transitively import, and a real Vite build is run per export group to catch violations. **Adding new files will almost always fail this check the first time**, with an error like:
```
Package boundary application-components imports an unowned module: src/layers/<name>/records.js
```
Fix: find every place the *previous, most-similar* layer's files are listed in `scripts/package-boundaries.json` (`grep -n "earthquakes" scripts/package-boundaries.json` or similar) and add your new layer's equivalent files at each of those same points. In practice this is **2–3 broad groups** (`application-components`, `application-layer-construction`, and — only for client-direct layers registered in `reference.js` — `reference-sources`). Re-run `check:boundaries` after each fix; it stops at the first violation, so expect to iterate 2–3 times.

## Step 5 — Tests

Write real tests, not padding, for:
- `records.js`/`model.js` validation — happy path, and one test per rejection reason. **Explicitly test what happens with a mix of one good record and one bad one** (see [[06-Lessons-Learned]]).
- `source.js` — success, non-ok HTTP status, malformed payload, already-aborted signal. Mock `fetch` at the `fetchImpl` injection point every layer's source factory exposes for exactly this reason.
- `index.js` lifecycle — a `harness()` helper (copy `src/layers/earthquakes/ownership.test.mjs`) that fakes `viewer.dataSources` and `overlayHost`, then exercises: normal update, late-refresh-after-disable/destroy, two independent layer instances not sharing state, and `getAnalystRecords()` gated on `enabled`.

Then, before committing:
```bash
npm run check:boundaries
npm test
npm run format        # auto-fixes; re-run format:check after
npm run build
```
All four must pass clean. This project has ~4,900 tests and treats that bar as normal, not aspirational — see [[06-Lessons-Learned]] for what that actually bought us.

## Step 6 — One golden-count gotcha

Two tests hardcode the total layer count and will fail (correctly) after adding a layer:
- `src/data/layerState.test.mjs` — `assert.equal(REGISTERED_LAYER_IDS.length, N)`
- `src/app/constructCatalog.test.mjs` — `assert.equal(first.layers.length, N)` (this one is `LAYER_STATE_REGISTRY.length + 1`, because it also counts the hardware-local `local-adsb` layer which isn't in the registry)

Bump both `N`s by one. This is intentional, not a bug to work around — it's the project's way of forcing every new layer to be deliberately counted rather than silently appearing.

## Commit discipline

Each layer went in as **one isolated commit**, separate from any bug fix for it. This is what made the [[04-Severe-Weather-Alerts-Layer|NWS bug]] cheap to fix — `git revert` or `git reset` to the prior commit was always a real, safe option, and the fix itself was its own small commit rather than an amended history rewrite.
