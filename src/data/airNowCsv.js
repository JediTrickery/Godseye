/**
 * AirNow "HourlyAQObs" bulk file parsing — pure functions, no Cesium/DOM/network.
 *
 * Upstream: https://files.airnowtech.org/airnow/{yyyy}/{yyyymmdd}/HourlyAQObs_{yyyymmddhh}.dat
 * Keyless static file, updated twice hourly, covering ~4,400 monitoring
 * sites worldwide (US/Canada/Mexico plus U.S. State Department posts
 * abroad) for the given UTC hour.
 *
 * Confirmed live header (verified 2026-09-27, a real downloaded file, not
 * upstream documentation — the published fact sheet is incomplete/stale):
 *   "AQSID","SiteName","Status","EPARegion","Latitude","Longitude",
 *   "Elevation","GMTOffset","CountryCode","StateName","ValidDate",
 *   "ValidTime","DataSource","ReportingArea_PipeDelimited","OZONE_AQI",
 *   "PM10_AQI","PM25_AQI","NO2_AQI","OZONE_Measured","PM10_Measured",
 *   "PM25_Measured","NO2_Measured","PM25","PM25_Unit","OZONE","OZONE_Unit",
 *   "NO2","NO2_Unit","CO","CO_Unit","SO2","SO2_Unit","PM10","PM10_Unit"
 *
 * Quirks this module owns:
 * - Every field is double-quoted, even numeric ones; a missing value is `""`.
 * - `ValidDate`/`ValidTime` are already UTC (they match the file's own hour,
 *   e.g. a file named `..._15.dat` carries `ValidTime` "15:00") — no
 *   `GMTOffset` arithmetic needed; that field describes the station's own
 *   local offset, not a correction to apply here.
 * - A site reports only the pollutants it measures — most rows leave most of
 *   the four `*_AQI` columns empty (`""`). The overall AQI for a site is the
 *   max of whatever `*_AQI` columns it did report (standard EPA practice).
 * - `Status` is `"Active"` or `"Inactive"`; an inactive site still appears in
 *   the file (usually with no AQI values) and is skipped here.
 */

/** Header fields that must all be present for a payload to count as this file. */
const REQUIRED_HEADER_FIELDS = [
  'AQSID',
  'SiteName',
  'Status',
  'Latitude',
  'Longitude',
  'ValidDate',
  'ValidTime',
];

const AQI_COLUMNS = Object.freeze([
  { key: 'OZONE_AQI', pollutant: 'Ozone' },
  { key: 'PM25_AQI', pollutant: 'PM2.5' },
  { key: 'PM10_AQI', pollutant: 'PM10' },
  { key: 'NO2_AQI', pollutant: 'NO2' },
]);

/** Split one line of the quoted-CSV format into raw (still-quoted) cells. */
function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

/** Cheap "is this actually the AirNow HourlyAQObs file?" check. */
export function isLikelyAirNowCsv(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trimStart();
  if (!trimmed || trimmed[0] === '<') return false;
  const headerLine = trimmed.slice(
    0,
    trimmed.indexOf('\n') === -1 ? undefined : trimmed.indexOf('\n'),
  );
  const fields = splitCsvLine(headerLine.trim());
  return REQUIRED_HEADER_FIELDS.every((required) => fields.includes(required));
}

/** Build a UTC epoch-ms timestamp from "MM/DD/YYYY" + "HH:MM" (both already UTC). */
function validAtMsUtc(validDate, validTime) {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(validDate ?? ''));
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(validTime ?? ''));
  if (!dateMatch || !timeMatch) return NaN;
  const [, mm, dd, yyyy] = dateMatch;
  const [, hh, min] = timeMatch;
  return Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`);
}

/**
 * Parse an AirNow HourlyAQObs payload into site AQI records. Tolerates
 * trailing newlines and short/malformed rows (skipped). A row with no
 * reported AQI value, an inactive site, or invalid coordinates is skipped —
 * not treated as an upstream failure. Non-CSV input (HTML/error page)
 * returns null so callers can distinguish "no data this hour" from
 * "upstream failure".
 *
 * @param {string} text - Raw file body.
 * @returns {?Array<{aqsid: string, siteName: string, lat: number, lon: number,
 *   countryCode: string, stateName: string, validAtMs: number, aqi: number,
 *   pollutant: string}>}
 */
export function parseAirNowCsv(text) {
  if (!isLikelyAirNowCsv(text)) return null;
  const lines = text.split('\n');
  let headerIndex = 0;
  while (headerIndex < lines.length && !lines[headerIndex].trim())
    headerIndex += 1;
  const header = splitCsvLine(lines[headerIndex].trim());
  const col = new Map(header.map((name, i) => [name, i]));
  const iAqsid = col.get('AQSID');
  const iSiteName = col.get('SiteName');
  const iStatus = col.get('Status');
  const iLat = col.get('Latitude');
  const iLon = col.get('Longitude');
  const iCountry = col.get('CountryCode');
  const iState = col.get('StateName');
  const iValidDate = col.get('ValidDate');
  const iValidTime = col.get('ValidTime');
  const aqiCols = AQI_COLUMNS.map(({ key, pollutant }) => ({
    index: col.get(key),
    pollutant,
  })).filter(({ index }) => index !== undefined);

  const records = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line);
    if (cells.length < header.length) continue;
    if (cells[iStatus] !== 'Active') continue;
    const lat = Number(cells[iLat]);
    const lon = Number(cells[iLon]);
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180
    )
      continue;
    let aqi = -Infinity;
    let pollutant = null;
    for (const { index, pollutant: name } of aqiCols) {
      const raw = cells[index];
      if (raw === '') continue; // empty cell = not reported, not zero
      const value = Number(raw);
      if (Number.isFinite(value) && value > aqi) {
        aqi = value;
        pollutant = name;
      }
    }
    if (pollutant === null) continue; // nothing reported this hour
    const validAtMs = validAtMsUtc(cells[iValidDate], cells[iValidTime]);
    if (!Number.isFinite(validAtMs)) continue;
    const aqsid = String(cells[iAqsid] ?? '').trim();
    if (!aqsid) continue;
    records.push({
      aqsid,
      siteName: String(cells[iSiteName] ?? '').trim() || aqsid,
      lat,
      lon,
      countryCode: String(cells[iCountry] ?? '').trim(),
      stateName: String(cells[iState] ?? '').trim(),
      validAtMs,
      aqi,
      pollutant,
    });
  }
  return records;
}
