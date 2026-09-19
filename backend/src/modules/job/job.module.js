import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { JobService } from "./job.service.js";
import { jobRepository } from "./job.repository.js";
import { userRepository } from "../user/user.repository.js";
import { bookingRepository } from "../booking/booking.repository.js";

/**
 * Response bodies are reproduced field for field from Routes/postJob.js. The
 * envelopes are inconsistent between endpoints — `{ data }`, `{ jobs }`,
 * `{ totalJobs }`, `{ success, data }` — and that inconsistency is preserved:
 * the job screens and five Redux slices already parse them as they are.
 */
class JobController extends BaseController {
  constructor({ jobService }) {
    super();
    this.jobs = jobService;
  }

  async create(req, res) {
    const job = await this.jobs.create(req.userId, req.body);
    return res
      .status(201)
      .json({ message: `${job.jobType} job posted successfully`, job });
  }

  async remove(req, res) {
    await this.jobs.remove(req.userId, req.params.id);
    return this.message(res, "Job deleted successfully");
  }

  async update(req, res) {
    const data = await this.jobs.update(req.userId, req.params.id, req.body);
    return this.sendData(res, data, { message: "Post updated successfully" });
  }

  async browse(req, res) {
    const { pagination, data } = await this.jobs.browse(req.userId, req.query);
    return res.status(200).json({ status: 200, pagination, data });
  }

  async opportunitiesByZip(req, res) {
    const data = await this.jobs.opportunitiesByZip(req.params.zipCode);
    return res.status(200).json({ success: true, data });
  }

  async listForUser(req, res) {
    const data = await this.jobs.listForUser(req.userId);
    return this.sendData(res, data);
  }

  async count(req, res) {
    const totalJobs = await this.jobs.count(req.userId);
    return res.status(200).json({ totalJobs });
  }

  async listAllPublic(req, res) {
    const jobs = await this.jobs.listAllPublic();
    return res.status(200).json({ jobs });
  }

  async adminList(req, res) {
    const { data, pagination } = await this.jobs.adminList(req.userId, req.query);
    return this.sendData(res, data, { pagination });
  }

  async detail(req, res) {
    const data = await this.jobs.detail(req.params.id);
    return this.sendData(res, data);
  }
}

export class JobModule extends RouteModule {
  static basePath = "/postJob";
  static moduleName = "postJob";

  registerRoutes(router) {
    const controller = new JobController({
      jobService: new JobService({ jobRepository, userRepository, bookingRepository }),
    });

    router.post("/", authenticate, controller.create);
    router.delete("/:id", authenticate, controller.remove);
    router.patch("/:id", authenticate, controller.update);
    router.get("/", authenticate, controller.browse);

    // Public: the zip-code landing pages, fetched before anyone signs in.
    router.get("/job-seeker-opportunities/:zipCode", controller.opportunitiesByZip);

    // Every literal path below MUST stay above GET "/:id". Express matches in
    // registration order, so "/:id" would otherwise claim "/user-jobs",
    // "/count", "/all-jobs" and "/admin-job" and look each one up as an id.
    router.get("/user-jobs", authenticate, controller.listForUser);
    router.get("/count", authenticate, controller.count);
    // Public: the marketing job feed.
    router.get("/all-jobs", controller.listAllPublic);
    router.get("/admin-job", authenticate, controller.adminList);

    router.get("/:id", authenticate, controller.detail);
  }
}

export default JobModule;
