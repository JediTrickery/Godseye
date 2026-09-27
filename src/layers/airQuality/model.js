import * as Cesium from 'cesium';

export const AIR_QUALITY_OVERLAY_SOURCE_ID = 'air-quality';
export const AIR_QUALITY_OVERLAY_COHORT_LIMIT = 64;
export const AIR_QUALITY_OVERLAY_COLLISION_CAPACITY = 32;

/** Standard EPA AQI breakpoints and their official category colors. */
const CATEGORIES = Object.freeze([
  {
    max: 50,
    name: 'Good',
    color: Cesium.Color.fromCssColorString('#00e400'),
  },
  {
    max: 100,
    name: 'Moderate',
    color: Cesium.Color.fromCssColorString('#ffff00'),
  },
  {
    max: 150,
    name: 'Unhealthy for Sensitive Groups',
    color: Cesium.Color.fromCssColorString('#ff7e00'),
  },
  {
    max: 200,
    name: 'Unhealthy',
    color: Cesium.Color.fromCssColorString('#ff0000'),
  },
  {
    max: 300,
    name: 'Very Unhealthy',
    color: Cesium.Color.fromCssColorString('#8f3f97'),
  },
  {
    max: Infinity,
    name: 'Hazardous',
    color: Cesium.Color.fromCssColorString('#7e0023'),
  },
]);

/** The EPA category name for an AQI value. */
export function aqiCategoryName(aqi) {
  const value = Number(aqi);
  if (!Number.isFinite(value)) return 'Unknown';
  return (CATEGORIES.find((c) => value <= c.max) || CATEGORIES.at(-1)).name;
}

/** The EPA category color for an AQI value. */
export function aqiColor(aqi) {
  const value = Number(aqi);
  if (!Number.isFinite(value)) return Cesium.Color.GRAY;
  return (CATEGORIES.find((c) => value <= c.max) || CATEGORIES.at(-1)).color;
}

/** Build the source-owned presentation for one ambient AQI label. */
export function createAirQualityOverlayEntry({ id, position, aqi, accent }) {
  return {
    id: String(id),
    position,
    variant: 'label',
    title: `AQI ${Math.round(aqi)}`,
    accent,
    priority: Math.round(aqi * 10),
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Keep the worst air quality readings, with stable identity as the tie-break. */
export function selectAirQualityOverlayCohort(
  entries,
  limit = AIR_QUALITY_OVERLAY_COHORT_LIMIT,
) {
  const cap = Math.max(
    0,
    Math.min(AIR_QUALITY_OVERLAY_COHORT_LIMIT, Math.floor(Number(limit) || 0)),
  );
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries
    .slice()
    .sort(
      (a, b) =>
        b.priority - a.priority || String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, cap);
}

/**
 * Map one site's raw plain values to a JSON-safe analyst record (analyst
 * query engine seam). Pure — no Cesium types.
 */
export function mapAnalystRecord(raw, index = 0) {
  const text = (v) => {
    const t = String(v ?? '').trim();
    return t || null;
  };
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    id: text(raw?.aqsid) || `AQ-${String(index).padStart(4, '0')}`,
    siteName: text(raw?.siteName),
    countryCode: text(raw?.countryCode),
    stateName: text(raw?.stateName),
    aqi: num(raw?.aqi),
    category: text(raw?.aqi != null ? aqiCategoryName(raw.aqi) : null),
    pollutant: text(raw?.pollutant),
    validAtMs: num(raw?.validAtMs),
    lat: num(raw?.lat),
    lon: num(raw?.lon),
  };
}
