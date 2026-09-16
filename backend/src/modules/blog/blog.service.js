import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { sanitizeHtml } from "../../shared/utils/sanitizeHtml.js";

const ACCEPTED_IMAGE = /^image\/(jpe?g|png|webp|gif|avif)$/i;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * Resource articles: writing them, publishing them, reading them.
 *
 * Two rules run through everything here.
 *
 * A draft is not public. It is excluded from the list, 404s (not 403s) by URL
 * so its existence cannot be discovered, and announces nothing.
 *
 * Publishing is a separate act from saving. Starting a draft used to email
 * every member on the platform about an article nobody could read yet — and
 * saving that draft again mailed them a second time. The announcement now fires
 * once, on the first transition to live.
 */
export class BlogService extends BaseService {
  /* ──────────────────────────────── public ────────────────────────────────── */

  async listPublished({ category, page = 1, limit = 10 }) {
    const { blogs, totalRecords } = await this.blogRepository.findPublishedPage({
      category,
      skip: (page - 1) * limit,
      limit,
    });

    return {
      data: blogs,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    };
  }

  listByCategory(category) {
    return this.blogRepository.findByCategory(category);
  }

  /** One article plus its siblings, by slug or by id. */
  async readPublished(idOrSlug) {
    const blog = await this.blogRepository.findByIdOrSlug(idOrSlug);

    // Same 404 for a draft as for a missing article, so this cannot be used to
    // discover that an unpublished piece exists.
    if (!blog || blog.isDraft) throw new NotFoundError("Blog not found");

    const relatedBlogs = await this.blogRepository.findRelated({
      category: blog.category,
      excludeId: blog._id,
    });

    return { blog, relatedBlogs };
  }

  /* ───────────────────────────────── admin ───────────────────────────────── */

  listAll() {
    return this.blogRepository.findAllForAdmin();
  }

  async create({ title, excerpt, content, category, featuredImage, isDraft }) {
    if (!title || !excerpt || !content || !category) {
      throw new ValidationError("All required fields must be filled.");
    }

    // Drafts unless explicitly published, so writing an article is never the
    // same action as announcing it.
    const publishNow = isDraft === false;

    const blog = await this.blogRepository.create({
      title,
      excerpt,
      // Cleaned once on the way in, because the public article page renders
      // this with dangerouslySetInnerHTML. One writer behind the admin gate,
      // every reader covered.
      content: sanitizeHtml(content),
      category,
      isDraft: !publishNow,
      featuredImage,
      slug: await this.uniqueSlug(title),
      publishedAt: publishNow ? new Date() : null,
    });

    if (publishNow) this.#announce(blog);

    return blog;
  }

  async update({ _id, title, excerpt, content, category, featuredImage, isDraft }) {
    const blog = await this.blogRepository.findById(_id);
    if (!blog) throw new NotFoundError("Blog not found");

    if (title !== undefined) blog.title = title;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (content !== undefined) blog.content = sanitizeHtml(content);
    if (category !== undefined) blog.category = category;
    if (featuredImage !== undefined) blog.featuredImage = featuredImage;
    if (isDraft !== undefined) blog.isDraft = isDraft;

    // Minted if it never had one, and deliberately NOT regenerated from a
    // changed title: the address is already in the weekly resources email and
    // in Google's index, and moving it breaks both.
    if (!blog.slug) blog.slug = await this.uniqueSlug(blog.title, blog._id);

    await blog.save();
    return blog;
  }

  /**
   * Flip between draft and live.
   *
   * `publishedAt` is stamped once and kept. Unpublishing and republishing must
   * not re-date the article, or its position in the resources list silently
   * jumps back to the top.
   */
  async togglePublished(blogId) {
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) throw new NotFoundError("Blog not found");

    const goingLive = blog.isDraft === true;
    const firstPublish = goingLive && !blog.publishedAt;

    blog.isDraft = !blog.isDraft;
    if (goingLive && !blog.publishedAt) blog.publishedAt = new Date();
    // A slug is needed the moment the article becomes reachable by URL.
    if (goingLive && !blog.slug) blog.slug = await this.uniqueSlug(blog.title, blog._id);

    await blog.save();

    if (firstPublish) this.#announce(blog);

    return { blog, goingLive };
  }

  async remove(blogId) {
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) throw new NotFoundError("Blog not found");

    await this.blogRepository.deleteById(blogId);
    return blog;
  }

  /**
   * Upload a cover image and hand back its URL.
   *
   * Deliberately decoupled from saving the article: an author picks a cover
   * before the piece has an id, so making the upload part of the save would
   * mean either holding the file in browser memory until then or refusing to
   * let them choose one until after the first save.
   */
  async uploadCover(file) {
    if (!file) throw new ValidationError("No image was uploaded.");

    // Checked here rather than in a multer fileFilter so the caller gets a JSON
    // message it can display, instead of multer's error surfacing as a 500.
    if (!ACCEPTED_IMAGE.test(file.mimetype || "")) {
      throw new ValidationError("That file isn't an image. Use a JPG, PNG, WebP, GIF or AVIF.");
    }
    if (file.size > MAX_COVER_BYTES) {
      throw new ValidationError("That image is over 8MB. Please compress it and try again.");
    }

    // A fresh public id per upload rather than one keyed to the article.
    // Overwriting a fixed id leaves the old picture cached in the CDN and in
    // readers' browsers under a URL that now means something else — the classic
    // "I changed the image and it didn't change" report.
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return this.imageUploader(file.buffer, stamp, "blog_cover_");
  }

  /**
   * Tell members about a newly published article.
   *
   * Fire-and-forget. The article is live either way, and an admin retrying
   * after a mail failure would only double-send.
   */
  #announce(blog) {
    this.notifyAboutNewBlog(blog.title, blog.category).catch((error) =>
      console.error("New blog notification failed:", error?.message || error)
    );
  }
}

export default BlogService;
