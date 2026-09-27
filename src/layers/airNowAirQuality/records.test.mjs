import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAirQualitySnapshot } from './records.js';

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    source: 'AirNow (files.airnowtech.org)',
    attribution: 'U.S. EPA AirNow',
    coverage: 'Active AQI monitoring sites reporting this UTC hour.',
    fetchedAt: 1000,
    stale: false,
    unavailable: false,
    reason: null,
    sites: [],
    ...overrides,
  };
}

const SITE = {
  aqsid: '010030010',
  siteName: 'FAIRHOPE',
  lat: 30.4889,
  lon: -87.8706,
  countryCode: 'US',
  stateName: 'AL',
  validAtMs: 1000,
  aqi: 52,
  pollutant: 'PM2.5',
};

test('a well-formed snapshot with one site validates through', () => {
  const result = validateAirQualitySnapshot(snapshot({ sites: [SITE] }));
  assert.equal(result.sites.length, 1);
  assert.equal(result.sites[0].aqsid, '010030010');
  assert.equal(result.sites[0].aqi, 52);
});

test('an empty sites array is valid (a quiet hour, not a failure)', () => {
  const result = validateAirQualitySnapshot(snapshot());
  assert.deepEqual(result.sites, []);
});

test('missing schemaVersion is rejected', () => {
  assert.throws(() => validateAirQualitySnapshot(snapshot({ schemaVersion: 2 })));
});

test('out-of-range coordinates are rejected', () => {
  const bad = { ...SITE, lat: 999 };
  assert.throws(() => validateAirQualitySnapshot(snapshot({ sites: [bad] })));
});

test('a duplicate aqsid is rejected', () => {
  assert.throws(() =>
    validateAirQualitySnapshot(snapshot({ sites: [SITE, SITE] })),
  );
});

test('unavailable:true with a non-empty sites array is rejected as inconsistent', () => {
  assert.throws(() =>
    validateAirQualitySnapshot(
      snapshot({ unavailable: true, sites: [SITE] }),
    ),
  );
});

test('unavailable:true with no sites is valid and carries the reason through', () => {
  const result = validateAirQualitySnapshot(
    snapshot({ unavailable: true, reason: 'Air quality unavailable' }),
  );
  assert.equal(result.unavailable, true);
  assert.equal(result.reason, 'Air quality unavailable');
});

test('null input and a bare object are both rejected', () => {
  assert.throws(() => validateAirQualitySnapshot(null));
  assert.throws(() => validateAirQualitySnapshot({}));
});
