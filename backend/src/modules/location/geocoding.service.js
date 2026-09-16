import axios from "axios";
import config from "../../config/index.js";
import { UpstreamServiceError, ValidationError } from "../../core/errors/index.js";

const MAX_ADDRESS_LENGTH = 300;

/**
 * A proxy in front of Google's geocoder for the signup form.
 *
 * It spends OUR API key and it cannot require a token — the one caller is the
 * join flow, where the visitor has no account yet. It was previously wide open
 * with no limit, no input validation, and it returned Google's entire raw
 * response, so anyone who found the URL could bill the key indefinitely and use
 * it as a free anonymous geocoding service.
 *
 * Two of the three defences live here; the per-IP rate limit is middleware and
 * lives in the module.
 */
export class GeocodingService {
  constructor({ apiKey = config.google.geocodeKey, http = axios } = {}) {
    this.apiKey = apiKey;
    this.http = http;
  }

  /**
   * Reject anything that is not a single reasonable string.
   *
   * Express yields an array when a parameter is repeated (?address=a&address=b)
   * and an object for bracket syntax, so this has to be a plain string before
   * it goes anywhere near a URL.
   */
  static #assertUsableAddress(address) {
    if (typeof address !== "string" || !address.trim()) {
      throw new ValidationError("Address is required");
    }

    const query = address.trim();
    if (query.length > MAX_ADDRESS_LENGTH) {
      throw new ValidationError("Address is too long");
    }

    return query;
  }

  async geocode(address) {
    const query = GeocodingService.#assertUsableAddress(address);

    if (!this.apiKey) {
      console.error("[geocode] requested but Location_Key is not configured");
      throw new UpstreamServiceError("Address lookup is unavailable");
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      query
    )}&key=${this.apiKey}`;

    try {
      const response = await this.http.get(url, { timeout: 10000 });

      // Only what the client actually uses. Passing Google's full result
      // through — place ids, address components, viewports — is what made this
      // worth abusing; a caller who wants those has to go get their own key.
      return (response.data?.results || []).slice(0, 5).map((result) => ({
        formatted_address: result.formatted_address,
        geometry: { location: result.geometry?.location },
      }));
    } catch (error) {
      // Never forward Google's error body: it can echo the request URL, and the
      // request URL contains our API key.
      console.error("[geocode] request failed:", error?.message || error);
      throw new UpstreamServiceError("Could not look up that address");
    }
  }
}

export default GeocodingService;
