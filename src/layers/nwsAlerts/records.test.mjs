import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAlertSnapshot } from './records.js';

const RING = [
  [-74.4, 40.7],
  [-74.2, 40.7],
  [-74.2, 40.9],
  [-74.4, 40.9],
  [-74.4, 40.7],
];

function feature(overrides = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [RING] },
    properties: {
      id: 'urn:oid:2.49.0.1.840.0.alert-1',
      event: 'Flood Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      certainty: 'Observed',
      headline: 'Flood Warning issued',
      areaDesc: 'Essex, NJ',
      senderName: 'NWS Newark NJ',
      effective: '2026-09-27T10:00:00-04:00',
      expires: '2026-09-27T18:00:00-04:00',
      ...overrides,
    },
  };
}

function collection(features) {
  return { type: 'FeatureCollection', features };
}

test('a well-formed alert normalizes with a polygon and a centroid', () => {
  const rows = normalizeAlertSnapshot(collection([feature()]));
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.id, 'urn:oid:2.49.0.1.840.0.alert-1');
  assert.equal(row.event, 'Flood Warning');
  assert.equal(row.severity, 'Severe');
  assert.equal(row.polygons.length, 1);
  assert.equal(row.polygons[0][0].length, RING.length);
  assert.ok(Number.isFinite(row.lon) && Number.isFinite(row.lat));
});

test('a MultiPolygon alert normalizes with one ring-group per part', () => {
  const multi = {
    ...feature({ id: 'multi-1' }),
    geometry: { type: 'MultiPolygon', coordinates: [[RING], [RING]] },
  };
  const rows = normalizeAlertSnapshot(collection([multi]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].polygons.length, 2);
});

test('a zone-only alert (no geometry) is skipped, not rejected', () => {
  const zoneOnly = { ...feature({ id: 'zone-1' }), geometry: null };
  const rows = normalizeAlertSnapshot(collection([zoneOnly]));
  assert.deepEqual(rows, []);
});

test('an unsupported geometry type rejects the whole snapshot', () => {
  const bad = { ...feature(), geometry: { type: 'Point', coordinates: [-74, 40] } };
  assert.equal(normalizeAlertSnapshot(collection([bad])), null);
});

test('an unknown severity value rejects the whole snapshot', () => {
  const bad = feature({ severity: 'Catastrophic' });
  assert.equal(normalizeAlertSnapshot(collection([bad])), null);
});

test('an unparseable effective/expires timestamp rejects the whole snapshot', () => {
  const bad = feature({ effective: 'not-a-date' });
  assert.equal(normalizeAlertSnapshot(collection([bad])), null);
});

test('out-of-range coordinates reject the whole snapshot', () => {
  const bad = {
    ...feature(),
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-200, 40.7],
          [-74.2, 40.7],
          [-74.2, 40.9],
          [-200, 40.7],
        ],
      ],
    },
  };
  assert.equal(normalizeAlertSnapshot(collection([bad])), null);
});

test('a duplicate alert id rejects the whole snapshot', () => {
  assert.equal(
    normalizeAlertSnapshot(collection([feature(), feature()])),
    null,
  );
});

test('a missing required field rejects the whole snapshot', () => {
  const bad = feature({ areaDesc: undefined });
  delete bad.properties.areaDesc;
  assert.equal(normalizeAlertSnapshot(collection([bad])), null);
});

test('a non-FeatureCollection payload is rejected outright', () => {
  assert.equal(normalizeAlertSnapshot({ type: 'Feature' }), null);
  assert.equal(normalizeAlertSnapshot(null), null);
});

test('urgency and certainty default to Unknown when absent', () => {
  const bare = feature();
  delete bare.properties.urgency;
  delete bare.properties.certainty;
  const rows = normalizeAlertSnapshot(collection([bare]));
  assert.equal(rows[0].urgency, 'Unknown');
  assert.equal(rows[0].certainty, 'Unknown');
});

test('a null headline is preserved as null, not rejected', () => {
  const rows = normalizeAlertSnapshot(
    collection([feature({ headline: null })]),
  );
  assert.equal(rows[0].headline, null);
});
