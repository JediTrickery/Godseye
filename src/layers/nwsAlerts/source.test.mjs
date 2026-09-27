import assert from 'node:assert/strict';
import test from 'node:test';
import { createNwsAlertsSource } from './source.js';

function fakeResponse({ ok = true, status = 200, json }) {
  return { ok, status, json: async () => json };
}

const VALID_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

test('getSnapshot fetches the active-alerts endpoint and returns normalized rows', async () => {
  let calledUrl = null;
  const source = createNwsAlertsSource({
    fetchImpl: async (url) => {
      calledUrl = url;
      return fakeResponse({ json: VALID_COLLECTION });
    },
  });
  const rows = await source.getSnapshot({});
  assert.deepEqual(rows, []);
  assert.ok(String(calledUrl).startsWith('https://api.weather.gov/alerts/active'));
});

test('getSnapshot throws on a non-ok HTTP response', async () => {
  const source = createNwsAlertsSource({
    fetchImpl: async () => fakeResponse({ ok: false, status: 503, json: null }),
  });
  await assert.rejects(() => source.getSnapshot({}), /NWS alerts HTTP 503/);
});

test('getSnapshot throws on a malformed payload rather than returning bad rows', async () => {
  const source = createNwsAlertsSource({
    fetchImpl: async () => fakeResponse({ json: { not: 'a feature collection' } }),
  });
  await assert.rejects(() => source.getSnapshot({}), /Malformed NWS alerts response/);
});

test('getSnapshot honors an already-aborted signal', async () => {
  const source = createNwsAlertsSource({
    fetchImpl: async () => fakeResponse({ json: VALID_COLLECTION }),
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => source.getSnapshot({ signal: controller.signal }));
});
