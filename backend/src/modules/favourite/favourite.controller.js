import { BaseController } from "../../core/http/BaseController.js";

export class FavouriteController extends BaseController {
  constructor({ favouriteService }) {
    super();
    this.favouriteService = favouriteService;
  }

  async toggle(req, res) {
    const { removed } = await this.favouriteService.toggle({
      userId: req.userId,
      favouriteUserId: req.body.favouriteUserId,
    });

    return res.status(200).json({
      status: 200,
      message: removed ? "Favourite removed" : "Favourite added",
    });
  }

  async list(req, res) {
    const { data, pagination } = await this.favouriteService.list({
      userId: req.userId,
      // Defaults preserved from the original, including limit=1.
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 1,
    });

    return res.status(200).send({ status: 200, data, pagination });
  }
}

export default FavouriteController;
