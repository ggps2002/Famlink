import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { BaseController } from "#src/core/http/BaseController.js";
import { errorHandler } from "#src/core/http/middleware/errorHandler.js";
import { ForbiddenError, NotFoundError } from "#src/core/errors/index.js";

/** Minimal app that mounts one handler behind the real error boundary. */
const appWith = (register) => {
  const app = express();
  app.use(express.json());
  register(app);
  app.use(errorHandler);
  return app;
};

class DemoController extends BaseController {
  constructor(service = {}) {
    super();
    this.service = service;
  }

  async show(req, res) {
    // Reaching `this.service` at all is the assertion: an unbound method would
    // throw here, which is the exact failure the constructor binding prevents.
    const record = await this.service.find(req.params.id);
    return this.sendData(res, record);
  }

  async boom() {
    throw new ForbiddenError("Not allowed");
  }

  async reject() {
    return Promise.reject(new NotFoundError("Gone"));
  }

  async crash() {
    return null.property;
  }
}

describe("BaseController", () => {
  it("binds methods so a detached handler keeps its receiver", async () => {
    const service = { find: vi.fn().mockResolvedValue({ id: "abc" }) };
    const controller = new DemoController(service);

    const app = appWith((a) => a.get("/thing/:id", controller.show));
    const res = await request(app).get("/thing/abc");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { id: "abc" } });
    expect(service.find).toHaveBeenCalledWith("abc");
  });

  it("forwards a thrown AppError to the error boundary", async () => {
    const controller = new DemoController();
    const app = appWith((a) => a.get("/boom", controller.boom));

    const res = await request(app).get("/boom");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Not allowed", code: "FORBIDDEN" });
  });

  it("forwards a rejected promise, not just a synchronous throw", async () => {
    const controller = new DemoController();
    const app = appWith((a) => a.get("/reject", controller.reject));

    const res = await request(app).get("/reject");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Gone");
  });

  it("turns an unexpected error into a generic 500", async () => {
    const controller = new DemoController();
    const app = appWith((a) => a.get("/crash", controller.crash));

    const res = await request(app).get("/crash");

    expect(res.status).toBe(500);
    // The TypeError's own message is never the client-facing one. Off
    // production it is still attached under `debug` for whoever caused it —
    // errorHandler.test.js covers that it disappears in production.
    expect(res.body.message).toBe("Something went wrong");
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });

  describe("response helpers", () => {
    class ShapeController extends BaseController {
      async list(_req, res) {
        return this.sendData(res, [1, 2], {
          message: "Fetched",
          pagination: { currentPage: 1, hasMore: false },
        });
      }
      async make(_req, res) {
        return this.created(res, { id: "new" });
      }
      async act(_req, res) {
        return this.message(res, "Done");
      }
      async drop(_req, res) {
        return this.noContent(res);
      }
    }

    const controller = new ShapeController();

    it("keeps the { data, message, pagination } shape the frontend parses", async () => {
      const app = appWith((a) => a.get("/list", controller.list));
      const res = await request(app).get("/list");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: [1, 2],
        message: "Fetched",
        pagination: { currentPage: 1, hasMore: false },
      });
    });

    it("sends 201 from created()", async () => {
      const app = appWith((a) => a.post("/make", controller.make));
      const res = await request(app).post("/make");

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ id: "new" });
    });

    it("sends a bare message and a bare 204", async () => {
      const app = appWith((a) => {
        a.post("/act", controller.act);
        a.delete("/drop", controller.drop);
      });

      await expect(request(app).post("/act")).resolves.toMatchObject({
        status: 200,
        body: { message: "Done" },
      });
      await expect(request(app).delete("/drop")).resolves.toMatchObject({ status: 204 });
    });
  });
});
