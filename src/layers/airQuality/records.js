const malformed = () => new Error('Malformed air-quality snapshot');

function text(value, max) {
  if (typeof value !== 'string') throw malformed();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw malformed();
  return trimmed;
}

function number(value, low, high) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < low ||
    value > high
  )
    throw malformed();
  return value;
}

function site(raw) {
  return {
    aqsid: text(raw?.aqsid, 32),
    siteName: text(raw?.siteName, 200),
    lat: number(raw?.lat, -90, 90),
    lon: number(raw?.lon, -180, 180),
    countryCode:
      typeof raw?.countryCode === 'string' ? raw.countryCode.trim() : '',
    stateName: typeof raw?.stateName === 'string' ? raw.stateName.trim() : '',
    validAtMs: number(raw?.validAtMs, 0, Number.MAX_SAFE_INTEGER),
    aqi: number(raw?.aqi, -50, 999),
    pollutant: text(raw?.pollutant, 40),
  };
}

/**
 * Project only this layer's bounded snapshot contract from the server's own
 * `/api/air-quality` response; never trust it blindly across the network
 * boundary, even though the server already validated the upstream CSV.
 */
export function validateAirQualitySnapshot(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof value.stale !== 'boolean' ||
    typeof value.unavailable !== 'boolean' ||
    !Array.isArray(value.sites) ||
    value.sites.length > 10_000
  )
    throw malformed();
  const seen = new Set();
  const sites = value.sites.map((raw) => {
    const parsed = site(raw);
    if (seen.has(parsed.aqsid)) throw malformed();
    seen.add(parsed.aqsid);
    return parsed;
  });
  if (value.unavailable && sites.length) throw malformed();
  return {
    schemaVersion: 1,
    source: text(value.source, 120),
    attribution: text(value.attribution, 240),
    coverage: text(value.coverage, 400),
    fetchedAt:
      value.fetchedAt === null
        ? null
        : number(value.fetchedAt, 0, Number.MAX_SAFE_INTEGER),
    stale: value.stale,
    unavailable: value.unavailable,
    reason: value.reason === null ? null : text(value.reason, 240),
    sites,
  };
}
