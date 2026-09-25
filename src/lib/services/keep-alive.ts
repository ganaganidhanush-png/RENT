// Server-side Keep-Alive Daemon for Render Anti-Sleep
// Render free tier sleeps after 15 minutes of inactivity.
// This daemon sends a heartbeat request every 12 minutes to keep the container awake.

declare global {
  var __rentvault_keepalive_active: boolean | undefined;
  var __rentvault_keepalive_interval: NodeJS.Timeout | undefined;
}

const DEFAULT_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes (under Render's 15 min idle timeout)

export function startKeepAliveDaemon() {
  if (typeof window !== 'undefined') return; // Only run on Node.js server
  if (globalThis.__rentvault_keepalive_active) {
    return; // Already initialized
  }

  globalThis.__rentvault_keepalive_active = true;

  const getTargetUrl = () => {
    if (process.env.RENDER_EXTERNAL_URL) {
      return `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`;
    }
    if (process.env.APP_URL) {
      return `${process.env.APP_URL.replace(/\/$/, '')}/api/health`;
    }
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}/api/health`;
  };

  const pingEndpoint = async () => {
    const targetUrl = getTargetUrl();
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'RentVault-KeepAlive-Worker/1.0',
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        console.log(`[RentVault Keep-Alive] Heartbeat ping successful -> ${targetUrl} (${new Date().toLocaleTimeString()})`);
      } else {
        console.warn(`[RentVault Keep-Alive] Ping returned status ${response.status} from ${targetUrl}`);
      }
    } catch (err) {
      // In dev or local boot, server might take a few seconds to accept connections
      console.warn(`[RentVault Keep-Alive] Ping note:`, err instanceof Error ? err.message : String(err));
    }
  };

  // Initial ping after 30 seconds to allow the server to finish binding
  setTimeout(() => {
    pingEndpoint();
  }, 30 * 1000);

  // Recurring ping every 12 minutes
  if (globalThis.__rentvault_keepalive_interval) {
    clearInterval(globalThis.__rentvault_keepalive_interval);
  }

  globalThis.__rentvault_keepalive_interval = setInterval(() => {
    pingEndpoint();
  }, DEFAULT_INTERVAL_MS);

  console.log(`[RentVault Keep-Alive] Server Anti-Sleep Daemon initialized (Interval: 12 min, Target: ${getTargetUrl()})`);
}
