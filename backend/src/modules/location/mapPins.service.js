import { BaseService } from "../../core/http/BaseService.js";
import { ValidationError } from "../../core/errors/index.js";
import {
  buildGroups,
  summariseAreas,
  COARSEST_LAT_DEG,
  MIN_GROUP,
} from "./privacyGrid.js";

const MAX_USERS = 2000; // candidates scanned per request (cells, not people, are returned)
const DEFAULT_RADIUS_M = 8000;
const MAX_RADIUS_M = 50000;
const M_PER_DEG_LAT = 111320;

/**
 * The public coverage map: approximate, PII-free areas for logged-out visitors.
 *
 * Real coordinates exist only inside `#fetchMembers`, and only long enough to
 * be bucketed by the grid. Nothing this service returns contains a coordinate
 * belonging to any person.
 */
export class MapPinsService extends BaseService {
  /**
   * Number("") and Number(null) are both 0, so a blank or missing lat/lng would
   * sail through validation and quietly return an empty map for the Gulf of
   * Guinea — which the page then renders as "be the first one here". Anything
   * that isn't a non-blank scalar has to become NaN and be rejected.
   */
  static #toCoord(raw) {
    if (typeof raw !== "string" && typeof raw !== "number") return NaN;
    const str = String(raw).trim();
    return str === "" ? NaN : Number(str);
  }

  static #parseQuery({ lat: rawLat, lng: rawLng, radius: rawRadius }) {
    const lat = MapPinsService.#toCoord(rawLat);
    const lng = MapPinsService.#toCoord(rawLng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new ValidationError("Valid lat and lng are required.");
    }

    const radius = Math.min(
      Math.max(Number(rawRadius) || DEFAULT_RADIUS_M, 500),
      MAX_RADIUS_M
    );

    return { lat, lng, radius };
  }

  /**
   * Candidate members around a point.
   *
   * Fetches well past the requested radius: a cell qualifies if it OVERLAPS the
   * requested circle, so a member can sit up to a full coarse-cell diagonal
   * beyond it and still belong to a cell we publish — and a published cell's
   * count has to be complete or the number on the map is wrong.
   */
  async #fetchMembers({ lat, lng, radius }) {
    const coarsestSideM = COARSEST_LAT_DEG * M_PER_DEG_LAT;
    const fetchRadius = radius + coarsestSideM * Math.SQRT2;

    // $near already restricts to documents with a valid geometry, so no
    // separate "coordinates exist" filter is needed (and overlapping predicates
    // on a $near path are best avoided).
    const users = await this.userRepository.find(
      {
        type: { $in: ["Parents", "Nanny"] },
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: fetchRadius,
          },
        },
      },
      { select: "_id type +location.coordinates", limit: MAX_USERS, lean: true }
    );

    const members = [];
    for (const user of users) {
      const coords = user.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const [realLng, realLat] = coords;
      if (!Number.isFinite(realLat) || !Number.isFinite(realLng)) continue;

      members.push({
        lat: realLat,
        lng: realLng,
        type: user.type === "Nanny" ? "nanny" : "parent",
      });
    }

    return members;
  }

  async getAreas(query) {
    const { lat, lng, radius } = MapPinsService.#parseQuery(query);

    const members = await this.#fetchMembers({ lat, lng, radius });
    const { counts, areas } = summariseAreas(buildGroups(members), { lat, lng, radius });

    return {
      center: { lat, lng },
      radiusMeters: radius,
      minGroup: MIN_GROUP,
      counts,
      areas,
    };
  }
}

export default MapPinsService;
