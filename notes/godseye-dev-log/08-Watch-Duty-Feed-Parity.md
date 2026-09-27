---
tags: [godseye, research, wildfire, watch-duty, backlog]
created: 2026-09-27
---

# Watch Duty Feed Parity — What It Sees, and How GEV Could See It Too

Related: [[00-Overview]] · [[03-Adding-a-Data-Layer-Pattern]] · [[06-Lessons-Learned]] · [[07-Open-Items-and-Ideas]]

A research note, not a build log. It lists every map layer the **Watch Duty** wildfire app shows, the upstream feed behind each one, what God's Eye View (GEV) already covers, and what it would take to add the rest.

> **Verification status:** Everything here comes from Watch Duty's own blog and help-center pages and from agency documentation, found by web search. This session's sandbox could not reach any of the candidate endpoints (ArcGIS, `api.weather.gov`, NOAA water, ALERTCalifornia, PurpleAir, NESDIS all returned no connection). Per [[06-Lessons-Learned]], **fetch a real payload for every feed before writing a parser for it.** Schemas and URLs below are starting points, not verified contracts.

## How Watch Duty works

Watch Duty is a 501(c)(3) nonprofit app built on two things:

1. **Machine feeds**: satellites, perimeters, weather, cameras and aircraft, mostly from government sources (NOAA, NIFC, CAL FIRE, NASA).
2. **Human reporting**: staff and volunteers who monitor radio scanners, cameras and official channels, then post incident updates and push alerts.

**Only (1) can be ported.** The human-written incident updates and alerts are Watch Duty's own content. Don't scrape them (`app.watchduty.org` or its private API). The rest of this note covers (1) only.

## Layer-by-layer parity table

Legend: ✅ GEV already has it · 🟡 partly covered · ❌ missing

