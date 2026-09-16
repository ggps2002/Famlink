import { RouteModule } from "../../core/http/RouteModule.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { FavouriteController } from "./favourite.controller.js";
import { FavouriteService } from "./favourite.service.js";
import { userRepository } from "../user/user.repository.js";
import { jobRepository } from "../job/job.repository.js";

export class FavouriteModule extends RouteModule {
  static basePath = "/favourite";
  static moduleName = "favourite";

  registerRoutes(router) {
    const controller = new FavouriteController({
      favouriteService: new FavouriteService({ userRepository, jobRepository }),
    });

    router.use(authenticate);

    router.post("/add", controller.toggle);
    router.get("/getData", controller.list);
  }
}

export default FavouriteModule;
