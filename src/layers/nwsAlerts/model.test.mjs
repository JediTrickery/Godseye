import assert from 'node:assert/strict';
import test from 'node:test';
import {
  severityColor,
  severityRank,
  selectAlertOverlayCohort,
  mapAnalystRecord,
} from './model.js';

test('severityColor returns a distinct color per known severity and a gray fallback', () => {
  const extreme = severityColor('Extreme').toCssColorString();
  const severe = severityColor('Severe').toCssColorString();
  const unknown = severityColor('Unknown').toCssColorString();
  const bogus = severityColor('not-a-real-severity').toCssColorString();
  assert.notEqual(extreme, severe);
  assert.equal(bogus, unknown);
});

test('severityRank orders severities Extreme > Severe > Moderate > Minor > Unknown', () => {
  assert.ok(severityRank('Extreme') > severityRank('Severe'));
  assert.ok(severityRank('Severe') > severityRank('Moderate'));
  assert.ok(severityRank('Moderate') > severityRank('Minor'));
  assert.ok(severityRank('Minor') > severityRank('Unknown'));
  assert.equal(severityRank('nonsense'), 0);
});

test('selectAlertOverlayCohort keeps the most severe entries within the cap', () => {
  const entries = [
    { id: 'a', priority: 1000 },
    { id: 'b', priority: 4000 },
    { id: 'c', priority: 2000 },
  ];
  const cohort = selectAlertOverlayCohort(entries, 2);
  assert.deepEqual(
    cohort.map((e) => e.id),
    ['b', 'c'],
  );
});

test('selectAlertOverlayCohort breaks priority ties by id for determinism', () => {
  const entries = [
    { id: 'z', priority: 1000 },
    { id: 'a', priority: 1000 },
  ];
  const cohort = selectAlertOverlayCohort(entries, 2);
  assert.deepEqual(
    cohort.map((e) => e.id),
    ['a', 'z'],
  );
});

test('selectAlertOverlayCohort tolerates non-array input', () => {
  assert.deepEqual(selectAlertOverlayCohort(null), []);
  assert.deepEqual(selectAlertOverlayCohort(undefined), []);
});

test('mapAnalystRecord produces a JSON-safe plain object with a fallback id', () => {
  const record = mapAnalystRecord(
    {
      id: '  urn:test  ',
      event: 'Flood Warning',
      severity: 'Severe',
      urgency: 'Immediate',
      certainty: 'Observed',
      headline: null,
      areaDesc: 'Essex, NJ',
      senderName: 'NWS Newark NJ',
      effectiveMs: 1,
      expiresMs: 2,
      lat: 40.8,
      lon: -74.3,
    },
    0,
  );
  assert.deepEqual(record, {
    id: 'urn:test',
    event: 'Flood Warning',
    severity: 'Severe',
    urgency: 'Immediate',
    certainty: 'Observed',
    headline: null,
    areaDesc: 'Essex, NJ',
    senderName: 'NWS Newark NJ',
    effectiveMs: 1,
    expiresMs: 2,
    lat: 40.8,
    lon: -74.3,
  });

  const fallback = mapAnalystRecord(null, 3);
  assert.equal(fallback.id, 'ALERT-0003');
  assert.equal(fallback.event, null);
  assert.equal(fallback.lat, null);
});
