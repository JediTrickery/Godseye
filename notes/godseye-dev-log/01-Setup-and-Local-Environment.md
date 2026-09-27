---
tags: [godseye, setup, environment, node]
created: 2026-09-27
---

# Setup & Local Environment

Related: [[00-Overview]]

## The base import

The app's source was cloned from the upstream open-source repo (`bilawalsidhu/gods-eye-view`, MIT license) and committed wholesale into this project's own repo on branch `claude/gods-eye-project-828q07`, as commit `88375da`. All 1,455 files, minus `node_modules` and `dist` (already gitignored upstream).

Before committing, the import was verified end-to-end in the build sandbox:
- `npm ci` — installs cleanly
- `npm run doctor` — the project's own environment-readiness script, all green
- `npm run build` — production build succeeds
- `npm test` — 4,877 tests passing (1 skipped) at that point
- A headless Chromium load of the built app resolved cleanly (module graph loads with no reference errors)

## Node version requirement

The project's `package.json` pins:
```json
"engines": { "node": ">=24.14.0 <25 || >=26 <27" }
```

Node 25.x is explicitly excluded (it's a short-lived non-LTS release already past end-of-life). Node 24.x (LTS) or 26.x (latest) both work.

### What actually happened getting this running locally

1. User's Mac initially had **Node v18.20.8** active, managed by **nvm** — this silently overrode a fresh `.pkg` install of Node 24 (the `.pkg` installer puts its binary at `/usr/local/bin/node`, but nvm's shim earlier in `$PATH` wins).
2. Fix: use nvm itself rather than fight it —
   ```bash
   nvm install 24.21.0
   nvm use 24.21.0
   nvm alias default 24.21.0   # so new terminal tabs default to it too
   ```
3. Confirmed with `node --version` → `v24.21.0`.

**Lesson:** if `node --version` doesn't match what you just installed, run `which node` — it's almost always a second Node install (nvm, a system package, Homebrew) earlier in `$PATH`, not a broken install.

## Running it

```bash
cd Godseye
npm ci
npm run dev
```
Open **http://localhost:4173**.

The app runs fully keyless by default (Esri satellite basemap, OpenSky flights, weather, earthquakes, most CCTV feeds, etc.). See [[02-Provider-Keys-and-Power-Up]] for what optional keys unlock.

## A recurring gotcha: typing into the wrong terminal

`npm run dev` runs Vite in the **foreground** — the terminal tab it's running in has no shell prompt available until the server is stopped. Several mid-session mistakes happened from typing `git pull` or chat messages into that same tab instead of a fresh one. The fix is always the same: open a **new terminal tab** (Cmd+T) for any other command, and leave the `npm run dev` tab alone unless you specifically want to stop the server (Ctrl+C).

## Pulling updates

Every layer added in this session is a separate commit on the same branch. To get the latest:
```bash
cd Godseye              # in a NEW terminal tab, not the one running npm run dev
git pull origin claude/gods-eye-project-828q07
git log --oneline -3    # sanity check — top line should match the latest commit
```
Then restart `npm run dev` (Ctrl+C in its tab, then re-run) and hard-refresh the browser (**Cmd+Shift+R**) — a plain reload can serve a cached bundle.
