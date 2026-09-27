import { createAirQualityLayer } from '../../layers/airQuality/index.js';
import { overlayHost } from './overlayHost.js';
/** Wire AirNow air-quality observations to the application overlay host. */
export function createApplicationAirQuality(options) {
  return createAirQualityLayer({ overlayHost, ...options });
}
