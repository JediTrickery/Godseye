import { parseAirNowCsv } from '../../src/data/airNowCsv.js';

const HOUR_MS = 3600_000;
const TTL_MS = 20 * 60_000;
const SOURCE = 'AirNow (files.airnowtech.org)';
const ATTRIBUTION = 'U.S. EPA AirNow';
const COVERAGE =
  'Active AQI monitoring sites reporting this UTC hour — US, Canada, Mexico, and U.S. State Department posts abroad; not exhaustive.';

/** `https://files.airnowtech.org/airnow/{yyyy}/{yyyymmdd}/HourlyAQObs_{yyyymmddhh}.dat` for a given UTC instant. */
function fileUrl(atMs) {
  const d = new Date(atMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `https://files.airnowtech.org/airnow/${yyyy}/${yyyy}${mm}${dd}/HourlyAQObs_${yyyy}${mm}${dd}${hh}.dat`;
}

/**
 * Keyless AirNow air-quality proxy with a single-flight in-memory cache.
 * The current UTC hour's file is not always published yet (the source is
 * updated ~twice per hour), so a fetch failure or non-CSV response falls
 * back one hour; only if BOTH the current and prior hour fail does the
 * refresh itself fail (the caller then serves stale cache, if any).
 *
 * Route: GET /api/air-quality → {schemaVersion, source, attribution,
 *   coverage, fetchedAt, stale, unavailable, sites}
 *
 * @returns {import('vite').Plugin}
 */
export function airQualityProxy({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 20_000,
} = {}) {
  let cache = null; // {sites, at}
  let operation = null;
  let attemptedAt = -Infinity;

  async function fetchHour(atMs, signal) {
    const response = await fetchImpl(fileUrl(atMs), {
      signal,
      redirect: 'error',
      headers: { Accept: 'text/csv, text/plain, */*' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const sites = parseAirNowCsv(text);
    if (sites === null) throw new Error('non-CSV upstream response');
    return sites;
  }

  async function refresh(signal) {
    const current = now();
    let sites;
    try {
      sites = await fetchHour(current, signal);
    } catch {
      signal.throwIfAborted();
      sites = await fetchHour(current - HOUR_MS, signal);
    }
    signal.throwIfAborted();
    cache = { sites, at: current };
    return cache;
  }

  async function acquire(signal) {
    signal.throwIfAborted();
    if (cache && now() - cache.at < TTL_MS) return cache;
    if (operation?.controller.signal.aborted) operation = null;
    if (!operation) {
      if (now() - attemptedAt < 60_000)
        throw new Error('air_quality_retry_later');
      attemptedAt = now();
      const controller = new AbortController();
      const owned = { controller, waiters: 0 };
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      owned.promise = refresh(controller.signal).finally(() => {
        clearTimeout(timer);
        if (operation === owned) operation = null;
      });
      operation = owned;
    }
    const owned = operation;
    if (owned.waiters >= 32)
      throw Object.assign(new Error('air_quality_busy'), { status: 429 });
    owned.waiters++;
    let abort;
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(signal.reason ?? new Error('cancelled'));
      signal.addEventListener('abort', abort, { once: true });
    });
    try {
      return await Promise.race([owned.promise, cancelled]);
    } finally {
      signal.removeEventListener('abort', abort);
      if (--owned.waiters === 0 && operation === owned) {
        owned.controller.abort();
        if (signal.aborted) attemptedAt = -Infinity;
      }
    }
  }

  function describe(value, stale = false) {
    return {
      schemaVersion: 1,
      source: SOURCE,
      attribution: ATTRIBUTION,
      coverage: COVERAGE,
      fetchedAt: value?.at ?? null,
      stale: stale || !value,
      unavailable: !value,
      reason: !value
        ? 'AirNow data unavailable'
        : stale
          ? 'Cached AirNow observations; upstream unavailable'
          : null,
      sites: value?.sites ?? [],
    };
  }

  async function handler(req, res) {
    const controller = new AbortController();
    const close = () => controller.abort();
    res.once?.('close', close);
    const json = (status, value) => {
      if (controller.signal.aborted) return;
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(status === 429 ? { 'Retry-After': '2' } : {}),
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.method !== 'GET')
        return json(405, { error: 'method_not_allowed' });
      if (req.url !== '/' && req.url !== '')
        return json(400, { error: 'invalid_air_quality_query' });
      try {
        json(200, describe(await acquire(controller.signal)));
      } catch (error) {
        if (error.status === 429)
          return json(429, { error: 'air_quality_busy' });
        const usable = cache && now() - cache.at <= 3 * HOUR_MS;
        json(200, describe(usable ? cache : null, true));
      }
    } finally {
      res.removeListener?.('close', close);
    }
  }
  return {
    name: 'air-quality',
    configureServer({ middlewares }) {
      middlewares.use('/api/air-quality', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/air-quality', handler);
    },
  };
}
