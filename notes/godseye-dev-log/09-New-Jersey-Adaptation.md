---
tags: [godseye, research, wildfire, new-jersey, backlog]
created: 2026-09-28
---

# Adapting Wildfire Parity for New Jersey

Related: [[08-Watch-Duty-Feed-Parity]] · [[03-Adding-a-Data-Layer-Pattern]] · [[06-Lessons-Learned]] · [[07-Open-Items-and-Ideas]]

[[08-Watch-Duty-Feed-Parity]] is built around the national feeds, and Watch Duty's own strengths are in California. This note covers what changes for **New Jersey**: which national feeds still work, what NJ-specific sources exist, and what doesn't carry over.

> **Verification status:** As with note 08, this comes from web search. None of these endpoints was reachable from the sandbox. Fetch a real payload before writing any parser ([[06-Lessons-Learned]]).

## How NJ wildfire differs from California

- **Where:** mostly the **Pinelands / Pine Barrens** (Ocean, Burlington and Atlantic counties), with wildland-urban interface right against the pines (for example Barnegat, Stafford, Jackson).
- **When:** the main season is **spring (roughly March–May)**, before leaf-out, with a smaller fall season. Summer is usually quieter.
- **Scale:** many small, fast fires. In 2025 the NJ Forest Fire Service (NJFFS) responded to more than 1,300 wildfires totalling over 27,000 acres, so the average fire is tiny.
- **Detection:** NJ still relies on **human observers in 21 fire towers** (a new 133 ft tower opened in Jackson Township in 2026), not an AI camera network like ALERTCalifornia.
- **Other hazards weigh more:** coastal flooding, storm surge, river flooding and storm-driven power outages matter at least as much as fire here. That makes the flood side of the plan more valuable in NJ than in California.

## Which national feeds still work in NJ

