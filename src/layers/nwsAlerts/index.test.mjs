import assert from 'node:assert/strict';
import test from 'node:test';
import { createNwsAlertsLayer } from './index.js';

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
  const layer = createNwsAlertsLayer({
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

const RING = [
  [-74.4, 40.7],
  [-74.2, 40.7],
  [-74.2, 40.9],
  [-74.4, 40.9],
  [-74.4, 40.7],
];

const row = {
  id: 'urn:test:alert-1',
  event: 'Flood Warning',
  severity: 'Severe',
  urgency: 'Immediate',
  certainty: 'Observed',
  headline: 'Flood Warning issued',
  areaDesc: 'Essex, NJ',
  senderName: 'NWS Newark NJ',
  effectiveMs: 1,
  expiresMs: 2,
  polygons: [[RING]],
  lon: -74.3,
  lat: 40.8,
};

test('a snapshot with one alert renders one polygon entity, one outline, and one overlay label', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  await h.layer.update(h.viewer);
  assert.equal(h.layer.getStats().count, 1);
  const dataSource = h.sources[0];
  assert.equal(dataSource.entities.values.length, 2); // polygon + outline
  assert.equal(h.events.length, 1);
  const [, entries] = h.events[0];
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, row.id);
});

test('an empty snapshot clears any previously drawn alerts', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  await h.layer.update(h.viewer);
  h.events.length = 0;
  const empty = harness({ getSnapshot: async () => [] });
  await empty.layer.update(empty.viewer);
  assert.equal(empty.layer.getStats().count, 0);
  assert.equal(empty.sources[0].entities.values.length, 0);
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
    resolve([row]);
    assert.equal(await pending, false);
    assert.equal(h.layer.getStats().count, 0);
    assert.equal(h.events.length, 0);
    h.layer.destroy(h.viewer);
  }
});

test('two displays own separate data sources and destruction', async () => {
  const a = harness({ getSnapshot: async () => [row] });
  const b = harness({ getSnapshot: async () => [] });
  await a.layer.update(a.viewer);
  await b.layer.update(b.viewer);
  assert.equal(a.layer.getStats().count, 1);
  assert.equal(b.layer.getStats().count, 0);
  a.layer.destroy();
  assert.equal(a.sources.length, 0);
  assert.equal(b.sources.length, 1);
  b.layer.destroy();
});

test('a fetch error keeps the last good display and reports the error in stats', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  await h.layer.update(h.viewer);
  const failing = harness({
    getSnapshot: async () => {
      throw new Error('upstream down');
    },
  });
  const ok = await failing.layer.update(failing.viewer);
  assert.equal(ok, false);
  assert.equal(failing.layer.getStats().error, 'upstream down');
});

test('getAnalystRecords returns [] while disabled and rows while enabled', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  await h.layer.update(h.viewer);
  assert.equal(h.layer.getAnalystRecords().length, 1);
  h.layer.disable(h.viewer);
  assert.deepEqual(h.layer.getAnalystRecords(), []);
});

test('constructing the layer without a snapshot source or overlay host throws', () => {
  assert.throws(() => createNwsAlertsLayer({}), TypeError);
  assert.throws(
    () => createNwsAlertsLayer({ source: { getSnapshot: async () => [] } }),
    TypeError,
  );
});
