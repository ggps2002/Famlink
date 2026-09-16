// Service-area gate for the three nanny-share onboarding funnels.
//
// The parent form (NannyShareMatchForm) and both caregiver questionnaires
// (JobQuestionnaire / ShareQuestionnaire) all decide the same thing: is this
// person inside the East Bay service area, or do they go on the waitlist? They
// each used to carry their own copy of the zip list and the extractor, which is
// how they drifted apart. One copy lives here now — import it, don't fork it.

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

/* Pull a zip out of whatever the location field is holding — the object a Google
   place result produced, or the raw text someone typed. No network. */
export const extractZipFromLocation = (location) => {
  if (!location) return null;

  if (typeof location === "object") {
    const explicit =
      location.zip ||
      location.zipcode ||
      location.postal_code ||
      location.postcode ||
      null;
    if (explicit) return String(explicit);

    if (location.format_location) {
      const match = location.format_location.match(/\b(\d{5})\b/);
      if (match) return match[1];
    }

    return null;
  }

  if (typeof location === "string") {
    const match = location.match(/\b(\d{5})\b/);
    return match ? match[1] : null;
  }

  return null;
};

/* Google leaves postal_code out of city- and neighborhood-level results ("Oakland,
   CA, USA"), and out of some street addresses, so a user inside the service area can
   reach us carrying no zip at all. Ask Google for one: by coordinates when the place
   result gave us any, otherwise by the address text itself. Returns null rather than
   throwing — a failed lookup should fall through to the waitlist, not break submit. */
export const lookupZip = async ({ lat, lng, address } = {}) => {
  const key = import.meta.env.VITE_GOOGLE_KEY;
  const byCoords = lat && lng;
  const query = byCoords
    ? `latlng=${lat},${lng}`
    : address
      ? `address=${encodeURIComponent(address)}`
      : null;
  if (!key || !query) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${query}&key=${key}`
    );
    const data = await res.json();
    const results = data.results || [];

    // The first result is the most specific, but only some results carry a
    // postal_code — take the first one that does.
    for (const result of results) {
      const zip = result.address_components?.find((c) =>
        c.types.includes("postal_code")
      )?.long_name;
      if (zip) return zip;
    }

    // Geocoding a bare city ("Oakland, CA") resolves to the locality, which has no
    // postal_code of its own. Its centre point does, so go round again by coords.
    if (!byCoords) {
      const point = results[0]?.geometry?.location;
      if (point) return lookupZip({ lat: point.lat, lng: point.lng });
    }
  } catch (err) {
    console.error("Zip lookup failed:", err);
  }
  return null;
};

/* The zip a submission is judged on: whatever the place result already carried,
   else whatever Google can resolve from its coordinates or address text. */
export const resolveZip = async (location) => {
  const direct = extractZipFromLocation(location);
  if (direct) return direct;

  if (location && typeof location === "object") {
    const [lng, lat] = location.coordinates || [];
    return lookupZip({ lat, lng, address: location.format_location });
  }

  if (typeof location === "string") return lookupZip({ address: location });

  return null;
};

/* True when the location resolves to a zip we actually serve. */
export const isInServiceArea = async (location) => {
  const zip = await resolveZip(location);
  return Boolean(zip && ALLOWED_ZIPCODES.has(zip));
};

/* The zip for a Google place result, looking it up from the coordinates when
   Google omits postal_code (city / neighborhood suggestions always do). */
export const zipFromPlace = async (place) => {
  const components = place?.address_components || [];
  const fromComponents = components.find((c) =>
    c.types.includes("postal_code")
  )?.long_name;
  if (fromComponents) return fromComponents;

  return (
    (await lookupZip({
      lat: place?.geometry?.location?.lat(),
      lng: place?.geometry?.location?.lng(),
      address: place?.formatted_address,
    })) || ""
  );
};
