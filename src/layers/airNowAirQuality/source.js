import { readResponseJsonCapped } from '../../sources/httpBody.js';
import { validateAirQualitySnapshot } from './records.js';

export const AIR_QUALITY_RESPONSE_LIMIT = 4 * 1024 * 1024;

/** Lazy same-origin acquisition; source owns only its deadline and cancellation. */
export function createAirQualitySource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  timeoutMs = 20_000,
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(
        () => controller.abort(new Error('Air quality request timed out')),
        timeoutMs,
      );
      try {
        signal?.throwIfAborted();
        const response = await fetchImpl('/api/air-quality', {
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`Air quality HTTP ${response.status}`);
        }
        const result = await readResponseJsonCapped(
          response,
          AIR_QUALITY_RESPONSE_LIMIT,
          controller.signal,
        );
        controller.signal.throwIfAborted();
        return validateAirQualitySnapshot(result);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}
