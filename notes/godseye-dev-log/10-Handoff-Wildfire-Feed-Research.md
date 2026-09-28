---
tags: [godseye, handoff, wildfire, watch-duty, new-jersey]
created: 2026-09-28
---

# Handoff: Wildfire Feed Research (Watch Duty Parity + New Jersey)

Related: [[00-Overview]] · [[08-Watch-Duty-Feed-Parity]] · [[09-New-Jersey-Adaptation]] · [[03-Adding-a-Data-Layer-Pattern]] · [[06-Lessons-Learned]] · [[07-Open-Items-and-Ideas]]

A standalone summary of one research thread, written so someone can pick it up cold. **No application code was changed.** Everything produced is documentation in this vault.

## 1. What was asked

In order:

1. **"Can you analyze the feeds the Watch Duty wildfire app ingests, and document the sources and apps needed to port everything it can see into God's Eye?"** (The original message said "watch dirt", read as a typo for Watch Duty.)
2. **"Is this applicable to every state or California only?"**
3. **"How could I further adapt this for New Jersey?"**
4. **"Give me a detailed handoff note."** (This note.)

## 2. What was delivered

| Commit | File | What it is |
|---|---|---|
| `56a9fe0` | `notes/godseye-dev-log/08-Watch-Duty-Feed-Parity.md` | Every Watch Duty map layer mapped to its upstream feed, GEV's current coverage, a port plan for each, a tiered build order, and the keys and accounts needed |
| `10dd7b0` | `notes/godseye-dev-log/09-New-Jersey-Adaptation.md` | How the plan changes for NJ: which national feeds still work, NJ-specific sources, gaps, an NJ build order and contacts |
| (this commit) | `notes/godseye-dev-log/10-Handoff-Wildfire-Feed-Research.md` | This handoff |

The overview (`00-Overview.md`) links to notes 08 and 09. The backlog note (`07-Open-Items-and-Ideas.md`) has a new bullet pointing to 08. Note 08 links to 09.

- **Branch:** `claude/wildfire-feed-sources-analysis-pm96o5` (pushed to `origin`, working tree clean)
- **Base:** `3fc7846` ("Add Obsidian-vault dev log documenting this session's work")
- **Pull request:** none opened; none was asked for.

## 3. How the research was done, and its limits

