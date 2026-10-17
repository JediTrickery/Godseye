import assert from 'node:assert/strict';
import test from 'node:test';
import { createAirQualitySource } from './source.js';

function fakeResponse({ ok = true, status = 200, json }) {
  return {
    ok,
    status,
    headers: { get: () => null },
    body: { cancel: async () => {} },
    async text() {
      return JSON.stringify(json);
    },
  };
}

const VALID_SNAPSHOT = {
  schemaVersion: 1,
  source: 'AirNow (files.airnowtech.org)',
  attribution: 'U.S. EPA AirNow',
  coverage: 'x',
  fetchedAt: 1,
  stale: false,
  unavailable: false,
  reason: null,
  sites: [],
};

test('getSnapshot fetches the same-origin endpoint and returns the validated snapshot', async () => {
  let calledUrl = null;
  const source = createAirQualitySource({
    fetchImpl: async (url) => {
      calledUrl = url;
      return fakeResponse({ json: VALID_SNAPSHOT });
    },
  });
  const snapshot = await source.getSnapshot({});
  assert.equal(calledUrl, '/api/air-quality');
  assert.deepEqual(snapshot.sites, []);
});

test('getSnapshot throws on a non-ok HTTP response', async () => {
  const source = createAirQualitySource({
    fetchImpl: async () => fakeResponse({ ok: false, status: 503 }),
  });
  await assert.rejects(() => source.getSnapshot({}), /Air quality HTTP 503/);
});

test('getSnapshot throws on a malformed payload rather than returning bad data', async () => {
  const source = createAirQualitySource({
    fetchImpl: async () => fakeResponse({ json: { not: 'a snapshot' } }),
  });
  await assert.rejects(() => source.getSnapshot({}));
});
