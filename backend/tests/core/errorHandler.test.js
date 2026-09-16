import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { errorHandler, notFoundHandler } from "#src/core/http/middleware/errorHandler.js";
import { ValidationError } from "#src/core/errors/index.js";

const appThatThrows = (error) => {
  const app = express();
  app.use(express.json());
  app.get("/", (_req, _res, next) => next(error));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe("errorHandler", () => {
  beforeEach(() => {
    // 5xx paths log a stack; keep the suite output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("sends an operational error's own message and code", async () => {
    const res = await request(appThatThrows(new ValidationError("Email is required"))).get("/");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Email is required", code: "VALIDATION_ERROR" });
  });

  it("translates a Mongoose CastError into a 400 rather than a 500", async () => {
    const castError = new mongoose.Error.CastError("ObjectId", "not-an-id", "userId");
    const res = await request(appThatThrows(castError)).get("/");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid userId");
  });

  it("reports schema validation failures per field", async () => {
    const schema = new mongoose.Schema({ email: { type: String, required: true } });
    const Model = mongoose.models.ErrTest ?? mongoose.model("ErrTest", schema);
    const validationError = new Model({}).validateSync();

    const res = await request(appThatThrows(validationError)).get("/");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details).toHaveProperty("email");
  });

  it("names the duplicated field but never echoes its value", async () => {
    const duplicate = Object.assign(new Error("E11000 duplicate key"), {
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email: "someone@example.com" },
    });

    const res = await request(appThatThrows(duplicate)).get("/");

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("email");
    // Reflecting the address back would make signup a membership oracle.
    expect(JSON.stringify(res.body)).not.toContain("someone@example.com");
  });

  it("turns a malformed JSON body into a 400", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Malformed JSON body");
  });

  it("does not leak an unexpected error's message in production", async () => {
    // config captured NODE_ENV at import; re-import with production set so the
    // production branch is what actually runs.
    vi.resetModules();
    process.env.NODE_ENV = "production";

    try {
      const { errorHandler: prodHandler } = await import(
        "#src/core/http/middleware/errorHandler.js"
      );
      const app = express();
      app.get("/", (_req, _res, next) => next(new Error("connection string is mongodb://secret")));
      app.use(prodHandler);

      const res = await request(app).get("/");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Something went wrong", code: "INTERNAL_ERROR" });
      expect(res.body.debug).toBeUndefined();
    } finally {
      process.env.NODE_ENV = "test";
      vi.resetModules();
    }
  });

  it("includes debug detail outside production", async () => {
    const res = await request(appThatThrows(new Error("boom"))).get("/");

    expect(res.status).toBe(500);
    expect(res.body.debug.message).toBe("boom");
  });

  it("404s an unmatched path with its method and url", async () => {
    const app = express();
    app.use(notFoundHandler);
    app.use(errorHandler);

    const res = await request(app).get("/nope");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Cannot GET /nope");
  });
});
