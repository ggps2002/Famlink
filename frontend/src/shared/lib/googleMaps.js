// Shared loader for the Google Maps JavaScript SDK.
//
// The SDK must only ever be injected ONCE per page. Several screens already
// pull it in indirectly through react-google-autocomplete (Places), so this
// loader looks for an existing <script> before adding its own — a second
// include makes Google log "You have included the Google Maps JavaScript API
// multiple times" and can reset map state.

const SDK_SRC_MATCH = "maps.googleapis.com/maps/api/js";

let pending = null;

// The script's own load event is unreliable here: if another component injected
// the SDK before us, that event has already fired and our listener would never
// run. Polling for the global works in every ordering.
const waitForGlobal = (timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      if (window.google?.maps) return resolve(window.google.maps);
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error("Timed out waiting for the Google Maps SDK"));
      }
      setTimeout(tick, 100);
    };
    tick();
  });

export function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps needs a browser"));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (pending) return pending;

  pending = (async () => {
    const alreadyInjected = Array.from(document.querySelectorAll("script")).some(
      (s) => s.src && s.src.includes(SDK_SRC_MATCH)
    );

    if (!alreadyInjected) {
      if (!apiKey) throw new Error("VITE_GOOGLE_KEY is not set");
      const script = document.createElement("script");
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return waitForGlobal();
  })();

  // Let a later mount retry after a network failure instead of caching the
  // rejection forever.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
