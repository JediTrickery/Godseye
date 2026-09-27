const MAX_FEATURES = 2000;
const MAX_RING_POINTS = 5000;
const MAX_RINGS = 20;
const MAX_POLYGON_PARTS = 50;

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
 * Validate a complete NWS `alerts/active` FeatureCollection before it can
 * replace the last good snapshot. A structurally malformed feature rejects
 * the whole feed (matching the project's other feeds); a well-formed alert
 * with no polygon (zone-only, common for NWS) is simply skipped, since it
 * carries nothing this layer can draw.
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
    const props = feature.properties;
    if (!props || typeof props !== 'object' || Array.isArray(props))
      return null;
    const id = text(props.id, 300);
    const event = text(props.event, 120);
    const severity = props.severity;
    const urgency = props.urgency ?? 'Unknown';
    const certainty = props.certainty ?? 'Unknown';
    const areaDesc = text(props.areaDesc, 800);
    const senderName = text(props.senderName, 160);
    const headline = props.headline === null ? null : text(props.headline, 400);
    const effectiveMs = isoMs(props.effective);
    const expiresMs = isoMs(props.expires);
    if (
      !id ||
      !event ||
      !SEVERITIES.has(severity) ||
      !URGENCIES.has(urgency) ||
      !CERTAINTIES.has(certainty) ||
      !areaDesc ||
      !senderName ||
      (props.headline !== null && headline === null) ||
      effectiveMs === null ||
      expiresMs === null
    )
      return null;
    if (seen.has(id)) return null;
    seen.add(id);
    const geometry = parseGeometry(feature.geometry ?? null);
    if (!geometry.ok) return null;
    if (!geometry.polygons) continue;
    const anchor = centroid(geometry.polygons);
    if (!anchor) continue;
    rows.push({
      id,
      event,
      severity,
      urgency,
      certainty,
      headline,
      areaDesc,
      senderName,
      effectiveMs,
      expiresMs,
      polygons: geometry.polygons,
      lon: anchor.lon,
      lat: anchor.lat,
    });
  }
  return rows;
}
