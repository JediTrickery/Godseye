import * as Cesium from 'cesium';
import {
  NWS_ALERTS_OVERLAY_SOURCE_ID,
  NWS_ALERTS_OVERLAY_COHORT_LIMIT,
  NWS_ALERTS_OVERLAY_COLLISION_CAPACITY,
  severityColor,
  createAlertOverlayEntry,
  selectAlertOverlayCohort,
  mapAnalystRecord,
} from './model.js';
export * from './model.js';
export { createNwsAlertsSource } from './source.js';

const cartesians = (ring) => Cesium.Cartesian3.fromDegreesArray(ring.flat());

/** Own one severe-weather-alert display and its refresh lifecycle. */
export function createNwsAlertsLayer({ source, overlayHost } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('NWS alerts require a snapshot source');
  if (!overlayHost) throw new TypeError('NWS alerts require an overlay host');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _records = [];

  const layer = {
    id: 'nws-alerts',
    name: 'Severe Weather Alerts',
    icon: '⚠️',
    source: 'NWS',
    updateInterval: 300000,

    init(viewer) {
      if (_viewer) throw new Error('NWS alerts layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('nws-alerts');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _records = [];
      overlayHost.setVisible(NWS_ALERTS_OVERLAY_SOURCE_ID, false);
      console.log('[Data:NwsAlerts] Initialized');
    },

    enable(viewer) {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(NWS_ALERTS_OVERLAY_SOURCE_ID, true);
    },

    disable(viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(NWS_ALERTS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(NWS_ALERTS_OVERLAY_SOURCE_ID, false);
    },

    async update(viewer) {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const rows = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;

        const nextEntities = [];
        const overlayEntries = [];
        let count = 0;

        for (const row of rows) {
          count++;
          const color = severityColor(row.severity);
          const isPriority =
            row.severity === 'Extreme' || row.severity === 'Severe';
          const fillAlpha = isPriority ? 0.28 : 0.16;
          const outlineAlpha = isPriority ? 1.0 : 0.75;

          row.polygons.forEach((rings, partIndex) => {
            const exterior = cartesians(rings[0]);
            const holes = rings
              .slice(1)
              .map((hole) => new Cesium.PolygonHierarchy(cartesians(hole)));
            nextEntities.push(
              new Cesium.Entity({
                id: `nws-alert:${row.id}:${partIndex}`,
                polygon: {
                  hierarchy: new Cesium.PolygonHierarchy(exterior, holes),
                  classificationType: Cesium.ClassificationType.BOTH,
                  material: new Cesium.ColorMaterialProperty(
                    color.withAlpha(fillAlpha),
                  ),
                  arcType: Cesium.ArcType.GEODESIC,
                },
                properties: {
                  alertId: row.id,
                  event: row.event,
                  severity: row.severity,
                  urgency: row.urgency,
                  headline: row.headline,
                  areaDesc: row.areaDesc,
                  senderName: row.senderName,
                },
              }),
            );
            for (const [ringIndex, positions] of [
              exterior,
              ...holes.map((hole) => hole.positions),
            ].entries()) {
              nextEntities.push(
                new Cesium.Entity({
                  id: `nws-alert:${row.id}:${partIndex}:outline:${ringIndex}`,
                  polyline: {
                    positions,
                    width: isPriority ? 2 : 1,
                    material: color.withAlpha(outlineAlpha),
                    arcType: Cesium.ArcType.GEODESIC,
                    clampToGround: true,
                    classificationType: Cesium.ClassificationType.BOTH,
                  },
                }),
              );
            }
          });

          overlayEntries.push(
            createAlertOverlayEntry({
              id: row.id,
              position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
              event: row.event,
              severity: row.severity,
              accent: color.toCssColorString(),
            }),
          );
        }

        _dataSource.entities.removeAll();
        for (const entity of nextEntities) _dataSource.entities.add(entity);
        if (_enabled) {
          overlayHost.setEntries(
            NWS_ALERTS_OVERLAY_SOURCE_ID,
            selectAlertOverlayCohort(overlayEntries),
            {
              cohortLimit: NWS_ALERTS_OVERLAY_COHORT_LIMIT,
              collisionCapacity: NWS_ALERTS_OVERLAY_COLLISION_CAPACITY,
              moving: false,
            },
          );
        }

        _records = rows;
        _count = count;
        _lastUpdate = Date.now();
        _lastError = null;
        console.log(`[Data:NwsAlerts] Updated: ${_count} active alerts`);
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:NwsAlerts] Fetch error:', e);
        _lastError = e?.message || 'NWS alerts source unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _viewer = null;
      _enabled = false;
      overlayHost.clearSource(NWS_ALERTS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(NWS_ALERTS_OVERLAY_SOURCE_ID, false);
      if (_dataSource) {
        viewer.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _records = [];
    },

    /**
     * Snapshot the layer's in-memory alert records as plain JSON-safe
     * objects for the analyst query engine. On-demand only, zero per-frame
     * cost. Returns [] while the layer is disabled or empty.
     */
    getAnalystRecords(maxCount = 2000) {
      if (!_enabled || !_records.length) return [];
      const limit = Number.isFinite(maxCount)
        ? Math.max(1, Math.floor(maxCount))
        : 2000;
      return _records
        .slice(0, limit)
        .map((row, index) => mapAnalystRecord(row, index));
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _lastError,
      };
    },
  };
  return layer;
}
