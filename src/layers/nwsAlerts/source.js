import { normalizeAlertSnapshot } from './records.js';

/** `status=actual` drops test/exercise messages; `message_type=alert` drops
 * update/cancel duplicates of an alert already carried by its own entry. */
const API_URL =
  'https://api.weather.gov/alerts/active?status=actual&message_type=alert';

/** Request and validate a complete NWS alerts snapshot before it can replace displayed alerts. */
export function createNwsAlertsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(API_URL, {
        signal,
        headers: { Accept: 'application/geo+json' },
      });
      if (!response.ok) throw new Error(`NWS alerts HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      const rows = normalizeAlertSnapshot(payload);
      if (!rows) throw new Error('Malformed NWS alerts response');
      return rows;
    },
  };
}
