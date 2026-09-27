---
tags: [godseye, layer, airnow, air-quality]
created: 2026-09-27
---

# Air Quality (AQI) Layer (AirNow)

Related: [[00-Overview]] · [[03-Adding-a-Data-Layer-Pattern]] · [[06-Lessons-Learned]]

The second new layer, built immediately after the [[04-Severe-Weather-Alerts-Layer|NWS layer's]] bug — deliberately built with a verify-before-code approach as a direct result.

## What it shows

Live EPA AirNow AQI readings worldwide (not just the US — the network includes Canada, Mexico, and U.S. State Department air-quality posts abroad, e.g. Tashkent, Uzbekistan), as colored point markers using the standard EPA category colors (Good green → Hazardous maroon), with labels on Unhealthy-or-worse sites.

## Source: this is where verification actually mattered

Original plan was to use AirNow's official REST API, which turned out to require a free signup key — fine, but its documentation (`docs.airnowapi.org`) was **unreachable from this session's sandboxed network**, same restriction hit earlier for `api.weather.gov`. Research (web search) surfaced a better option anyway: AirNow publishes a **keyless bulk file**, `HourlyAQObs_<yyyymmddhh>.dat`, at `files.airnowtech.org`, updated twice hourly, covering ~4,400 sites — no signup needed at all.

The catch: it's a legacy quoted-CSV text file, not a documented JSON API, and web search only returned **partial, truncated** field-list summaries of it — never a verified, complete schema. Given the NWS layer had *just* shipped a bug from an unverified assumption about real-world data shape, building blind against a *second*, even less-standard, unverified format was judged too risky to repeat.

**What happened instead**: asked the user to open the actual file URL in their browser and upload the real downloaded file. That real file was inspected directly:
```
"AQSID","SiteName","Status","EPARegion","Latitude","Longitude","Elevation",
"GMTOffset","CountryCode","StateName","ValidDate","ValidTime","DataSource",
"ReportingArea_PipeDelimited","OZONE_AQI","PM10_AQI","PM25_AQI","NO2_AQI",
"OZONE_Measured","PM10_Measured","PM25_Measured","NO2_Measured","PM25",
"PM25_Unit","OZONE","OZONE_Unit","NO2","NO2_Unit","CO","CO_Unit","SO2",
"SO2_Unit","PM10","PM10_Unit"
```
— 34 columns, confirmed consistent across all 4,434 real rows (`awk -F'","' '{print NF}' | sort -u` → one value, 34). This is the schema the parser was actually built against.

## What got built

- `src/data/airNowCsv.js` — a pure, dependency-free quoted-CSV parser (`parseAirNowCsv`), header-driven (column lookup by name, not hardcoded position, so it survives upstream reordering) — same idiom as the project's own `src/data/firmsCsv.js` for NASA FIRMS.
- `server/providers/airQuality.js` — a server-side proxy (current-UTC-hour fetch, falling back one hour if that file isn't published yet; single-flight in-memory cache; serves stale on failure) — modeled on `server/providers/cyclones.js`. Server-side (not client-direct) because the payload is large plain text, not JSON, and its CORS support was unverified.
- `src/layers/airQuality/` — the usual four files (`records.js` re-validates the server's own JSON contract; `source.js`; `model.js` with the EPA breakpoint table; `index.js` the layer factory, point markers).
- Registered token `3`, grouped under **Weather**.

Commit: `5d6e055` — "Add Air Quality (AQI) layer (AirNow, keyless)".

## A real bug the real sample caught before shipping

The parser's own test suite, run against fixture rows taken **verbatim from the real uploaded file**, caught a live bug: `Number('')` evaluates to `0` in JavaScript, which was silently turning "this pollutant wasn't measured this hour" (an empty CSV cell) into "AQI 0 for Ozone" for a real Canadian site (Southampton, PEI) that had reported nothing. Fixed by explicitly treating an empty cell as absent before calling `Number()` on it, rather than trusting `Number.isFinite()` alone.

## Verification performed before push

Beyond the standard suite ([[03-Adding-a-Data-Layer-Pattern|Step 5]]):
- 9 parser tests against real sample rows from the actual downloaded file.
- The **entire real 4,434-row file** parsed end-to-end as a sanity check: 1,988 valid sites, AQI range 0–196, no NaN coordinates.
- A full integration check feeding the real file through the actual server handler (`airQualityProxy`) and then through the client's own `validateAirQualitySnapshot` — the real round trip a browser takes — confirmed all 1,988 sites pass through cleanly.

This is more verification than the NWS layer got, directly because of what happened with the NWS layer. See [[06-Lessons-Learned]].
