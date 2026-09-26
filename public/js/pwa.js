// Registers the offline worker. Nothing else depends on it, so a failure
// (private mode, unsupported browser, http) just leaves the app online-only.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
