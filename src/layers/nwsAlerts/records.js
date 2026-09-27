const MAX_FEATURES = 2000;
const MAX_RING_POINTS = 5000;
const MAX_RINGS = 64;
const MAX_POLYGON_PARTS = 128;

const SEVERITIES = new Set([
  'Extreme',
  'Severe',
  'Moderate',
  'Minor',
  'Unknown',
]);
const URGENCIES = new Set([
  'Immediate',
  'Expected',
  'Future',
  'Past',
  'Unknown',
]);
const CERTAINTIES = new Set([
  'Observed',
  'Likely',
  'Possible',
  'Unlikely',
  'Unknown',
]);

function text(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** Snap an out-of-vocabulary CAP enum value to 'Unknown' instead of
 * rejecting the alert: NWS occasionally carries legacy or product-specific
 * values here, and this field is presentational, not safety-critical. */
function enumOrUnknown(value, allowed) {
  return typeof value === 'string' && allowed.has(value) ? value : 'Unknown';
}

function isoMs(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function ring(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 4 ||
    coordinates.length > MAX_RING_POINTS
  )
    return null;
  const points = [];
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const [lon, lat] = pair;
    if (
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180 ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90
    )
      return null;
    points.push([lon, lat]);
  }
  return points;
}

function polygonRings(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    !coordinates.length ||
    coordinates.length > MAX_RINGS
  )
    return null;
  const rings = coordinates.map(ring);
  return rings.some((value) => value === null) ? null : rings;
}

/**
 * Parses a GeoJSON alert geometry. Returns `{ok:true, polygons}` where
 * `polygons` is an array of ring-groups (one per Polygon/MultiPolygon part),
 * `{ok:true, polygons:null}` for the common case of a zone-only alert with
 * no polygon (valid, just not drawable here), or `{ok:false}` for anything
 * that does not match the CAP geometry contract.
 */
function parseGeometry(value) {
  if (value === null) return { ok: true, polygons: null };
  if (value?.type === 'Polygon') {
    const rings = polygonRings(value.coordinates);
    return rings ? { ok: true, polygons: [rings] } : { ok: false };
  }
  if (value?.type === 'MultiPolygon') {
    if (
      !Array.isArray(value.coordinates) ||
      !value.coordinates.length ||
      value.coordinates.length > MAX_POLYGON_PARTS
    )
      return { ok: false };
    const parts = value.coordinates.map(polygonRings);
    return parts.some((part) => part === null)
      ? { ok: false }
      : { ok: true, polygons: parts };
  }
  return { ok: false };
}

function centroid(polygons) {
  let sumLon = 0,
    sumLat = 0,
    count = 0;
  for (const rings of polygons) {
    for (const [lon, lat] of rings[0]) {
      sumLon += lon;
      sumLat += lat;
      count++;
    }
  }
  return count ? { lon: sumLon / count, lat: sumLat / count } : null;
}

/**
 * Validate one NWS alert feature. Returns a row, or null to SKIP just this
 * alert. Unlike a single-source feed (e.g. USGS earthquakes), NWS aggregates
 * independently-issued products from dozens of offices with real variance in
 * field length and enum usage — rejecting the whole nationwide snapshot over
 * one outlier alert would blank the layer far too often, so a bad individual
 * alert is dropped rather than poisoning every other active alert.
 */
function parseFeature(feature, seen) {
  if (feature?.type !== 'Feature') return null;
  const props = feature.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const id = text(props.id, 500);
  const event = text(props.event, 200);
  // areaDesc lists every affected county/zone, semicolon-separated — a
  // multi-state warning can legitimately run to several thousand characters.
  const areaDesc = text(props.areaDesc, 6000);
  const senderName = text(props.senderName, 300);
  const headline = props.headline == null ? null : text(props.headline, 1000);
  const effectiveMs = isoMs(props.effective);
  const expiresMs = isoMs(props.expires);
  if (
    !id ||
    !event ||
    !areaDesc ||
    !senderName ||
    (props.headline != null && headline === null) ||
    effectiveMs === null ||
    expiresMs === null ||
    seen.has(id)
  )
    return null;
  const geometry = parseGeometry(feature.geometry ?? null);
  if (!geometry.ok || !geometry.polygons) return null;
  const anchor = centroid(geometry.polygons);
  if (!anchor) return null;
  seen.add(id);
  return {
    id,
    event,
    severity: enumOrUnknown(props.severity, SEVERITIES),
    urgency: enumOrUnknown(props.urgency, URGENCIES),
    certainty: enumOrUnknown(props.certainty, CERTAINTIES),
    headline,
    areaDesc,
    senderName,
    effectiveMs,
    expiresMs,
    polygons: geometry.polygons,
    lon: anchor.lon,
    lat: anchor.lat,
  };
}

/**
 * Validate a complete NWS `alerts/active` FeatureCollection before it can
 * replace the last good snapshot. Only a structurally invalid feed (not a
 * FeatureCollection, an outsized feature count, or a feature that is not
 * even a Feature object) rejects the whole response; an individual alert
 * with unusable fields, a zone-only alert with no polygon, or a duplicate id
 * is simply left out of the result (see parseFeature).
 */
export function normalizeAlertSnapshot(geojson) {
  if (
    !geojson ||
    geojson.type !== 'FeatureCollection' ||
    !Array.isArray(geojson.features) ||
    geojson.features.length > MAX_FEATURES
  )
    return null;
  const seen = new Set();
  const rows = [];
  for (const feature of geojson.features) {
    if (feature?.type !== 'Feature') return null;
    const row = parseFeature(feature, seen);
    if (row) rows.push(row);
  }
  return rows;
}
