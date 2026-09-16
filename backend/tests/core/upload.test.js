import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import multer from "multer";
import { upload, UPLOAD_LIMITS } from "#src/core/http/middleware/upload.js";
import { errorHandler } from "#src/core/http/middleware/errorHandler.js";

/**
 * These exercise the real middleware against a real multipart request, because
 * the thing being guarded — how much memory one request can allocate before any
 * handler runs — is not observable from the configuration object alone.
 */
const appWith = (middleware) => {
  const app = express();
  app.post("/upload", middleware, (req, res) =>
    res.status(200).json({
      files: (req.files ?? (req.file ? [req.file] : [])).map((f) => ({
        field: f.fieldname,
        bytes: f.size,
        inMemory: Buffer.isBuffer(f.buffer),
      })),
    })
  );
  app.use(errorHandler);
  return app;
};

const bytes = (n) => Buffer.alloc(n, "a");

describe("storage", () => {
  it("keeps uploads in memory and never writes to disk", async () => {
    // Every consumer reads file.buffer and hands it to Cloudinary. Writing
    // locally would also be pointless on an ephemeral filesystem.
    const res = await request(appWith(upload.any()))
      .post("/upload")
      .attach("avatar", bytes(1024), "a.jpg");

    expect(res.status).toBe(200);
    expect(res.body.files[0]).toEqual({ field: "avatar", bytes: 1024, inMemory: true });
  });

  it("reports the real byte count, which the size checks depend on", async () => {
    const res = await request(appWith(upload.single("image")))
      .post("/upload")
      .attach("image", bytes(4096), "b.png");

    expect(res.body.files[0].bytes).toBe(4096);
  });
});

describe("limits", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("caps a single file at 10MB", () => {
    expect(UPLOAD_LIMITS.fileSize).toBe(10 * 1024 * 1024);
  });

  it("rejects a file over the cap instead of buffering it", async () => {
    // Without a limit this allocates whatever the client sends, and the process
    // dies before any application-level size check can run.
    const res = await request(appWith(upload.single("image")))
      .post("/upload")
      .attach("image", bytes(UPLOAD_LIMITS.fileSize + 1024), "big.png");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That file is too large. The maximum is 10MB.");
    expect(res.body.code).toBe("UPLOAD_REJECTED");
  });

  it("accepts a file just under the cap", async () => {
    const res = await request(appWith(upload.single("image")))
      .post("/upload")
      .attach("image", bytes(UPLOAD_LIMITS.fileSize - 1024), "ok.png");

    expect(res.status).toBe(200);
  });

  it("caps the number of parts, which upload.any() otherwise leaves unbounded", async () => {
    const req = request(appWith(upload.any())).post("/upload");
    for (let i = 0; i < UPLOAD_LIMITS.files + 2; i += 1) {
      req.attach(`file${i}`, bytes(16), `f${i}.png`);
    }

    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Too many files. Please upload fewer at once.");
  });

  it("allows a request at exactly the part limit", async () => {
    const req = request(appWith(upload.any())).post("/upload");
    for (let i = 0; i < UPLOAD_LIMITS.files; i += 1) {
      req.attach(`file${i}`, bytes(16), `f${i}.png`);
    }

    await expect(req.then((r) => r.status)).resolves.toBe(200);
  });

  it("rejects a file on a field that does not accept one", async () => {
    const res = await request(appWith(upload.single("image")))
      .post("/upload")
      .attach("somethingElse", bytes(16), "x.png");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A file arrived on a field that does not accept one.");
    // The field name is ours, not the caller's, so echoing it is safe.
    expect(res.body.details).toEqual({ field: "somethingElse" });
  });
});

describe("error translation", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("turns every multer code into something the uploader can act on", async () => {
    // Untranslated these are 500s, which tells somebody whose photo was too
    // large that the server broke — inviting them to retry the same upload.
    for (const [code, expected] of [
      ["LIMIT_FILE_SIZE", "That file is too large. The maximum is 10MB."],
      ["LIMIT_FILE_COUNT", "Too many files. Please upload fewer at once."],
      ["LIMIT_FIELD_COUNT", "Too many form fields in that request."],
      ["LIMIT_UNEXPECTED_FILE", "A file arrived on a field that does not accept one."],
    ]) {
      const app = express();
      app.get("/", (_req, _res, next) => next(new multer.MulterError(code)));
      app.use(errorHandler);

      const res = await request(app).get("/");
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(expected);
    }
  });

  it("falls back to a generic message for a code it does not know", async () => {
    const app = express();
    app.get("/", (_req, _res, next) => {
      const error = new multer.MulterError("LIMIT_FILE_SIZE");
      error.code = "SOMETHING_NEW";
      next(error);
    });
    app.use(errorHandler);

    const res = await request(app).get("/");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That upload was rejected.");
  });
});
