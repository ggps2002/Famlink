import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { UserDirectoryService } from "./userDirectory.service.js";
import { UserAdminService } from "./userAdmin.service.js";
import { userRepository } from "./user.repository.js";
import { profileRepository } from "../profile/profile.repository.js";
import { parsePaging } from "./user.presenter.js";

/**
 * Several responses here repeat the HTTP status inside the body as `status`,
 * and several put the payload under `message` rather than `data`. Both are
 * preserved: the browse screens read `res.data.message` as the user array, and
 * changing that is a frontend change, not a backend one.
 */
class UserDataController extends BaseController {
  constructor({ directory, admin }) {
    super();
    this.directory = directory;
    this.admin = admin;
  }

  /* ────────────────────────────── member-facing ─────────────────────────── */

  async browseNearby(req, res) {
    const { users, pagination } = await this.directory.browseNearby({
      userId: req.userId,
      userType: req.query.userType,
      ...parsePaging(req.query),
    });

    return this.ok(res, { status: 200, message: users, pagination });
  }

  async browseFiltered(req, res) {
    const { users, pagination } = await this.directory.browseFiltered({
      userId: req.userId,
      query: req.query,
      ...parsePaging(req.query),
    });

    return this.ok(res, { status: 200, message: users, pagination });
  }

  async identity(req, res) {
    return this.ok(res, {
      status: 200,
      data: await this.directory.getIdentity(req.params.id),
    });
  }

  async profile(req, res) {
    return this.ok(res, {
      status: 200,
      message: await this.directory.getProfile(req.params.id),
    });
  }

  async countPerType(req, res) {
    return this.ok(res, await this.directory.countPerType());
  }

  async serviceProviders(req, res) {
    return this.ok(res, {
      success: true,
      data: await this.directory.listServiceProviders(req.params.zipCode),
    });
  }

  async destroy(req, res) {
    await this.directory.deleteAccount({
      requesterId: req.userId,
      targetId: req.params.userId,
    });

    return this.message(res, "User deleted successfully.");
  }

  /* ─────────────────────────────── admin console ────────────────────────── */

  async topUsers(req, res) {
    return this.ok(res, await this.admin.topRated(req.userId));
  }

  async families(req, res) {
    return this.ok(
      res,
      await this.admin.listFamilies({ adminId: req.userId, ...parsePaging(req.query) })
    );
  }

  async nannies(req, res) {
    return this.ok(
      res,
      await this.admin.listNannies({ adminId: req.userId, ...parsePaging(req.query) })
    );
  }

  async adminList(req, res) {
    const { data, pagination } = await this.admin.listAll({
      adminId: req.userId,
      userType: req.query.userType || null,
      ...parsePaging(req.query),
    });

    return this.ok(res, { status: 200, data, pagination });
  }

  async adminDetail(req, res) {
    return this.ok(res, {
      status: 200,
      data: await this.admin.getById({ adminId: req.userId, userId: req.params.id }),
      // Says "edit" on a read. Preserved — the console's edit screen shows this
      // string on load, and it is the text a reviewer will recognise.
      message: "user edit sucessfully",
    });
  }
}

export class UserDataModule extends RouteModule {
  static basePath = "/userData";
  static moduleName = "userData";

  registerRoutes(router) {
    const controller = new UserDataController({
      directory: new UserDirectoryService({ userRepository, profileRepository }),
      admin: new UserAdminService({ userRepository }),
    });

    // Public. The only unauthenticated route in this module, and the reason
    // its response is masked — see serviceProvider.presenter.js.
    router.get("/service-providers/:zipCode", controller.serviceProviders);
    router.get("/count/perType", controller.countPerType);

    router.use(authenticate);

    // Order matters: "/getById/admin/:id" must be registered before
    // "/getById/:id", or Express matches the literal "admin" as an `:id` and
    // the admin route becomes unreachable.
    router.get("/getAllData/admin", controller.adminList);
    router.get("/getById/admin/:id", controller.adminDetail);

    router.get("/getAllData", controller.browseNearby);
    router.get("/getFiltered", controller.browseFiltered);
    router.get("/getUserById/:id", controller.identity);
    router.get("/getById/:id", controller.profile);
    router.get("/top-users", controller.topUsers);
    router.get("/families", controller.families);
    router.get("/nannies", controller.nannies);

    router.delete("/users/:userId", controller.destroy);
  }
}

export default UserDataModule;
