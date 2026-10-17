import assert from 'node:assert/strict';
import test from 'node:test';
import { createAirQualityLayer } from './index.js';

function harness(source) {
  const sources = [];
  const events = [];
  const viewer = {
    dataSources: {
      add(value) {
        sources.push(value);
      },
      remove(value) {
        sources.splice(sources.indexOf(value), 1);
      },
    },
  };
  const layer = createAirQualityLayer({
    source,
    overlayHost: {
      setEntries(...args) {
        events.push(args);
      },
      setVisible() {},
      clearSource() {},
    },
  });
  layer.init(viewer);
  layer.enable(viewer);
  return { layer, viewer, sources, events };
}

function snapshot(sites) {
  return {
    schemaVersion: 1,
    source: 'AirNow',
    attribution: 'x',
    coverage: 'x',
    fetchedAt: 1,
    stale: false,
    unavailable: false,
    reason: null,
    sites,
  };
}

const site = {
  aqsid: '010030010',
  siteName: 'FAIRHOPE',
  lat: 30.4889,
  lon: -87.8706,
  countryCode: 'US',
  stateName: 'AL',
  validAtMs: 1,
  aqi: 52,
  pollutant: 'PM2.5',
};

const hazardousSite = { ...site, aqsid: 'hazard-1', aqi: 320 };

test('a snapshot with one moderate site renders a point but no overlay label (below priority threshold)', async () => {
  const h = harness({ getSnapshot: async () => snapshot([site]) });
  await h.layer.update(h.viewer);
  assert.equal(h.layer.getStats().count, 1);
  assert.equal(h.sources[0].entities.values.length, 1);
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0][1].length, 0); // no label — AQI 52 is not a priority site
});

test('a hazardous-AQI site earns an overlay label', async () => {
  const h = harness({ getSnapshot: async () => snapshot([hazardousSite]) });
  await h.layer.update(h.viewer);
  const [, entries] = h.events[0];
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'hazard-1');
});

test('an unavailable snapshot is treated as an error, not an empty result', async () => {
  const h = harness({
    getSnapshot: async () => ({
      schemaVersion: 1,
      source: 'AirNow',
      attribution: 'x',
      coverage: 'x',
      fetchedAt: null,
      stale: true,
      unavailable: true,
      reason: 'Air quality unavailable',
      sites: [],
    }),
  });
  const ok = await h.layer.update(h.viewer);
  assert.equal(ok, false);
  assert.equal(h.layer.getStats().error, 'Air quality unavailable');
});

test('late refresh cannot publish after disable, re-enable, or destroy', async () => {
  for (const action of ['disable', 'destroy']) {
    let resolve, signal;
    const h = harness({
      getSnapshot(options) {
        signal = options.signal;
        return new Promise((done) => {
          resolve = done;
        });
      },
    });
    const pending = h.layer.update(h.viewer);
    h.layer[action](h.viewer);
    assert.equal(signal.aborted, true);
    if (action === 'disable') h.layer.enable(h.viewer);
    resolve(snapshot([site]));
    assert.equal(await pending, false);
    assert.equal(h.layer.getStats().count, 0);
    assert.equal(h.events.length, 0);
    h.layer.destroy(h.viewer);
  }
});

test('two displays own separate data sources and destruction', async () => {
  const a = harness({ getSnapshot: async () => snapshot([site]) });
  const b = harness({ getSnapshot: async () => snapshot([]) });
  await a.layer.update(a.viewer);
  await b.layer.update(b.viewer);
  assert.equal(a.layer.getStats().count, 1);
  assert.equal(b.layer.getStats().count, 0);
  a.layer.destroy();
  assert.equal(a.sources.length, 0);
  assert.equal(b.sources.length, 1);
  b.layer.destroy();
});

test('getAnalystRecords returns [] while disabled and rows while enabled', async () => {
  const h = harness({ getSnapshot: async () => snapshot([site]) });
  await h.layer.update(h.viewer);
  assert.equal(h.layer.getAnalystRecords().length, 1);
  h.layer.disable(h.viewer);
  assert.deepEqual(h.layer.getAnalystRecords(), []);
});

test('constructing the layer without a snapshot source or overlay host throws', () => {
  assert.throws(() => createAirQualityLayer({}), TypeError);
  assert.throws(
    () => createAirQualityLayer({ source: { getSnapshot: async () => [] } }),
    TypeError,
  );
});
