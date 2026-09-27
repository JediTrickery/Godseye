---
tags: [godseye, overview, moc]
created: 2026-09-27
---

# God's Eye View — Dev Log Overview

This vault documents the work done setting up and extending **God's Eye View** (internally referred to as "god's eye" / "GEV" in this log) — a real-time intelligence globe originally built by Bilawal Sidhu ([bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view), MIT licensed) and imported into this project's own repository, [JediTrickery/Godseye](https://github.com/JediTrickery/Godseye).

This is a **map of contents (MOC)** — start here, then follow the links below.

## What this vault covers

- [[01-Setup-and-Local-Environment|Setup & Local Environment]] — Node version requirements, nvm, running the dev server, what went wrong along the way and how it got fixed.
- [[02-Provider-Keys-and-Power-Up|Provider Keys & POWER UP]] — which free/keyless data sources are live, which optional keys were added, and why OpenRouter can't power the voice feature.
- [[03-Adding-a-Data-Layer-Pattern|Adding a Data Layer — The Reusable Pattern]] — the most important note in this vault. A step-by-step reference for how a new live data layer gets added to the app, distilled from two real examples.
- [[04-Severe-Weather-Alerts-Layer|Severe Weather Alerts Layer (NWS)]] — the first new layer built: what it does, a real bug that shipped and got fixed, and why.
- [[05-Air-Quality-Layer|Air Quality (AQI) Layer (AirNow)]] — the second new layer, built with a more careful verify-before-code approach after the NWS lesson.
- [[06-Lessons-Learned|Lessons Learned — Guessing vs. Verifying]] — the throughline lesson across both new layers, worth reading even out of order.
- [[07-Open-Items-and-Ideas|Open Items & Ideas]] — what's still on the table.

## Quick facts

| | |
|---|---|
| Repo | `JediTrickery/Godseye` |
| Working branch | `claude/gods-eye-project-828q07` |
| Base import commit | `88375da` — "Import God's Eye View: real-time intelligence globe" |
| Latest commit as of this log | `5d6e055` — "Add Air Quality (AQI) layer (AirNow, keyless)" |
| Runtime | Node 24.14.0 (nvm-managed on the user's Mac) |
| Test suite | ~4,938 tests, all passing as of the latest commit |

## Commit history (this branch)

```
5d6e055  Add Air Quality (AQI) layer (AirNow, keyless)
a43a958  Fix NWS alerts layer rejecting the whole feed on one bad alert
2018448  Add Severe Weather Alerts layer (NWS, keyless)
88375da  Import God's Eye View: real-time intelligence globe
```

Each of the three commits after the import is a small, independently revertible change — see [[03-Adding-a-Data-Layer-Pattern]] for why that mattered in practice (the NWS layer needed exactly this kind of isolated rollback safety once a bug was found).