| Feed (from note 08) | Works in NJ? | Notes |
|---|---|---|
| WFIGS incidents (#5) | ✅ Likely | NJFFS's own public map says its wildfire locations come from **IRWIN**, the same system behind WFIGS incidents. NJ fires should therefore appear in the national feed. Confirm this against a real download during the spring season. |
| WFIGS perimeters (#4) | 🟡 Partial | Most NJ fires are too small to get a mapped perimeter nationally. The NJFFS map (below) fills this gap. |
| FIRMS VIIRS/MODIS (#1) | 🟡 Partial | Satellite passes happen only a few times a day, and small Pine Barrens fires are often missed or seen late. Good for large fires. |
| GOES 5-minute detections (#3) | ✅ Worth more here | Scans every 5 minutes and has caught fires as small as a quarter acre, which suits NJ's fast, small fires. Moves up in priority. |
| NWS Red Flag / Fire Weather Watch (#8) | ✅ | NJ is covered by the **Mount Holly (PHI)** and **Upton/NYC (OKX)** NWS offices. Worth also surfacing Special Weather Statements that mention fire danger, which eastern offices use for elevated-but-below-criteria days (verify the wording against real alerts). |
| AirNow (#11) | ✅ Already in GEV | NJDEP's 29 monitoring stations report through AirNow, so the existing AQI layer already shows them. |
| NWPS river gauges (#17) | ✅ | Covers NJ rivers (Passaic, Raritan, Delaware and others). |
| Firefighting aircraft (#12) | 🟡 | The federal and CAL FIRE fleet lists won't cover NJ. NJFFS runs its own contract aircraft (air tankers and helicopters), whose registrations and hex codes would need to be researched and added. |
| ALERTCalifornia cameras (#13) | ❌ | No NJ equivalent. See "What doesn't carry over" below. |
| Genasys evacuation zones (#14) | ❓ | No sign of statewide Genasys use in NJ. Evacuation planning is municipal/county OEM. Needs research. |

## NJ-specific sources to add

| # | Source | What it adds | Access | Notes |
|---|---|---|---|---|
| NJ-1 | **NJFFS wildfire map** (ArcGIS; also embedded in the "New Jersey Current Wildfires" StoryMap) | Fire locations **and perimeters for the last 7 days**, sized by number of firefighters assigned, **updated every 15 minutes** | Public ArcGIS. Find the underlying FeatureServer through the map's item page and query it with `f=geojson`. | The best NJ-specific source. Includes small fires that won't get national perimeters. Confirm reuse terms with NJFFS. |
| NJ-2 | **NJFFS Fire Danger Public Dashboard** (ArcGIS Dashboards, desktop and mobile) | Current **fire danger rating by area** and the **burning-restriction stage** in effect | Public ArcGIS dashboard. The underlying feature layer should be queryable. | Polygon layer colored by danger level. NJFFS calls it the authoritative source for danger ratings and restrictions. Nothing like it exists in the national plan. |
| NJ-3 | **NJ fire towers** (NJDEP Fire Towers page) | 21 tower locations | Static list | Bundle as a static point layer, like dams. It shows where NJ's human detection network sits. Optional: approximate viewshed rings. |
| NJ-4 | **NJ Wildfire Risk Explorer** (`newjerseywildfirerisk.com`) | Wildfire risk, wildland-urban interface and fuels context | Web viewer; data licensing unknown | Background context layer, not live. Check the terms. The viewer may be a licensed product, and the raw data might need a request to NJFFS. |
| NJ-5 | **Rutgers NJ Weather & Climate Network** (NJWxNet, Office of the NJ State Climatologist) | One of the densest mesonets in the US. Around 60 stations with **5-minute data**, plus 50+ partner stations (NJDOT, NJ Turnpike, NWS, USGS, US Forest Service, Stevens) | NJWxNet is part of the **National Mesonet Program**, so its data should also flow into Synoptic and MADIS | Easiest route is the Synoptic token already listed in note 08 (#9). Direct access: contact the State Climatologist's office. Much better NJ station winds than generic sources. |
| NJ-6 | **NOAA tide gauges** (CO-OPS: Sandy Hook, Atlantic City, Cape May and others) | Live coastal water levels against flood thresholds | Keyless NOAA API | Not a fire feed, but high value for NJ. Fits the same point-layer pattern as river gauges. |
| NJ-7 | **USGS NJ stream gauges** | Denser river and stream observations than NWPS forecast points | Keyless USGS Water Data API | Complements NWPS (#17). |
| NJ-8 | **Stevens Flood Advisory System** (Stevens Institute, Davidson Lab) | Street-scale coastal and river flood forecasts up to 81 hours ahead for the NY/NJ metro region, updated every 6 hours | Academic system with a public web interface; no documented API found | Ask Stevens before building on it. Used by NWS offices and local emergency managers. |

## What doesn't carry over

- **Wildfire cameras:** NJ has no public detection camera network. It relies on tower observers, and NJDOT has no public camera API (already noted in [[07-Open-Items-and-Ideas]]). The closest substitutes are GOES 5-minute detections plus the fire tower layer.
- **Power outages:** there's still no public API. NJ has four utilities (PSE&G, JCP&L/FirstEnergy, Atlantic City Electric/Exelon, Rockland Electric), each with its own outage map. Third-party aggregators exist (PowerOutage.us, which is paid, and JerseyOutages). Don't scrape the utility maps or the aggregators. Ask a utility or pay for a feed if this becomes important. Outages matter more in NJ because of storms than because of fire shutoffs.
- **Evacuation zones:** no statewide Genasys-style system found. Coastal evacuation routes may be on NJ's open GIS portal (NJGIN). Research this before planning a layer.

## Suggested NJ build order

1. **Wildfires layer** from WFIGS (note 08 Tier 1). Check that NJ incidents actually appear.
2. **NJFFS wildfire map** (NJ-1), merged into the same Wildfires layer as an NJ source, so small NJ fires get perimeters.
3. **Fire danger and burn restrictions** (NJ-2): a new polygon layer, keyless if the feature service is public.
4. **Fire towers** (NJ-3): a small static layer.
5. **GOES 5-minute detections** (note 08 #3): moves up because it suits NJ's small, fast fires.
6. **NWS fire-weather highlight**, including the fire-danger statements from Mount Holly and Upton.
7. **Coastal and river water levels**: NOAA tides (NJ-6) with NWPS and USGS gauges (NJ-7).
8. **Station winds** via a Synoptic token, which brings in NJWxNet (NJ-5).

## Contacts worth making

| Who | Why |
|---|---|
| NJ Forest Fire Service (NJDEP) | Permission to reuse the wildfire-map and fire-danger feature services, and NJFFS aircraft identifiers for the aircraft filter |
| Office of the NJ State Climatologist (Rutgers) | Direct NJWxNet data access, if Synoptic isn't used |
| Stevens Institute, Davidson Laboratory | Programmatic access to flood forecasts |

## Small extras

- Add **camera presets** for the Pine Barrens and the Jersey Shore so a fire-season session can jump straight there (see the existing city presets in `src/locations.js`).
- Default the fire layers to an NJ view during spring fire season.

## Sources consulted

- NJFFS: [New Jersey Current Wildfires StoryMap](https://storymaps.arcgis.com/stories/04fe29dce5064bc0bb6763f0fab48006), [Fire Danger Public Dashboard (desktop)](https://www.arcgis.com/apps/dashboards/ab223d9403e94560a60b31b4141cc46e), [Fire Danger Public Dashboard (mobile)](https://www.arcgis.com/home/item.html?id=3d95a723235d4a5383ab9838a8884282), [NJDEP Wildfire page](https://dep.nj.gov/parksandforests/wildfire/), [NJDEP Fire Towers](https://dep.nj.gov/parksandforests/wildfire/fire-towers/), [New fire tower announcement](https://dep.nj.gov/newsrel/26-0010/), [NJ Wildfire Risk Explorer](https://newjerseywildfirerisk.com/)
- Fire history and wildland-urban interface: [Pinelands Commission Fire Safety Initiative](https://nj.gov/pinelands/landuse/recent/fire/)
- Weather: [NJ Weather & Climate Network](https://www.njweather.org/njwxnet), [National Mesonet Program: NJWxNet](https://nationalmesonet.us/new-jersey-weather-and-climate-network/)
- Air: [NJDEP Air Monitoring](https://dep.nj.gov/airmon/)
- Flood: [Stevens Flood Advisory System](https://hudson.dl.stevens-tech.edu/sfas/)
- Power: [PSE&G outage map](https://outagecenter.pseg.com/), [FirstEnergy NJ outage map](https://outages-nj.firstenergycorp.com/), [Atlantic City Electric outage map](https://www.atlanticcityelectric.com/outages/experiencing-an-outage/view-outage-map), [PowerOutage.us NJ](https://poweroutage.us/area/state/new%20jersey)
