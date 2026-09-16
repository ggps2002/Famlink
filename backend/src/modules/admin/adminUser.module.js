import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { ForbiddenError, NotFoundError } from "../../core/errors/index.js";
import { sendAccountDeactivatedEmail } from "../../shared/email/email.js";
import { AdminUserService } from "./adminUser.service.js";
import { AdminDashboardService } from "./adminDashboard.service.js";
import { CredentialsService } from "../auth/credentials.service.js";
import { stripeGateway } from "../billing/stripe.gateway.js";
import { userRepository } from "../user/user.repository.js";
import { bookingRepository } from "../booking/booking.repository.js";
import { chatRepository } from "../messaging/chat.repository.js";

/**
 * The admin gate for this module.
 *
 * All thirteen routes repeated these six lines inline, with identical wording,
 * and one of them shadowed the fetched admin with the target user of the same
 * variable name. Mounted once with `router.use` so a route added later is
 * protected by default rather than by the author remembering.
 *
 * The messages are the ones these routes already returned. They differ from the
 * shared `adminOnly` in admin.middleware.js, which is why this is separate:
 * consolidating the two would change what the console displays.
 */
const requireAdmin = async (req, _res, next) => {
  const admin = await userRepository.findById(req.userId, { select: "type", lean: true });

  if (!admin) return next(new NotFoundError("User not found"));
  if (admin.type !== "Admin") {
    return next(new ForbiddenError("Access denied. Only Admins can get data."));
  }

  req.admin = admin;
  return next();
};

class AdminUserController extends BaseController {
  constructor({ adminUsers, dashboard }) {
    super();
    this.adminUsers = adminUsers;
    this.dashboard = dashboard;
  }

  /* ─────────────────────────── member management ──────────────────────────── */

  async updateStatus(req, res) {
    await this.adminUsers.setStatus({ userId: req.params.id, status: req.body.status });
    return this.message(res, "Status updated successfully");
  }

  async edit(req, res) {
    const user = await this.adminUsers.edit({ userId: req.params.id, ...(req.body || {}) });
    return this.ok(res, { message: "User updated successfully", data: user });
  }

  async setPassword(req, res) {
    await this.adminUsers.setPassword({
      userId: req.params.userId,
      password: req.body.password,
    });

    return this.ok(res, { status: 200, message: "Password updated successfully" });
  }

  async listCards(req, res) {
    // Stripe's own list envelope, passed through unchanged.
    return this.ok(res, await this.adminUsers.listCards(req.params.userId));
  }

  async deleteCard(req, res) {
    await this.adminUsers.deleteCard({
      userId: req.params.userId,
      paymentMethodId: req.params.paymentMethodId,
    });

    return this.message(res, "Card removed successfully.");
  }

  /* ───────────────────────────────  dashboard  ────────────────────────────── */

  async chats(req, res) {
    return this.ok(
      res,
      await this.dashboard.chatDirectory({
        adminId: req.userId,
        exclude: req.query.exclude || [],
      })
    );
  }

  async completeBookings(req, res) {
    const { data, pagination } = await this.dashboard.completedBookings({
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 10,
    });

    return this.ok(res, { status: 200, data, pagination });
  }

  async stats(req, res) {
    return this.ok(res, await this.dashboard.bookingStats({ filter: req.query.filter }));
  }

  async userStats(req, res) {
    return this.ok(res, await this.dashboard.userStats());
  }

  async earningStats(req, res) {
    return this.ok(res, await this.dashboard.earningStats());
  }

  async recentBookings(req, res) {
    return this.ok(res, await this.dashboard.recentBookings());
  }

  async nannyLocations(req, res) {
    return this.ok(res, await this.dashboard.nannyLocations());
  }

  async topUsers(req, res) {
    return this.ok(
      res,
      await this.dashboard.topUsers({
        type: req.query.type,
        sort: req.query.sort,
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 5,
      })
    );
  }
}

export class AdminUserModule extends RouteModule {
  static basePath = "/adminUser";
  static moduleName = "adminUser";

  registerRoutes(router) {
    const controller = new AdminUserController({
      adminUsers: new AdminUserService({
        userRepository,
        credentials: new CredentialsService(),
        stripe: stripeGateway,
        sendAccountDeactivatedEmail,
      }),
      dashboard: new AdminDashboardService({
        userRepository,
        bookingRepository,
        chatRepository,
      }),
    });

    router.use(authenticate, requireAdmin);

    router.put("/update-status/:id", controller.updateStatus);
    router.put("/edit/:id", controller.edit);
    router.put("/password/:userId", controller.setPassword);

    router.get("/get-save-cards/:userId", controller.listCards);
    router.delete("/delete-card/:paymentMethodId/:userId", controller.deleteCard);

    router.get("/chats", controller.chats);
    router.get("/complete-bookings", controller.completeBookings);
    router.get("/stats", controller.stats);
    router.get("/userStats", controller.userStats);
    router.get("/earningStats", controller.earningStats);
    router.get("/recentBookings", controller.recentBookings);
    router.get("/nanny-locations", controller.nannyLocations);
    router.get("/topUsers", controller.topUsers);
  }
}

export default AdminUserModule;
