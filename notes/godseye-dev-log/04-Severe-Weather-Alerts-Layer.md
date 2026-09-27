---
tags: [godseye, layer, nws, weather, bug-postmortem]
created: 2026-09-27
---

# Severe Weather Alerts Layer (NWS)

Related: [[00-Overview]] · [[03-Adding-a-Data-Layer-Pattern]] · [[06-Lessons-Learned]]

The first new layer added this session. Draws live NWS active-alert polygons (tornado, flood, severe thunderstorm, etc.) on the globe, colored by CAP severity, with an ambient label per alert.

## Source

`api.weather.gov/alerts/active?status=actual&message_type=alert` — keyless, CORS-friendly public GeoJSON API, fetched **client-direct** (no server proxy needed — this is the "easy" branch of the [[03-Adding-a-Data-Layer-Pattern|pattern]]'s Step 1 decision).

## What got built

- `src/layers/nwsAlerts/records.js` — GeoJSON validation → array of `{id, event, severity, urgency, certainty, headline, areaDesc, senderName, effectiveMs, expiresMs, polygons, lon, lat}`.
- `src/layers/nwsAlerts/source.js` — the fetch.
- `src/layers/nwsAlerts/model.js` — severity → color (Extreme=red, Severe=orange, Moderate=yellow, Minor=blue, Unknown=gray), overlay label builder, analyst-record mapping.
- `src/layers/nwsAlerts/index.js` — the layer factory. Polygon rendering (fill + separate outline polylines, `ClassificationType.BOTH`) modeled on `src/layers/cyclones/rendering.js`'s exact Cesium idiom for ground-draped polygons.
- Registered token `2` in the layer-state registry, grouped under **Events** in the Data Layers panel.

Commit: `2018448` — "Add Severe Weather Alerts layer (NWS, keyless)". Verified before push: `npm test` (4,905 passing, +29 new), `check:boundaries`, `format:check`, `build`, and a headless-browser load with zero console errors (only the sandbox's expected lack-of-GPU/WebGL noise).

## The bug that shipped anyway

Despite all of the above passing, the layer showed **"Load failed" / "UNAVAILABLE · NWS · Malformed NWS alerts response"** the first time it was actually tried against live data.

**Root cause**: `records.js` was modeled directly on `src/layers/earthquakes/records.js`, which rejects the **entire snapshot** if any single feature is structurally malformed. That's a reasonable policy for USGS's small, uniform earthquake feed — but NWS's `alerts/active` is a nationwide aggregate issued independently by dozens of regional offices, with real variance in field length. A field-length cap of 800 characters on `areaDesc` (copied from a guess, not a real sample) was too tight — a real multi-county warning's `areaDesc` can run to thousands of characters — and **one such alert anywhere in the ~100+ item nationwide list was enough to blank the entire layer.**

**Diagnosis path**: rather than guess, asked the user to open Chrome DevTools → Console + Network tab and read back the actual error text. The exact string `Malformed NWS alerts response` pointed directly at the validator, ruling out a CORS/network problem in about one round-trip.

**Fix** (commit `a43a958`): changed the validation policy from *reject-the-whole-feed-on-one-bad-record* to *skip just that one record*, and widened the length caps to match real NWS data (`areaDesc` 800 → 6000 chars, `headline` 400 → 1000, geometry ring/part limits roughly doubled). Only a structurally invalid top-level payload (not a FeatureCollection at all) still rejects outright. Rewrote the test suite to assert the new skip-not-reject behavior, including a new regression test with a deliberately long, realistic `areaDesc`.

**This bug and its fix are the direct source of [[06-Lessons-Learned]].**