- **Codebase survey first.** Read `README.md`, `DATA_SOURCES.md`, the existing dev-log notes (especially [[03-Adding-a-Data-Layer-Pattern]]), `server/providers/firms.js`, `src/app/layers/firms.js`, `src/layers/nwsAlerts/`, and `src/data/layerState.js`, to establish what God's Eye already shows.
- **Watch Duty sources from web search only.** This session's network policy **blocked direct page fetches** (`support.watchduty.org` and `en.wikipedia.org` returned `EGRESS_BLOCKED`). Everything about Watch Duty comes from search-result summaries of its blog, help center, app-store listing, and press coverage.
- **No endpoint was reachable.** A `curl` probe of 10 candidate endpoints (WFIGS incidents and perimeters, Watch Duty's prescribed-fire FeatureServer, `api.weather.gov` Red Flag query, NOAA river-gauge MapServer, NWPS gauges API, an ALERTCalifornia camera JSON, the NESDIS fire portal, the PurpleAir API, adsb.fi) got **HTTP 000 (no connection)** on all of them.
- **Therefore:** every URL, field name and schema in notes 08 and 09 is a **starting point, not a verified contract**. This follows the project's own rule in [[06-Lessons-Learned]]: the NWS layer shipped a bug from an unverified data-shape assumption, and the AirNow layer was built only after inspecting a real file. **Whoever builds a layer from this research must first fetch a real payload**, from a machine with open network access or by having the user download it, as was done for AirNow.
- **Format check:** `npx prettier --check` flags the new notes. `npm run format:check` (the repo's real check) failed to start because of a missing module, but `scripts/format.mjs` only covers owned runtime code, so notes are not in its scope. The existing notes were never formatted either. This isn't blocking.

## 4. Key findings: God's Eye today

Fire-relevant layers already in GEV:

| Layer | Feed | Fire relevance |
|---|---|---|
| `local-firms` (token `w`) | NASA FIRMS, **VIIRS only** (NOAA-20, NOAA-21, S-NPP NRT), worldwide, trailing 24 h, via `server/providers/firms.js` with a 30-minute cache. Needs `FIRMS_MAP_KEY` (already configured). | Satellite hotspots |
| `nws-alerts` (token `2`) | `api.weather.gov/alerts/active`: **every** active alert | Already includes **Red Flag Warnings, Fire Weather Watches** and flash-flood warnings |
| `air-quality` (token `3`) | AirNow hourly bulk file (keyless) | Smoke impact |
| Weather | GFS/ECMWF gridded wind, nowCOAST radar, satellite and lightning | Fire weather context (model wind, not station observations) |
| Flights | OpenSky + adsb.lol | Firefighting aircraft are present but mixed in with all other traffic |
| CCTV | Many DOT and municipal camera catalogs | Infrastructure exists; no wildfire cameras yet |

Layer-token pool: only **digits `4`–`9`** remain free (`1`–`3` are taken, and all lowercase letters are in use). This matters because fire parity could add 5–8 layers. The recommendation is to **group feeds into fewer layers** (for example, one "Wildfires" layer holding incidents, perimeters and prescribed burns).

## 5. Key findings: Watch Duty

**What it is:** a 501(c)(3) nonprofit wildfire (and, since June 2026, flood) alert app. It runs on (1) machine feeds and (2) staff and volunteer reporters who monitor radio scanners and official channels. **Only (1) can be ported.** The written incident updates and push alerts are Watch Duty's own editorial content and must not be scraped (from `app.watchduty.org` or its private API).

**Layer to source mapping** (full detail in [[08-Watch-Duty-Feed-Parity]]):

| Watch Duty layer | Upstream | GEV status |
|---|---|---|
| Satellite hotspots | NASA FIRMS VIIRS + MODIS, including Ultra Real-Time direct readout for US and Canada | 🟡 VIIRS only |
| Landsat hotspots | FIRMS `LANDSAT_NRT` | ❌ |
| NGFS heat detections | NOAA/NESDIS Next Generation Fire System, GOES-East/West every 5 min (public experimental portal `fire.data.nesdis.noaa.gov`) | ❌ Keyless fallback: GOES ABI `ABI-L2-FDCC` on NOAA Open Data AWS (NetCDF) |
| Fire perimeters | NIFC WFIGS Interagency Perimeters – Current; FIRIS (California early mapping) | ❌ |
| Fire incidents | NIFC WFIGS Incident Locations – Current (from IRWIN); CAL FIRE | ❌ |
| Prescribed fires | Watch Duty's **own public** ArcGIS FeatureServer `services5.arcgis.com/VNhSlpl1umSknM3q/.../Watch_Duty_Prescribed_Fires` | ❌ (check license) |
| Historical perimeters (Pro) | WFIGS history; CAL FIRE FRAP | ❌ |
| Red Flag / fire weather | NWS | ✅ |
| Surface wind / stations | **Synoptic Data** (home stations reach it via CWOP → Synoptic) | 🟡 model wind only |
| Air quality | AirNow + **PurpleAir with the EPA smoke correction** | 🟡 AirNow only |
| Flight tracker | **ADS-B Exchange**, filtered to air attack, tankers and helicopters | 🟡 Port as a filter on adsb.lol; ADS-B Exchange (paid) isn't needed |
| Live wildfire cameras | **ALERTCalifornia** (UC San Diego, about 1,200 PTZ cameras) + **ALERTWest** | 🟡 Fits the CCTV infrastructure; non-commercial with credit; no public API found, so ask first |
| Evacuation zones (Pro) | **Genasys Protect** (formerly Zonehaven) plus county GIS | ❌ Licensing is the blocker |
| Shelters | County and Red Cross, often hand-posted | ❌ |
| Power outages (California only) | California utility outage maps | ❌ No public API |
| River gauges / flood | NOAA NWPS; rain gauges | 🟡 Flash-flood alerts only |
| Critical infrastructure (Pro) | Mostly HIFLD-derived (HIFLD Open was retired in 2025) | 🟡 |
| Land ownership (Pro) | Parcels (commercial) and public land (BLM) | ❌ |
| Radio repeaters (Pro) | Curated, RadioReference-type data | Skip (paid) |

**Recommended national build order:**
- **Tier 1** (keyless, fits existing patterns): WFIGS Wildfires layer (incidents + perimeters); MODIS + Landsat added to the FIRMS provider; NWS fire-weather highlight; prescribed fires; NWPS river gauges.
- **Tier 2:** firefighting-aircraft filter; GOES FDC detections; station winds.
- **Tier 3** (keys, money or permission): PurpleAir, Synoptic, ALERTCalifornia, evacuation zones, outages, parcels.

**Accounts:** FIRMS ✅ (have it) · PurpleAir key (paid points) · Synoptic token (free tier) · ALERTCalifornia/ALERTWest (permission) · Genasys (partner agreement) · NESDIS portal (check whether it needs an account). ADS-B Exchange is **not needed**. Everything else is keyless.

## 6. Key findings: national vs. California-only

Answer to question 2, not yet written into note 08:

- **Nationwide or wider:** FIRMS (worldwide; URT for US and Canada), Landsat (US and Canada), GOES detections (CONUS plus parts of Canada and Mexico), WFIGS incidents and perimeters (national, though state reporting varies, so eastern coverage may be patchier), NWS alerts (all states), NWPS gauges (lower 48, Alaska, Puerto Rico), AirNow (national), PurpleAir (worldwide), the aircraft filter (national, depends on the curated list), Synoptic (national), and historical perimeters, BLM and infrastructure (national).
- **California-only or California-heavy:** FIRIS early perimeters (elsewhere, fires are infrared-mapped overnight and appear the next morning), ALERTCalifornia cameras (ALERTWest covers some other western states; nothing comparable in the East), the CAL FIRE incident list, power outages (Watch Duty shows them only for California), and Genasys evacuation zones (county by county, mostly California).
- Watch Duty itself covers about **22 states**, mostly western. A GEV build on the national feeds would cover more ground, without the human reporting.

## 7. Key findings: New Jersey

Answer to question 3; full detail in [[09-New-Jersey-Adaptation]].

**How NJ fire differs:** Pine Barrens (Ocean, Burlington, Atlantic counties); a spring season (roughly March–May) with a smaller fall season; many small, fast fires (NJFFS: more than 1,300 fires and over 27,000 acres in 2025); detection by **human observers in 21 fire towers** (a new 133 ft tower opened in Jackson Township in 2026), with no camera network. Coastal, river and storm hazards are at least as important as fire.

**National feeds in NJ:**
- **WFIGS incidents:** likely ✅. The NJFFS public map says its fire locations come from IRWIN.
- **WFIGS perimeters:** partial, because most NJ fires are too small.
- **FIRMS:** partial; small fires are often missed.
- **GOES 5-minute detections:** move **up** in priority.
- **NWS:** NJ is covered by the Mount Holly (PHI) and Upton (OKX) offices. Also consider fire-danger Special Weather Statements (the wording is unverified).
- **AirNow:** ✅. NJDEP's 29 monitors already report through it.
- **NWPS:** ✅.
- **Aircraft:** partial. The NJFFS contract fleet needs its own identifiers.
- **Cameras:** ❌.
- **Genasys:** ❓, with no sign of statewide use.

**NJ-specific sources:**
1. **NJFFS wildfire map** (ArcGIS; the "New Jersey Current Wildfires" StoryMap): locations **and perimeters for 7 days**, updated every 15 minutes. The best NJ source; find its underlying FeatureServer.
2. **NJFFS Fire Danger Public Dashboard** (ArcGIS Dashboards): danger ratings by area and the burning-restriction stage. No national equivalent.
3. **NJ fire towers** (NJDEP page): 21 locations, for a static layer.
4. **NJ Wildfire Risk Explorer** (`newjerseywildfirerisk.com`): risk and wildland-urban interface context. License unknown.
5. **Rutgers NJ Weather & Climate Network:** about 60 stations with 5-minute data plus 50+ partner stations. It's in the National Mesonet Program, so it should reach Synoptic and MADIS.
6. **NOAA CO-OPS tide gauges** (Sandy Hook, Atlantic City, Cape May): keyless.
7. **USGS NJ stream gauges:** keyless.
8. **Stevens Flood Advisory System:** 81-hour ensemble flood forecasts for the NY/NJ metro area. Academic; ask before using.

**Doesn't carry over to NJ:** wildfire cameras (none public; NJDOT has no camera API, as already recorded in note 07); power outages (four utilities, PSE&G, JCP&L/FirstEnergy, ACE/Exelon and Rockland Electric, with no public API; aggregators like PowerOutage.us (paid) and JerseyOutages must not be scraped); evacuation zones (county and municipal OEM; check NJGIN for coastal evacuation routes).

**NJ build order:** WFIGS Wildfires layer → merge the NJFFS map into it → fire danger and burn restrictions → fire towers → GOES detections → NWS fire-weather highlight (PHI/OKX) → tides and river gauges → Synoptic station winds (brings in NJWxNet).

**Contacts:** NJ Forest Fire Service (reuse permission and aircraft identifiers); Office of the NJ State Climatologist at Rutgers (NJWxNet access); Stevens Institute, Davidson Lab (flood forecast access).

## 8. Open decisions for the user

- **Which layer to build first.** The recommendation is the WFIGS "Wildfires" layer (incidents + perimeters), because it benefits both the national and NJ plans.
- **How to spend the digit tokens `4`–`9`:** group feeds into a few layers, or give each its own.
- **Whether to spend money:** PurpleAir points. Synoptic's free tier may be enough.
- **Whether to reach out** to NJFFS, ALERTCalifornia, Rutgers or Stevens for sanctioned access.
- **Whether to add a coverage column** (national vs. regional) to note 08's table. Offered, not done.

## 9. Next steps for whoever picks this up

1. From a machine with open network access, **fetch real samples** of the Tier 1 feeds: WFIGS incidents and perimeters (`f=geojson`, `outSR=4326`), FIRMS `MODIS_NRT` and `LANDSAT_NRT` CSVs, NWPS gauges, and the NJFFS map's FeatureServer. Record the real schemas the way note 05 did for AirNow.
2. Check the licenses and terms: WFIGS, Watch Duty's prescribed-fire item, NJFFS services, NJ Wildfire Risk Explorer.
3. Build following [[03-Adding-a-Data-Layer-Pattern]]: server proxy with cache → client re-validation (skip bad records, don't reject the whole feed) → the four layer files → the six wiring edits → boundary manifest → tests → bump the golden counts. Then run `check:boundaries`, `npm test`, `format` and `build`, and ship each layer as **one isolated commit**.
4. Add every new source to `DATA_SOURCES.md` and `src/data/dataCredits.js`.

## 10. Environment notes for the next session

- The session ran in a cloud container. Outbound HTTPS goes through a proxy that blocked Watch Duty's help pages, Wikipedia, and every data endpoint tried. If the next session needs live data, the user may need to widen the environment's network policy, or download sample files by hand.
- The WebSearch tool worked. WebFetch did not work for the domains tried.
