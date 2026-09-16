import { BaseController } from "../../core/http/BaseController.js";

export class LocationController extends BaseController {
  constructor({ mapPinsService, geocodingService }) {
    super();
    this.mapPinsService = mapPinsService;
    this.geocodingService = geocodingService;
  }

  async mapPins(req, res) {
    return this.ok(res, await this.mapPinsService.getAreas(req.query));
  }

  async geocode(req, res) {
    const results = await this.geocodingService.geocode(req.query.address);
    return this.ok(res, { results });
  }
}

export default LocationController;
