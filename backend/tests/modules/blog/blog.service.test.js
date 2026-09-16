import { describe, it, expect, vi } from "vitest";
import { BlogService } from "#src/modules/blog/blog.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const aBlog = (over = {}) => ({
  _id: "b1",
  title: "Ten tips",
  category: "Care",
  isDraft: true,
  publishedAt: null,
  slug: "ten-tips",
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const blogRepository = {
    findById: vi.fn().mockResolvedValue(aBlog()),
    findByIdOrSlug: vi.fn().mockResolvedValue(null),
    findPublishedPage: vi.fn().mockResolvedValue({ blogs: [], totalRecords: 0 }),
    findByCategory: vi.fn().mockResolvedValue([]),
    findRelated: vi.fn().mockResolvedValue([]),
    findAllForAdmin: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (doc) => ({ ...doc, _id: "new" })),
    deleteById: vi.fn().mockResolvedValue({}),
    ...over.blogRepository,
  };

  const notifyAboutNewBlog = vi.fn().mockResolvedValue(undefined);
  const imageUploader = vi.fn().mockResolvedValue("https://cdn/cover.jpg");
  // The real one queries the collection for slug collisions.
  const uniqueSlug = vi.fn(async (title) => String(title).toLowerCase().replace(/\s+/g, "-"));

  return {
    service: new BlogService({
      blogRepository,
      notifyAboutNewBlog,
      imageUploader,
      uniqueSlug,
    }),
    blogRepository,
    notifyAboutNewBlog,
    imageUploader,
    uniqueSlug,
  };
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("listPublished", () => {
  it("never returns drafts", async () => {
    // This feeds the public resources page. It used to return drafts alongside
    // live articles, so an unfinished piece was readable the moment it saved.
    const { service, blogRepository } = build();

    await service.listPublished({});

    expect(blogRepository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, limit: 10 })
    );
  });

  it("paginates", async () => {
    const { service, blogRepository } = build({
      blogRepository: { findPublishedPage: vi.fn().mockResolvedValue({ blogs: [], totalRecords: 25 }) },
    });

    const { pagination } = await service.listPublished({ page: 3, limit: 10 });

    expect(blogRepository.findPublishedPage.mock.calls[0][0].skip).toBe(20);
    expect(pagination).toEqual({ totalRecords: 25, totalPages: 3, currentPage: 3, limit: 10 });
  });
});

describe("readPublished", () => {
  it("404s an article nobody holds", async () => {
    const { service } = build();

    await expect(service.readPublished("nope")).rejects.toThrow(NotFoundError);
  });

  it("404s a draft rather than 403ing it", async () => {
    // A 403 would confirm that an unpublished article exists at that address.
    const { service } = build({
      blogRepository: { findByIdOrSlug: vi.fn().mockResolvedValue(aBlog({ isDraft: true })) },
    });

    await expect(service.readPublished("ten-tips")).rejects.toThrow("Blog not found");
  });

  it("returns the article with its published siblings", async () => {
    const { service, blogRepository } = build({
      blogRepository: {
        findByIdOrSlug: vi.fn().mockResolvedValue(aBlog({ isDraft: false })),
        findRelated: vi.fn().mockResolvedValue([{ _id: "b2" }]),
      },
    });

    const { blog, relatedBlogs } = await service.readPublished("ten-tips");

    expect(blog._id).toBe("b1");
    expect(relatedBlogs).toHaveLength(1);
    expect(blogRepository.findRelated).toHaveBeenCalledWith({ category: "Care", excludeId: "b1" });
  });
});

describe("create", () => {
  it("requires the four fields an article cannot exist without", async () => {
    const { service } = build();

    await expect(service.create({ title: "x" })).rejects.toThrow(ValidationError);
  });

  it("starts as a draft unless publishing was asked for", async () => {
    // Writing an article is never the same action as announcing it.
    const { service, blogRepository, notifyAboutNewBlog } = build();

    await service.create({ title: "t", excerpt: "e", content: "c", category: "Care" });

    expect(blogRepository.create.mock.calls[0][0]).toMatchObject({
      isDraft: true,
      publishedAt: null,
    });
    expect(notifyAboutNewBlog).not.toHaveBeenCalled();
  });

  it("announces an article created already-live", async () => {
    const { service, notifyAboutNewBlog } = build();

    await service.create({
      title: "t",
      excerpt: "e",
      content: "c",
      category: "Care",
      isDraft: false,
    });
    await settle();

    expect(notifyAboutNewBlog).toHaveBeenCalledWith("t", "Care");
  });

  it("sanitises the body on the way in", async () => {
    // The public article page renders this with dangerouslySetInnerHTML, so it
    // is cleaned once at the single write point rather than at every read.
    const { service, blogRepository } = build();

    await service.create({
      title: "t",
      excerpt: "e",
      content: '<p>ok</p><script>alert(1)</script>',
      category: "Care",
    });

    expect(blogRepository.create.mock.calls[0][0].content).not.toContain("<script");
  });
});

