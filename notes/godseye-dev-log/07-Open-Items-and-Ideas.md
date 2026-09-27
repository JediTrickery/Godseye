---
tags: [godseye, todo, ideas, backlog]
created: 2026-09-27
---

# Open Items & Ideas

Related: [[00-Overview]]

## Done this session
- [x] [[04-Severe-Weather-Alerts-Layer|Severe Weather Alerts]] (NWS) — built, bug found and fixed.
- [x] [[05-Air-Quality-Layer|Air Quality (AQI)]] (AirNow) — built, verified against real data.
- [x] Cesium ion, TomTom, NASA FIRMS, AISStream keys configured — see [[02-Provider-Keys-and-Power-Up]].

## New data layer ideas (not built, all free/keyless in principle)
- **Wildfire parity with Watch Duty** — WFIGS incidents/perimeters, more FIRMS sources, GOES fire detections, river gauges, firefighting-aircraft filter and more. Full breakdown and build order in [[08-Watch-Duty-Feed-Parity]].
- **GDACS** — global disaster alerts (floods, cyclones, volcanoes, droughts) with severity ratings; broader-hazard-coverage cousin of the earthquake layer.
- **NOAA Space Weather** — aurora forecast / solar flare activity. Thematically relevant since the app already tracks real satellites, which is exactly what solar storms threaten.
- **Cloudflare Radar** — real-time internet outage/connectivity data by country. A completely different category (infrastructure, not physical-world hazard) from everything else in the app.

## Remaining free keys not yet grabbed
- **OpenSky** (registered account) — raises the flight-polling rate limit above the working anonymous default. Not urgent.
- **Launch Library 2** (token) — same idea for the Space Missions layer. Not urgent.

## Your own build requests, still open
1. **POWER UP panel UI extension** — add input fields so custom sources (starting with your own property camera) can be configured through the app's own settings UI, rather than hand-editing `config/*.json` files. Explicitly deferred so it wouldn't get bundled into an unrelated commit; hasn't been started.
2. **Your own property camera as a CCTV source** — the app already supports single-camera curated sources (see the Warendorf, Germany example: `config/cctv_sources.warendorf.json`, one municipal webcam). Adding yours needs: a reachable snapshot/HLS stream URL for the camera, and its lat/lon + rough compass heading + mount height. Two open scope questions from that conversation, still unanswered:
   - Will the app's server run on the same network as the camera (simple case — no internet exposure needed), or does the camera need to be reachable from outside your network too?
   - If the latter: needs a deliberate choice about how to expose it (port forward, dynamic DNS, or a tunnel like Tailscale/Cloudflare Tunnel) — flagged as worth being careful about, not just wiring open.
3. **NJDOT / 511NJ traffic cameras** — checked; unlike Austin, TxDOT, Caltrans, and TfL (all of which the app already integrates via documented open JSON catalogs), New Jersey's DOT does not appear to publish a public camera API — only human-facing viewer pages at `dot.nj.gov` and `511nj.org`. Not attempted, on the grounds that scraping an undocumented endpoint not meant for that risks violating its terms. Would need NJDOT to publish something programmatic first, or a different NJ data source to turn up.

## Explicitly ruled out
- **Google Maps key** — not needed; Cesium ion already provides the same photorealistic-3D capability for free within its quota.
- **OpenRouter for voice** — technically incompatible as things stand; see [[02-Provider-Keys-and-Power-Up]] for why.
