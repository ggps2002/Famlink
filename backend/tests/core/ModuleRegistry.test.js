import { describe, it, expect } from "vitest";
import request from "supertest";
import { RouteModule } from "#src/core/http/RouteModule.js";
import { ModuleRegistry } from "#src/core/http/ModuleRegistry.js";
import { Application } from "#src/core/Application.js";

class AlphaModule extends RouteModule {
  static basePath = "/alpha";
  registerRoutes(router) {
    router.get("/", (_req, res) => res.json({ module: "alpha" }));
    router.post("/:id/act", (_req, res) => res.json({ ok: true }));
  }
}

class BetaModule extends RouteModule {
  static basePath = "/beta";
  registerRoutes(router) {
    router.get("/list", (_req, res) => res.json({ module: "beta" }));
  }
}

describe("RouteModule", () => {
  it("is abstract", () => {
    expect(() => new RouteModule()).toThrow(/abstract/);
  });

  it("requires a basePath", () => {
    class Nameless extends RouteModule {
      registerRoutes() {}
    }
    expect(() => new Nameless().basePath).toThrow(/must declare a static basePath/);
  });

  it("requires registerRoutes", () => {
    class Empty extends RouteModule {
      static basePath = "/empty";
    }
    expect(() => new Empty()).toThrow(/must implement registerRoutes/);
  });

  it("describes its own routes with the basePath applied", () => {
    expect(new AlphaModule().describe()).toEqual([
      { method: "GET", path: "/alpha", module: "Alpha" },
      { method: "POST", path: "/alpha/:id/act", module: "Alpha" },
    ]);
  });
});

describe("ModuleRegistry", () => {
  it("rejects anything that is not a RouteModule", () => {
    expect(() => new ModuleRegistry([{ basePath: "/x" }])).toThrow(/expects a RouteModule/);
  });

  it("refuses two modules claiming the same basePath", () => {
    class Clash extends RouteModule {
      static basePath = "/alpha";
      registerRoutes(r) {
        r.get("/", (_q, s) => s.end());
      }
    }

    const registry = new ModuleRegistry([new AlphaModule()]);
    // Silently shadowing one of them is the failure this prevents.
    expect(() => registry.register(new Clash())).toThrow(/Duplicate basePath/);
  });

  it("mounts every registered module", async () => {
    const registry = new ModuleRegistry([new AlphaModule(), new BetaModule()]);
    const app = new Application({ registry }).build();

    await expect(request(app).get("/alpha")).resolves.toMatchObject({
      status: 200,
      body: { module: "alpha" },
    });
    await expect(request(app).get("/beta/list")).resolves.toMatchObject({
      status: 200,
      body: { module: "beta" },
    });
  });

  it("produces a stable, sorted route table", () => {
    const registry = new ModuleRegistry([new BetaModule(), new AlphaModule()]);

    expect(registry.describe()).toEqual([
      { method: "GET", path: "/alpha", module: "Alpha" },
      { method: "POST", path: "/alpha/:id/act", module: "Alpha" },
      { method: "GET", path: "/beta/list", module: "Beta" },
    ]);
  });
});

describe("Application", () => {
  it("answers /health without touching the database", async () => {
    const app = new Application({ registry: new ModuleRegistry() }).build();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("404s an unknown path through the shared handler", async () => {
    const app = new Application({ registry: new ModuleRegistry() }).build();
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("mounts raw-body routers ahead of the JSON parser", async () => {
    // Stripe verifies a signature over the exact bytes sent. If express.json()
    // ran first the handler would see a parsed object and every delivery would
    // fail its signature check.
    const { Router, raw } = await import("express").then((m) => ({
      Router: m.Router,
      raw: m.raw,
    }));

    const webhook = Router();
    webhook.post("/webhook", raw({ type: "application/json" }), (req, res) =>
      res.json({ isBuffer: Buffer.isBuffer(req.body) })
    );

    const app = new Application({
      registry: new ModuleRegistry(),
      rawBodyRouters: [["/stripe", webhook]],
    }).build();

    const res = await request(app)
      .post("/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));

    expect(res.body.isBuffer).toBe(true);
  });
});