| # | Watch Duty layer | Upstream feed(s) Watch Duty uses | GEV today | Gap / port plan |
|---|---|---|---|---|
| 1 | **Satellite hotspots: VIIRS / MODIS** | NASA FIRMS, including the Ultra Real-Time (URT) direct-readout feed for US and Canada | 🟡 `local-firms` layer: VIIRS NRT from NOAA-20, NOAA-21 and S-NPP, worldwide, trailing 24 h (`server/providers/firms.js`) | Add `MODIS_NRT` to the `SOURCES` array. Check whether the US/Canada rows in the NRT CSV already carry RT/URT data (FIRMS marks these in the `version` column). Same key, same parser, small change. |
| 2 | **Satellite hotspots: Landsat** | NASA FIRMS `LANDSAT_NRT` (US and Canada only, 30 m) | ❌ | Same provider change as #1. Landsat passes are infrequent, so expect few rows. Verify the CSV columns; they differ from VIIRS. |
| 3 | **NGFS heat detections** (5-minute GOES scans) | NOAA/NESDIS Next Generation Fire System (GOES-East/West, with CIMSS). Public, experimental, via the Wildland Fire Data Portal (`fire.data.nesdis.noaa.gov`) | ❌ | The portal's machine-readable access is **unverified**; check whether it needs an account. **Keyless fallback:** GOES ABI L2 Fire Detection & Characterization (`ABI-L2-FDCC`, CONUS, every 5 min) on NOAA Open Data AWS (`noaa-goes19`, `noaa-goes18`). It's NetCDF, so parse it on the server and add a NetCDF reader dependency. This is the highest-value new signal for early detection. |
| 4 | **Active fire perimeters** | NIFC WFIGS *Interagency Perimeters – Current*; FIRIS (early aerial mapping for California); other agencies | ❌ | New polygon layer, server-proxied and cached. Candidate endpoint: `services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?f=geojson`. Follow the `cyclones` validation pattern. Note that WFIGS drops stale records (for example, under 10 acres with no update in 3 days). |
| 5 | **Fire incidents** (name, acres, % contained) | NIFC WFIGS *Incident Locations – Current* (from IRWIN); CAL FIRE incident list | ❌ | Point layer. Candidate endpoint: `.../WFIGS_Incident_Locations_Current/FeatureServer/0/query?f=geojson` (max 2,000 records per page). Pair it with #4 in one "Wildfires" layer: a point marker with a perimeter polygon. |
| 6 | **Prescribed fires** | Watch Duty's own publicly shared ArcGIS layer: `services5.arcgis.com/VNhSlpl1umSknM3q/ArcGIS/rest/services/Watch_Duty_Prescribed_Fires/FeatureServer` | ❌ | Watch Duty published this on purpose (see their blog post "Publicly Available Prescribed Fire Map Layer"). Check the ArcGIS item's license and attribution terms first. |
| 7 | **Historical fire perimeters** (Pro) | NIFC WFIGS Interagency Fire Perimeters (year-to-date and full history); CAL FIRE FRAP | ❌ | Large dataset. Ship it as a bundled, simplified snapshot or query it on demand by viewport. Don't poll it. |
| 8 | **Red Flag Warnings / fire weather** | NWS | ✅ The `nws-alerts` layer already ingests **every** active NWS alert, including Red Flag Warnings and Fire Weather Watches | Optional polish: a fire-weather filter or highlight color in `src/layers/nwsAlerts/model.js`. No new feed needed. |
| 9 | **Surface wind** | Synoptic Data station observations (RAWS, ASOS, CWOP and others) | 🟡 Gridded GFS/ECMWF model wind, not live station observations | New station-observation point layer. **Synoptic** matches Watch Duty but needs a token (free tier; check the limits and terms). Keyless options to evaluate: Iowa Environmental Mesonet, or `api.weather.gov` station observations (one request per station, so poorly suited to bulk use). |
| 10 | **Home weather stations** | Your station → CWOP → Synoptic → Watch Duty | ❌ | Comes free with #9 if it uses Synoptic. |
| 11 | **Air quality** | AirNow **plus PurpleAir**, with the EPA wildfire-smoke correction applied to PurpleAir | 🟡 `air-quality` layer (AirNow, keyless) | Add PurpleAir as a second source. It needs an **API key** and uses points-based billing, so check the cost. Apply the EPA correction (Barkjohn et al.). Raw PurpleAir readings overstate AQI in smoke. |
| 12 | **Flight tracker: air attack, tankers, helicopters** | ADS-B Exchange, filtered to firefighting fixed-wing and rotor aircraft | 🟡 Flights layer (OpenSky + adsb.lol) shows them mixed in with all other traffic | Add a **firefighting-aircraft filter** on the feed GEV already has (adsb.lol, ODbL, keyless): a curated list of ICAO hex codes, registrations and callsigns (CAL FIRE S-2T and OV-10, C-130, DC-10/747 VLATs, RJ85, CL-415, AT-802F, S-64, UH-60 and others). There's no official public list, so building and maintaining it is the real work. ADS-B Exchange itself is a paid commercial API and isn't needed. |
| 13 | **Live wildfire cameras** | ALERTCalifornia (UC San Diego, about 1,200 PTZ cameras) and ALERTWest | 🟡 GEV has full CCTV infrastructure but no wildfire cameras | Add as a **CCTV source config**, like the Caltrans and TxDOT sources. ALERTCalifornia allows **non-commercial** use with credit ("ALERTCalifornia \| UC San Diego"). No documented public API was found. Following the NJDOT precedent in [[07-Open-Items-and-Ideas]], **ask ALERTCalifornia for a sanctioned feed before scraping `cameras.alertcalifornia.org`**. Esri also redistributes these feeds in ArcGIS, which may be a cleaner route. |
| 14 | **Evacuation zones and status** (Pro) | Genasys Protect (formerly Zonehaven), built from county GIS zones; non-Genasys counties publish their own | ❌ | The hardest item for licensing. Some zone geometry is on ArcGIS Hub (for example "Genasys Evacuation Zones CA (WFS)"), but live order/warning **status** is operational data controlled by Genasys and the counties. Contact Genasys, or limit scope to counties that publish open data. |
| 15 | **Shelters** | County and Red Cross information, often posted by hand by Watch Duty staff | ❌ | Candidate: FEMA's open-shelters feature service (National Shelter System). Unverified. |
| 16 | **Power outages** (California only) | California utility outage maps (PG&E, SCE, SDG&E); PSPS notices | ❌ | No clean public API. Each utility runs its own undocumented outage map, so avoid scraping. Alternatives: PowerOutage.us (paid), ORNL EAGLE-I (research, delayed). Low priority. |
| 17 | **River gauges / flood** (added June 2026) | NOAA National Water Prediction Service (NWPS); rain gauges and precipitation | 🟡 Flash-flood warnings already appear through `nws-alerts`; radar is in Weather | New gauge point layer from the NWPS API (`api.water.noaa.gov/nwps/v1/gauges`, keyless, with flood-stage categories). Precipitation totals: evaluate MRMS QPE through nowCOAST, which GEV already uses for radar. |
| 18 | **Critical infrastructure** (Pro): transmission lines, gas lines, utility territories | Mostly HIFLD-derived datasets | 🟡 GEV has datacenters, dams and submarine cables | The HIFLD Open portal was retired in 2025, so find the current host (DOE/EIA, or Data Rescue Project mirrors) and check licenses. Bundle it as a static snapshot, like dams. |
| 19 | **Land ownership / parcels** (Pro) | Private parcels (commercial or county data) and public-land boundaries | ❌ | Public land: BLM Surface Management Agency (keyless ArcGIS). Private parcels are commercial (Regrid and similar), so skip them. |
| 20 | **Radio repeaters** (Pro) | Curated repeater locations and channels | 🟡 GEV has a Radio layer (internet radio) | Scanner and repeater data (RadioReference) is paid and restricted. Skip it. |
| — | Incident updates, push alerts, reporter notes | Watch Duty staff and volunteers | — | **Not portable.** This is Watch Duty's own editorial content. |

