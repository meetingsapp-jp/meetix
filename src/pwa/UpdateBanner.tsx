import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Registers the service worker in autoUpdate mode: a new deploy is fetched in
// the background, takes over (skipWaiting + clientsClaim) and the page reloads
// once so users always land on the latest version without tapping anything.
export default function UpdateBanner() {
  useEffect(() => {
    // Reload exactly once when a *new* worker takes control (not on first install).
    if ('serviceWorker' in navigator) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        // controller was already set => this is an update, safe to reload.
        if (navigator.serviceWorker.controller) {
          reloaded = true;
          window.location.reload();
        }
      });
    }

    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        // Check for a new deploy periodically so long-lived sessions refresh.
        if (registration) {
          setInterval(() => registration.update().catch(() => {}), 60_000);
        }
      },
    });
  }, []);

  return null;
}