describe("update", () => {
  it("404s an article that does not exist", async () => {
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.update({ _id: "nope" })).rejects.toThrow(NotFoundError);
  });

  it("writes only the fields the request carried", async () => {
    const blog = aBlog({ title: "Original", excerpt: "Keep me" });
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.update({ _id: "b1", title: "Changed" });

    expect(blog.title).toBe("Changed");
    expect(blog.excerpt).toBe("Keep me");
  });

  it("sanitises edited content too", async () => {
    const blog = aBlog();
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.update({ _id: "b1", content: '<img src=x onerror="alert(1)">' });

    expect(blog.content).not.toContain("onerror");
  });

  it("never re-slugs an article whose title changed", async () => {
    // The address is already in the weekly resources email and in Google's
    // index; moving it breaks both.
    const blog = aBlog({ slug: "ten-tips" });
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.update({ _id: "b1", title: "Something completely different" });

    expect(blog.slug).toBe("ten-tips");
  });

  it("mints a slug for an article that never had one", async () => {
    const blog = aBlog({ slug: undefined, title: "Ten tips" });
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.update({ _id: "b1" });

    expect(blog.slug).toBeTruthy();
  });
});

describe("togglePublished", () => {
  it("announces the first time an article goes live", async () => {
    const { service, notifyAboutNewBlog } = build();

    const { goingLive } = await service.togglePublished("b1");
    await settle();

    expect(goingLive).toBe(true);
    expect(notifyAboutNewBlog).toHaveBeenCalledWith("Ten tips", "Care");
  });

  it("does not announce a re-publish", async () => {
    // Otherwise unpublishing and republishing mails the whole platform again.
    const published = aBlog({ isDraft: true, publishedAt: new Date("2026-01-01") });
    const { service, notifyAboutNewBlog } = build({
      blogRepository: { findById: vi.fn().mockResolvedValue(published) },
    });

    await service.togglePublished("b1");
    await settle();

    expect(notifyAboutNewBlog).not.toHaveBeenCalled();
  });

  it("keeps the original publish date on a re-publish", async () => {
    // Re-dating it would silently jump the article back to the top of the
    // resources list.
    const original = new Date("2026-01-01");
    const blog = aBlog({ isDraft: true, publishedAt: original });
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.togglePublished("b1");

    expect(blog.publishedAt).toBe(original);
  });

  it("stamps a publish date the first time only", async () => {
    const blog = aBlog();
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.togglePublished("b1");

    expect(blog.publishedAt).toBeInstanceOf(Date);
    expect(blog.isDraft).toBe(false);
  });

  it("unpublishes without announcing anything", async () => {
    const live = aBlog({ isDraft: false, publishedAt: new Date() });
    const { service, notifyAboutNewBlog } = build({
      blogRepository: { findById: vi.fn().mockResolvedValue(live) },
    });

    const { goingLive } = await service.togglePublished("b1");
    await settle();

    expect(goingLive).toBe(false);
    expect(live.isDraft).toBe(true);
    expect(notifyAboutNewBlog).not.toHaveBeenCalled();
  });

  it("mints a slug on the way out the door", async () => {
    // A slug is needed the moment the article becomes reachable by URL, and
    // articles created before slugs existed have none.
    const blog = aBlog({ slug: undefined });
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(blog) } });

    await service.togglePublished("b1");

    expect(blog.slug).toBeTruthy();
  });

  it("publishes even if the announcement fails", async () => {
    const blog = aBlog();
    const { service, notifyAboutNewBlog } = build({
      blogRepository: { findById: vi.fn().mockResolvedValue(blog) },
    });
    notifyAboutNewBlog.mockRejectedValue(new Error("smtp down"));

    await expect(service.togglePublished("b1")).resolves.toBeTruthy();
    expect(blog.isDraft).toBe(false);
  });
});

describe("uploadCover", () => {
  const anImage = (over = {}) => ({
    buffer: Buffer.from("img"),
    mimetype: "image/png",
    size: 1000,
    ...over,
  });

  it("400s a request with no file", async () => {
    const { service } = build();

    await expect(service.uploadCover(undefined)).rejects.toThrow("No image was uploaded.");
  });

  it("rejects a file that is not an image", async () => {
    const { service } = build();

    await expect(service.uploadCover(anImage({ mimetype: "application/pdf" }))).rejects.toThrow(
      "isn't an image"
    );
  });

  it("rejects an image over 8MB", async () => {
    const { service } = build();

    await expect(service.uploadCover(anImage({ size: 9 * 1024 * 1024 }))).rejects.toThrow("8MB");
  });

  it("uses a fresh id per upload so a replacement is visible immediately", async () => {
    // Overwriting a fixed id leaves the old picture cached in the CDN under a
    // URL that now means something else.
    const { service, imageUploader } = build();

    await service.uploadCover(anImage());
    await service.uploadCover(anImage());

    const [first] = imageUploader.mock.calls[0].slice(1);
    const [second] = imageUploader.mock.calls[1].slice(1);
    expect(first).not.toBe(second);
  });

  it("accepts every format the composer offers", async () => {
    const { service } = build();

    for (const mimetype of ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"]) {
      await expect(service.uploadCover(anImage({ mimetype }))).resolves.toBeTruthy();
    }
  });
});

describe("remove", () => {
  it("404s an article that does not exist", async () => {
    const { service } = build({ blogRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.remove("nope")).rejects.toThrow(NotFoundError);
  });

  it("returns the deleted article so the caller can name it", async () => {
    const { service, blogRepository } = build();

    const blog = await service.remove("b1");

    expect(blog.title).toBe("Ten tips");
    expect(blogRepository.deleteById).toHaveBeenCalledWith("b1");
  });
});