## Recommended build order

Ordered by value versus effort, using the [[03-Adding-a-Data-Layer-Pattern|standard layer recipe]]:

**Tier 1: keyless, fits existing patterns, high value**
1. **Wildfires layer** (#4 + #5): WFIGS incidents and perimeters. This is the core of what Watch Duty looks like. Template: `server/providers/cyclones.js` plus `src/layers/cyclones/` validation.
2. **More FIRMS sources** (#1 + #2): MODIS and Landsat added to the existing provider. Smallest change on the list.
3. **Fire-weather highlight** on `nws-alerts` (#8): styling only.
4. **Prescribed fires** (#6), after confirming the license.
5. **River gauges** (#17): NWPS.

**Tier 2: more work, still keyless**
6. **Firefighting-aircraft filter** on flights (#12): mostly curating the aircraft list.
7. **GOES FDC hotspots** as an NGFS substitute (#3): NetCDF parsing on the server.
8. **Station winds** (#9): keyless source if IEM works out, otherwise Tier 3.

**Tier 3: needs keys, money, or permission**
9. PurpleAir (#11): API key and points billing.
10. Synoptic stations (#9, #10): token.
11. ALERTCalifornia cameras (#13): ask for permission and a feed.
12. Evacuation zones (#14), power outages (#16), parcels (#19): licensing or partner deals.

## Accounts and keys needed for full parity

| Service | Needed for | Cost | Status |
|---|---|---|---|
| NASA FIRMS MAP_KEY | #1, #2 | Free | ✅ Already configured |
| PurpleAir API key | #11 | Points-based (paid after trial credit) | Not requested |
| Synoptic Data token | #9, #10 | Free tier plus paid tiers | Not requested |
| ADS-B Exchange API | #12 (optional) | Paid, commercial | **Not needed**: adsb.lol covers it |
| ALERTCalifornia / ALERTWest | #13 | Non-commercial with credit | Needs contact for a sanctioned feed |
| Genasys | #14 | Partner agreement | Needs contact |
| NESDIS Wildland Fire Data Portal | #3 | Free (public experimental) | Check whether it needs an account |

Everything else (WFIGS, NWS, NWPS, NOAA GOES on AWS, BLM, AirNow) is keyless.

## Practical gotchas for the build

- **Layer tokens:** only digits are left (`1`–`3` are taken, see [[03-Adding-a-Data-Layer-Pattern]] Step 3.5). Fire parity could add 5–8 layers, so either reserve `4`–`9` deliberately or group sub-feeds under one layer (for example, one "Wildfires" layer holding incidents, perimeters and prescribed fires).
- **Attribution:** register every new credit in `src/data/dataCredits.js` and add a row to `DATA_SOURCES.md`. ALERTCalifornia and Watch Duty's prescribed-fire layer both require credit.
- **ArcGIS paging:** WFIGS caps a page at 2,000 records. Use `resultOffset` paging or a viewport `geometry` filter, and ask for `f=geojson` with `outSR=4326`.
- **Fall-off rules:** WFIGS removes stale incidents on its own schedule. Show `fetchedAt` and the source timestamp, the way the FIRMS layer reports staleness.
- **Payload trust:** as with AQI, re-validate the server's own snapshot on the client before building Cesium entities, and skip a malformed record rather than rejecting the whole feed ([[06-Lessons-Learned]]).

## Sources consulted

- Watch Duty: [Membership / layer tiers](https://www.watchduty.org/join), [Map Layers help section](https://support.watchduty.org/hc/en-us/sections/34005679699469-Map-Layers), [NGFS heat detections](https://support.watchduty.org/hc/en-us/articles/47896549294093-Next-Generation-Fire-System-NGFS-Heat-Detections), [Enhanced satellite feeds](https://www.watchduty.org/blog/watch-duty-strengthens-early-wildfire-detection-with-enhanced-satellite-feeds), [Perimeter sources](https://support.watchduty.org/hc/en-us/articles/34005926634637-Why-is-the-fire-perimeter-missing-or-out-of-date), [Flight tracking](https://support.watchduty.org/hc/en-us/articles/18709003342861-How-does-flight-tracking-work), [AQI layer](https://support.watchduty.org/hc/en-us/articles/16881246626957-What-is-the-Air-Quality-Index-AQI-map-layer), [Home weather stations](https://support.watchduty.org/hc/en-us/articles/38227041151373-Can-I-add-my-home-weather-station-to-Watch-Duty), [Flooding FAQ](https://support.watchduty.org/hc/en-us/articles/46400067603341-Flooding-Notifications-FAQs), [Evacuation zones](https://support.watchduty.org/hc/en-us/articles/29011343892237-Where-can-I-find-my-evacuation-zone), [Camera integration](https://www.watchduty.org/blog/alertwest-alertcalifornia-wildfire-camera-integration), [Prescribed-fire layer](https://www.watchduty.org/blog/publicly-available-prescribed-fire-map-layer), [Watch Duty Pro](https://www.watchduty.org/blog/watch-duty-pro---for-firefighters-first-responders-and-emergency-managers)
- Upstream: [NIFC WFIGS](https://data-nifc.opendata.arcgis.com/pages/wfigs-page), [WFIGS Incident Locations service](https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations/FeatureServer), [NOAA Wildland Fire Data Portal](https://fire.data.nesdis.noaa.gov/), [NOAA NGFS announcement](https://www.noaa.gov/news-release/noaa-unveils-powerful-convergence-of-ai-and-science-with-revolutionary-next-generation-fire-system), [FIRMS URT data](https://www.earthdata.nasa.gov/news/feature-articles/firms-adds-ultra-real-time-data-from-modis-viirs), [NWPS gauges](https://www.drought.gov/data-maps-tools/national-water-prediction-service-nwps-river-gauge-observationsforecasts-and-flood), [ALERTCalifornia images & video terms](https://alertcalifornia.org/images-and-video/), [ADS-B Exchange impact page](https://www.adsbexchange.com/about/impact/), [Genasys Protect](https://protect.genasys.com/)
