import assert from 'node:assert/strict';
import test from 'node:test';
import { isLikelyAirNowCsv, parseAirNowCsv } from './airNowCsv.js';

// Real rows from a live HourlyAQObs_2026092715.dat download (verified 2026-09-27).
const HEADER =
  '"AQSID","SiteName","Status","EPARegion","Latitude","Longitude","Elevation","GMTOffset","CountryCode","StateName","ValidDate","ValidTime","DataSource","ReportingArea_PipeDelimited","OZONE_AQI","PM10_AQI","PM25_AQI","NO2_AQI","OZONE_Measured","PM10_Measured","PM25_Measured","NO2_Measured","PM25","PM25_Unit","OZONE","OZONE_Unit","NO2","NO2_Unit","CO","CO_Unit","SO2","SO2_Unit","PM10","PM10_Unit"';
const ROW_FAIRHOPE =
  '"010030010","FAIRHOPE","Active","R4","30.4889","-87.8706","0.0","-6","US","AL","09/27/2026","15:00","Alabama Department of Environmental Management","Mobile","38","","52","","1","0","1","0","10.6","UG/M3","43.0","PPB","","","","","","","",""';
const ROW_ASHLAND =
  '"010270001","ASHLAND","Active","R4","33.2811","-85.8022","0.0","-6","US","AL","09/27/2026","15:00","Alabama Department of Environmental Management","","","","14","","0","0","1","0","5.3","UG/M3","","","","","","","","","",""';
const ROW_MSHOALS_INACTIVE =
  '"010331002","MSHOALS","Inactive","R4","34.7606","-87.6506","0.0","-6","US","AL","09/27/2026","15:00","Alabama Department of Environmental Management","","","","","","1","0","1","0","","","","","","","","","","","",""';
const ROW_SOUTHAMPTON_NO_AQI =
  '"000020401","SOUTHAMPTON","Active","CA","46.3864","-62.5828","15.3","-4","CA","CC","09/27/2026","15:00","Canada-Prince Edward Island1","","","","","","1","0","1","1","","","","","","","","","","","",""';

test('isLikelyAirNowCsv accepts the real header and rejects an HTML error page', () => {
  assert.equal(isLikelyAirNowCsv(`${HEADER}\n${ROW_FAIRHOPE}`), true);
  assert.equal(isLikelyAirNowCsv('<html><body>404</body></html>'), false);
  assert.equal(isLikelyAirNowCsv(''), false);
  assert.equal(isLikelyAirNowCsv(null), false);
});

test('a site with two reported pollutants takes the max as overall AQI', () => {
  const rows = parseAirNowCsv(`${HEADER}\n${ROW_FAIRHOPE}`);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.aqsid, '010030010');
  assert.equal(row.siteName, 'FAIRHOPE');
  assert.equal(row.lat, 30.4889);
  assert.equal(row.lon, -87.8706);
  assert.equal(row.countryCode, 'US');
  assert.equal(row.aqi, 52); // PM25_AQI(52) beats OZONE_AQI(38)
  assert.equal(row.pollutant, 'PM2.5');
  assert.equal(row.validAtMs, Date.parse('2026-09-27T15:00:00Z'));
});

test('a site with one reported pollutant uses it directly', () => {
  const rows = parseAirNowCsv(`${HEADER}\n${ROW_ASHLAND}`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].aqi, 14);
  assert.equal(rows[0].pollutant, 'PM2.5');
});

test('an inactive site is skipped', () => {
  assert.deepEqual(parseAirNowCsv(`${HEADER}\n${ROW_MSHOALS_INACTIVE}`), []);
});

test('an active site with no reported AQI value is skipped, not treated as zero', () => {
  assert.deepEqual(
    parseAirNowCsv(`${HEADER}\n${ROW_SOUTHAMPTON_NO_AQI}`),
    [],
  );
});

test('multiple rows parse independently and malformed rows are skipped', () => {
  const malformedShortRow = '"only","three","cells"';
  const rows = parseAirNowCsv(
    [HEADER, ROW_FAIRHOPE, malformedShortRow, ROW_ASHLAND].join('\n'),
  );
  assert.deepEqual(
    rows.map((r) => r.aqsid),
    ['010030010', '010270001'],
  );
});

test('non-CSV input returns null rather than an empty array', () => {
  assert.equal(parseAirNowCsv('<html>not this</html>'), null);
});

test('out-of-range coordinates are skipped', () => {
  const badRow = ROW_FAIRHOPE.replace('"30.4889","-87.8706"', '"999","-87.8706"');
  assert.deepEqual(parseAirNowCsv(`${HEADER}\n${badRow}`), []);
});

test('trailing blank lines and CRLF endings do not break parsing', () => {
  const rows = parseAirNowCsv(`${HEADER}\r\n${ROW_FAIRHOPE}\r\n\r\n`);
  assert.equal(rows.length, 1);
});
