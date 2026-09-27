import assert from 'node:assert/strict';
import test from 'node:test';
import * as Cesium from 'cesium';
import {
  aqiCategoryName,
  aqiColor,
  selectAirQualityOverlayCohort,
  mapAnalystRecord,
} from './model.js';

test('aqiCategoryName maps the standard EPA breakpoints', () => {
  assert.equal(aqiCategoryName(0), 'Good');
  assert.equal(aqiCategoryName(50), 'Good');
  assert.equal(aqiCategoryName(51), 'Moderate');
  assert.equal(aqiCategoryName(100), 'Moderate');
  assert.equal(aqiCategoryName(101), 'Unhealthy for Sensitive Groups');
  assert.equal(aqiCategoryName(150), 'Unhealthy for Sensitive Groups');
  assert.equal(aqiCategoryName(151), 'Unhealthy');
  assert.equal(aqiCategoryName(200), 'Unhealthy');
  assert.equal(aqiCategoryName(201), 'Very Unhealthy');
  assert.equal(aqiCategoryName(300), 'Very Unhealthy');
  assert.equal(aqiCategoryName(301), 'Hazardous');
  assert.equal(aqiCategoryName(500), 'Hazardous');
  assert.equal(aqiCategoryName(NaN), 'Unknown');
});

test('aqiColor gives a distinct color per category and a gray fallback for non-finite input', () => {
  const good = aqiColor(25).toCssColorString();
  const hazardous = aqiColor(400).toCssColorString();
  assert.notEqual(good, hazardous);
  assert.equal(aqiColor(NaN).toCssColorString(), Cesium.Color.GRAY.toCssColorString());
});

test('selectAirQualityOverlayCohort keeps the worst readings within the cap', () => {
  const entries = [
    { id: 'a', priority: 500 },
    { id: 'b', priority: 2000 },
    { id: 'c', priority: 1000 },
  ];
  const cohort = selectAirQualityOverlayCohort(entries, 2);
  assert.deepEqual(
    cohort.map((e) => e.id),
    ['b', 'c'],
  );
});

test('mapAnalystRecord produces a JSON-safe plain object with derived category', () => {
  const record = mapAnalystRecord(
    {
      aqsid: '010030010',
      siteName: 'FAIRHOPE',
      countryCode: 'US',
      stateName: 'AL',
      aqi: 152,
      pollutant: 'PM2.5',
      validAtMs: 1000,
      lat: 30.4889,
      lon: -87.8706,
    },
    0,
  );
  assert.equal(record.id, '010030010');
  assert.equal(record.category, 'Unhealthy');
  assert.equal(record.pollutant, 'PM2.5');

  const fallback = mapAnalystRecord(null, 3);
  assert.equal(fallback.id, 'AQ-0003');
  assert.equal(fallback.aqi, null);
});
