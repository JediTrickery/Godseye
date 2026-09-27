import * as Cesium from 'cesium';

export const NWS_ALERTS_OVERLAY_SOURCE_ID = 'nws-alerts';
export const NWS_ALERTS_OVERLAY_COHORT_LIMIT = 64;
export const NWS_ALERTS_OVERLAY_COLLISION_CAPACITY = 32;

const SEVERITY_RANK = Object.freeze({
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
});

const SEVERITY_COLOR = Object.freeze({
  Extreme: Cesium.Color.fromCssColorString('#d32f2f'),
  Severe: Cesium.Color.fromCssColorString('#f57c00'),
  Moderate: Cesium.Color.fromCssColorString('#fbc02d'),
  Minor: Cesium.Color.fromCssColorString('#1976d2'),
  Unknown: Cesium.Color.fromCssColorString('#9e9e9e'),
});

/** Severity → fill/outline color. Unknown severities render as neutral gray. */
export function severityColor(severity) {
  return SEVERITY_COLOR[severity] || SEVERITY_COLOR.Unknown;
}

export function severityRank(severity) {
  return Object.hasOwn(SEVERITY_RANK, severity) ? SEVERITY_RANK[severity] : 0;
}

/** Build the source-owned presentation for one ambient alert-event label. */
export function createAlertOverlayEntry({
  id,
  position,
  event,
  severity,
  accent,
}) {
  return {
    id: String(id),
    position,
    variant: 'label',
    title: event,
    accent,
    priority: severityRank(severity) * 1000,
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

/** Keep the most severe alerts, with stable identity as the tie-break. */
export function selectAlertOverlayCohort(
  entries,
  limit = NWS_ALERTS_OVERLAY_COHORT_LIMIT,
) {
  const cap = Math.max(
    0,
    Math.min(NWS_ALERTS_OVERLAY_COHORT_LIMIT, Math.floor(Number(limit) || 0)),
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
 * Map one alert's raw plain values to a JSON-safe analyst record (analyst
 * query engine seam). Pure — no Cesium types.
 */
export function mapAnalystRecord(raw, index = 0) {
  const text = (v) => {
    const t = String(v ?? '').trim();
    return t || null;
  };
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    id: text(raw?.id) || `ALERT-${String(index).padStart(4, '0')}`,
    event: text(raw?.event),
    severity: text(raw?.severity),
    urgency: text(raw?.urgency),
    certainty: text(raw?.certainty),
    headline: text(raw?.headline),
    areaDesc: text(raw?.areaDesc),
    senderName: text(raw?.senderName),
    effectiveMs: num(raw?.effectiveMs),
    expiresMs: num(raw?.expiresMs),
    lat: num(raw?.lat),
    lon: num(raw?.lon),
  };
}

export { normalizeAlertSnapshot } from './records.js';
