---
tags: [godseye, api-keys, power-up]
created: 2026-09-27
---

# Provider Keys & POWER UP

Related: [[00-Overview]]

The app runs fully keyless by default. Optional API keys unlock additional layers/fidelity through the in-app **POWER UP** panel (bottom-right chip → Provider Settings). Keys are written to a local `.env` file by the app itself — never typed into this chat, never handled by Claude directly.

## Status as of this log

| Provider | Tier | Status | Unlocks |
|---|---|---|---|
| Cesium ion | 🟡 Free | Configured | Photorealistic 3D + world terrain (free alternative to the paid Google route) |
| TomTom | 🟡 Free trial (Evaluation) | Configured | Live traffic congestion coloring |
| NASA FIRMS | 🟡 Free | Configured | Live active-fire detections |
| AISStream | 🟡 Free | Configured | Live global ship tracking |
| Google Maps | 🔴 Metered | **Not configured** | Direct Google Photorealistic 3D + place search — skipped, Cesium ion already covers the 3D use case for free |
| OpenAI | 🔴 Metered | **Not configured** | Voice control ("talk to the globe") — the one feature that costs real money; the app meters it live with a $5 hard session cap |
| OpenSky (registered) | 🟡 Free, optional | Not configured | Raises the flight-polling rate limit above the working anonymous default |
| Launch Library 2 (token) | 🟡 Free, optional | Not configured | Raises the Space Missions request allowance above the working default |

## Notes on getting each key

- **Cesium ion**: [cesium.com/ion](https://cesium.com/ion) → sign up (no card) → Access Tokens → default token already has the needed `assets:read` scope → paste into POWER UP.
- **NASA FIRMS**: [firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) → email only, no password, key arrives by email.
- **AISStream**: [aisstream.io](https://aisstream.io) → free signup.
- **TomTom**: [developer.tomtom.com](https://developer.tomtom.com) → the default "My First API key" it creates on signup already includes the Traffic Flow API the app needs; note it's on the **Evaluation** (trial) billing tier, which is time-limited — expect to need to check the TomTom dashboard again in a few months.

## Is it safe to paste a key into chat?

No — keys should go directly into the app's own POWER UP panel, not into a chat session. This isn't really about any one key being dangerous (the ones above are all scoped to public/read-only access and can't touch billing or delete anything), it's just that a chat transcript isn't a secrets store and there's no reason to route a key through it when the app's panel writes straight to the local `.env`.

## Why OpenRouter can't power the voice feature

The voice feature is hardwired to OpenAI's **Realtime API** (`src/voice/realtimeBackend.js`, calling `api.openai.com/v1/realtime/calls` directly) — a low-latency speech-to-speech WebSocket protocol. OpenRouter routes **text-completion** models; it doesn't (as of this check) proxy anything equivalent to a realtime audio API. The project's own README acknowledges this gap explicitly: *"Want Gemini or another provider behind the mic? PRs welcome."* Swapping the voice backend to a different provider would be real implementation work, not a config change.

## Real-world weather/data sanity check performed

At one point the app showed a "Snow" visual style while a real nor'easter (rain) was happening over the user's location (West Orange, NJ). Investigated and confirmed: "Snow" is a purely cosmetic GLSL camera filter (`src/styles/snow.js`, grouped with CRT/NVG/FLIR/Noir under "Reskin reality") — it has zero connection to real weather data, it's just always-on snow particles regardless of location. The actual **Weather layer** (Wind/Rain radar/Satellite clouds/Lightning, from NOAA) was separately verified against real NWS data for that location (61°F, rain, not snow) and found to be accurate.
