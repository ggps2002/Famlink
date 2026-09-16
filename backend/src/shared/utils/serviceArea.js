// The launch radius, server side.
//
// The frontend has had this list since the three onboarding funnels were
// unified (frontend/src/Config/serviceArea.js). It has to exist here too
// because the waitlist screen answers "who is outside the radius", and a gate
// that only exists in the browser can't answer anything about stored data — nor
// be trusted, since the client decides what it sends.
//
// THESE TWO LISTS MUST AGREE. When a city opens, edit both. They are kept as
// separate files rather than one shared module because the frontend build does
// not reach into backend/, and a copied constant with a comment is a smaller
// problem than a build-time dependency between the two halves of the repo.
export const ALLOWED_ZIPCODES = new Set([
  // Oakland
  "94601", "94602", "94603", "94605", "94606", "94607", "94608", "94609",
  "94610", "94611", "94612", "94618", "94619", "94621",
  // Berkeley
  "94702", "94703", "94704", "94705", "94706", "94707", "94708", "94709", "94710",
  // Alameda
  "94501", "94502",
  // San Leandro
  "94577", "94578", "94579",
  // Castro Valley / San Lorenzo
  "94546", "94552",
  // Richmond / El Cerrito
  "94803", "94804", "94805",
]);

// Cities we have launched in, lowercased. The fallback when a record carries no
// zip at all — which is most of the older ones, because Google omits
// postal_code from city-level place results.
export const LAUNCH_CITIES = new Set([
  "oakland",
  "berkeley",
  "alameda",
  "san leandro",
  "castro valley",
  "san lorenzo",
  "richmond",
  "el cerrito",
  "emeryville",
  "piedmont",
]);

// Pull a five-digit zip out of whatever shape the location is in. Mirrors
// extractZipFromLocation on the frontend, minus the Google lookup — this runs
// over stored records in bulk and must not make a network call per row.
export const zipFromLocation = (location) => {
  if (!location) return null;

  if (typeof location === "string") {
    const match = location.match(/\b(\d{5})\b/);
    return match ? match[1] : null;
  }

  if (typeof location !== "object") return null;

  const explicit =
    location.zip ||
    location.zipCode ||
    location.zipcode ||
    location.postal_code ||
    location.postcode;
  if (explicit) {
    const match = String(explicit).match(/\b(\d{5})\b/);
    if (match) return match[1];
  }

  const formatted = location.formatted || location.format_location;
  if (typeof formatted === "string") {
    const match = formatted.match(/\b(\d{5})\b/);
    if (match) return match[1];
  }

  return null;
};

// The city, lowercased and trimmed, from either shape.
export const cityFromLocation = (location) => {
  if (!location || typeof location !== "object") return null;
  if (location.city) return String(location.city).trim().toLowerCase();

  // "1 Broadway, Oakland, CA 94607, USA" → the second-from-last-but-one part is
  // the city. Same slice every screen in the app uses.
  const formatted = location.formatted || location.format_location;
  if (typeof formatted === "string") {
    const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) return parts[parts.length - 3].toLowerCase();
  }

  return null;
};

// Is this location somewhere we have launched?
//
// Zip is authoritative when we have one. City is the fallback, and it is a
// generous one on purpose: for the waitlist, wrongly marking someone as inside
// the radius shows them to an admin who can check, while wrongly marking them
// outside hides them from the launch email they signed up for.
export const isInsideLaunchRadius = (location) => {
  const zip = zipFromLocation(location);
  if (zip) return ALLOWED_ZIPCODES.has(zip);

  const city = cityFromLocation(location);
  if (city) return LAUNCH_CITIES.has(city);

  return false;
};
