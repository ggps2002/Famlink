import { RouteModule } from "../../core/http/RouteModule.js";
import { rateLimit } from "../../core/http/middleware/rateLimit.js";
import { LocationController } from "./location.controller.js";
import { MapPinsService } from "./mapPins.service.js";
import { GeocodingService } from "./geocoding.service.js";
import { userRepository } from "../user/user.repository.js";

/**
 * Both endpoints here are public and both are expensive, so both are capped.
 * Neither can require a token: the map powers the logged-out marketing page,
 * and the geocoder serves the join form, where the visitor has no account yet.
 */
export class LocationModule extends RouteModule {
  static basePath = "/location";
  static moduleName = "location";

  registerRoutes(router) {
    const controller = new LocationController({
      mapPinsService: new MapPinsService({ userRepository }),
      geocodingService: new GeocodingService(),
    });

    // Each call runs a geo query over up to 2,000 user documents. The limit is
    // generous because a visitor panning the map fires several in a row.
    router.get(
      "/map-pins",
      rateLimit({
        name: "map-pins",
        limit: 120,
        windowSec: 60,
        message: "Too many map requests. Please slow down and try again shortly.",
      }),
      controller.mapPins
    );

    // Spends our Google key with no token behind it, so the ceiling is tight.
    router.get(
      "/",
      rateLimit({
        name: "geocode",
        limit: 15,
        windowSec: 60,
        message: "Too many address lookups. Please wait a minute and try again.",
      }),
      controller.geocode
    );
  }
}

export default LocationModule;
