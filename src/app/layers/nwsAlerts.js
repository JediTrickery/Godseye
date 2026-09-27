import { createNwsAlertsLayer } from '../../layers/nwsAlerts/index.js';
import { overlayHost } from './overlayHost.js';
/** Wire NWS severe weather alert observations to the application overlay host. */
export function createApplicationNwsAlerts(options) {
  return createNwsAlertsLayer({ overlayHost, ...options });
}
