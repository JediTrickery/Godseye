import * as Cesium from 'cesium';
import {
  AIR_QUALITY_OVERLAY_SOURCE_ID,
  AIR_QUALITY_OVERLAY_COHORT_LIMIT,
  AIR_QUALITY_OVERLAY_COLLISION_CAPACITY,
  aqiColor,
  createAirQualityOverlayEntry,
  selectAirQualityOverlayCohort,
  mapAnalystRecord,
} from './model.js';
export * from './model.js';
export { createAirQualitySource } from './source.js';

/** Own one air-quality display and its refresh lifecycle. */
export function createAirQualityLayer({ source, overlayHost } = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Air quality requires a snapshot source');
  if (!overlayHost) throw new TypeError('Air quality requires an overlay host');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _records = [];

  const layer = {
    id: 'air-quality',
    name: 'Air Quality (AQI)',
    icon: '🫧',
    source: 'AirNow',
    updateInterval: 600000,

    init(viewer) {
      if (_viewer) throw new Error('Air quality layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('air-quality');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _records = [];
      overlayHost.setVisible(AIR_QUALITY_OVERLAY_SOURCE_ID, false);
      console.log('[Data:AirQuality] Initialized');
    },

    enable(viewer) {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(AIR_QUALITY_OVERLAY_SOURCE_ID, true);
    },

    disable(viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(AIR_QUALITY_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(AIR_QUALITY_OVERLAY_SOURCE_ID, false);
    },

    async update(viewer) {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (snapshot.unavailable)
          throw new Error(snapshot.reason || 'Air quality unavailable');

        const nextEntities = [];
        const overlayEntries = [];
        let count = 0;

        for (const site of snapshot.sites) {
          count++;
          const color = aqiColor(site.aqi);
          const isPriority = site.aqi > 150;
          nextEntities.push(
            new Cesium.Entity({
              id: `air-quality:${site.aqsid}`,
              position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat),
              point: {
                pixelSize: isPriority ? 10 : 7,
                color,
                outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                aqsid: site.aqsid,
                siteName: site.siteName,
                aqi: site.aqi,
                pollutant: site.pollutant,
                countryCode: site.countryCode,
                stateName: site.stateName,
              },
            }),
          );

          if (isPriority) {
            overlayEntries.push(
              createAirQualityOverlayEntry({
                id: site.aqsid,
                position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat),
                aqi: site.aqi,
                accent: color.toCssColorString(),
              }),
            );
          }
        }

        _dataSource.entities.removeAll();
        for (const entity of nextEntities) _dataSource.entities.add(entity);
        if (_enabled) {
          overlayHost.setEntries(
            AIR_QUALITY_OVERLAY_SOURCE_ID,
            selectAirQualityOverlayCohort(overlayEntries),
            {
              cohortLimit: AIR_QUALITY_OVERLAY_COHORT_LIMIT,
              collisionCapacity: AIR_QUALITY_OVERLAY_COLLISION_CAPACITY,
              moving: false,
            },
          );
        }

        _records = snapshot.sites;
        _count = count;
        _lastUpdate = Date.now();
        _lastError = null;
        console.log(`[Data:AirQuality] Updated: ${_count} reporting sites`);
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:AirQuality] Fetch error:', e);
        _lastError = e?.message || 'Air quality source unavailable';
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
      overlayHost.clearSource(AIR_QUALITY_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(AIR_QUALITY_OVERLAY_SOURCE_ID, false);
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
     * Snapshot the layer's in-memory site records as plain JSON-safe
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
