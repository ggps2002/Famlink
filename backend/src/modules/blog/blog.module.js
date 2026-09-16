import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { upload } from "../../core/http/middleware/upload.js";
import uploadImage from "../../shared/storage/uploadImage.js";
import { ForbiddenError } from "../../core/errors/index.js";
import { BlogService } from "./blog.service.js";
import { blogRepository } from "./blog.repository.js";
import { uniqueSlug } from "./blogSlug.js";
import { notifyUsersAboutNewBlog } from "./blogAnnouncement.js";
import { userRepository } from "../user/user.repository.js";

/**
 * The admin gate for this module.
 *
 * Every write route repeated the same four lines, and one of them is
 * responsible for emailing every member on the platform — not a check worth
 * leaving to copy-paste.
 */
const adminOnly =
  (message = "Access denied.") =>
  async (req, _res, next) => {
    const user = await userRepository.findById(req.userId, { select: "type", lean: true });
    if (!user || user.type !== "Admin") return next(new ForbiddenError(message));
    return next();
  };

class BlogController extends BaseController {
  constructor({ blogService }) {
    super();
    this.blogService = blogService;
  }

  /* ─────────────────────────────── public ────────────────────────────────── */

  async list(req, res) {
    const { data, pagination } = await this.blogService.listPublished({
      category: req.query.category,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 10,
    });

    return this.ok(res, { status: 200, data, pagination });
  }

  async listByCategory(req, res) {
    return this.ok(res, {
      success: true,
      data: await this.blogService.listByCategory(req.params.category),
    });
  }

  async read(req, res) {
    return this.ok(res, {
      status: 200,
      message: "Blog fetched successfully",
      data: await this.blogService.readPublished(req.params.id),
    });
  }

  /* ──────────────────────────────── admin ────────────────────────────────── */

  async listAll(req, res) {
    return this.ok(res, {
      message: "Blogs fetched successfully",
      blogs: await this.blogService.listAll(),
    });
  }

  async create(req, res) {
    const blog = await this.blogService.create(req.body || {});
    return res.status(201).json({ message: "Blog post created successfully", blog });
  }

  async update(req, res) {
    const blog = await this.blogService.update(req.body || {});
    return this.ok(res, { blog, message: `"${blog.title}" saved` });
  }

  async togglePublished(req, res) {
    const { blog, goingLive } = await this.blogService.togglePublished(req.params.id);

    return this.ok(res, {
      blog,
      message: goingLive
        ? `"${blog.title}" is now live 🎉`
        : `"${blog.title}" has been unpublished`,
    });
  }

  async remove(req, res) {
    const blog = await this.blogService.remove(req.params.id);

    return this.ok(res, {
      blog,
      message: `The blog titled "${blog.title}" is deleted successfully`,
    });
  }

  async uploadCover(req, res) {
    return this.ok(res, {
      url: await this.blogService.uploadCover(req.file),
      message: "Cover image uploaded.",
    });
  }

  /**
   * PUT /blogs/:id — retired, and answering as it already does.
   *
   * This handler was written against an older schema: it reads and writes
   * `images`, `name` and `description`, none of which exist on the blog model
   * any more. Against the current schema its first check — "at least one image"
   * — is unsatisfiable, so every call already returns this 400 (or, with a file
   * attached, a TypeError and a 500). No caller remains: the frontend uses only
   * `GET /blogs` and `GET /blogs/:idOrSlug`, and editing goes through
   * `PATCH /blogs/edit`.
   *
   * The route stays registered so the URL table does not change, and returns
   * the same 400 it returns today rather than carrying 90 lines of dead code
   * that reference fields no document has.
   */
  async retiredUpdate(_req, res) {
    return this.message(res, "At least one image is required.", 400);
  }
}

export class BlogModule extends RouteModule {
  static basePath = "/blogs";
  static moduleName = "blogs";

  registerRoutes(router) {
    const controller = new BlogController({
      blogService: new BlogService({
        blogRepository,
        // All three reach outside the service: uniqueSlug queries the
        // collection for collisions, and the other two talk to Cloudinary and
        // the mail host. Injected so a test needs none of them.
        uniqueSlug,
        imageUploader: uploadImage,
        notifyAboutNewBlog: notifyUsersAboutNewBlog,
      }),
    });

    // Public — the resources page and the article pages, read by logged-out
    // visitors and by search engines.
    router.get("/", controller.list);
    router.get("/category/:category", controller.listByCategory);

    // Admin. Registered before "/:id" so the literal paths are not swallowed
    // by the parameter.
    router.patch("/publish/:id", authenticate, adminOnly(), controller.togglePublished);
    router.patch("/edit", authenticate, adminOnly(), controller.update);
    router.post("/create", authenticate, adminOnly(), controller.create);
    router.get("/get-blogs", authenticate, adminOnly(), controller.listAll);
    router.post(
      "/cover",
      authenticate,
      adminOnly(),
      upload.single("image"),
      controller.uploadCover
    );

    // These two carry their own wording, which predates the shared gate above.
    router.delete(
      "/:id",
      authenticate,
      adminOnly("Access denied. Only Admins can delete blogs."),
      controller.remove
    );
    router.put(
      "/:id",
      authenticate,
      adminOnly("Access denied. Only Admins can edit blogs."),
      controller.retiredUpdate
    );

    // Last: this one matches anything, so every literal path above must be
    // registered ahead of it.
    router.get("/:id", controller.read);
  }
}

export default BlogModule;
