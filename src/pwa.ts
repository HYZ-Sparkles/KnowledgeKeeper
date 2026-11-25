/** Registers the app-shell worker at the deployment base, never at the host root. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // The document URL carries the GitHub Pages sub-path in both dev and production.
  const shellUrl = new URL('./', document.baseURI);
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(
      new URL('sw.js', shellUrl),
      { scope: shellUrl.href },
    ).catch(() => {
      // Registration can be blocked (e.g. insecure origin); the app still runs online.
    });
  });
}
