import { describe, it, expect } from "vitest";
import express from "express";
import { Application } from "#src/core/Application.js";
import { ModuleRegistry } from "#src/core/http/ModuleRegistry.js";
import { RouteModule } from "#src/core/http/RouteModule.js";
import { createRegistry } from "#src/modules/index.js";

/**
 * Body-parser ordering, which is behaviour rather than style.
 *
 * A webhook sender signs the literal bytes of the request. `express.json()`
 * consumes the stream and hands on a parsed object, and re-serialising that
 * object does not reproduce the original bytes — key order and whitespace
 * differ — so the signature never verifies again. For Stripe specifically that
 * failure is silent and expensive: `premium` is granted only from the webhook,
 * so every customer would pay and stay on the free tier.
 */

class RawModule extends RouteModule {
  static basePath = "/raw";
  static moduleName = "raw";
  static rawBody = true;
  registerRoutes(router) {
    // The flag only decides *where* the module mounts; it still brings its own
    // parser, exactly as StripeWebhookModule does.
    router.post("/hook", express.raw({ type: "application/json" }), (req, res) =>
      res.json({ isBuffer: Buffer.isBuffer(req.body) })
    );
  }
}

class NormalModule extends RouteModule {
  static basePath = "/normal";
  static moduleName = "normal";
  registerRoutes(router) {
    router.post("/thing", (req, res) => res.json({ isBuffer: Buffer.isBuffer(req.body) }));
  }
}

const post = (app, path, body) =>
  new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const json = await response.json();
      server.close(() => resolve(json));
    });
  });

describe("ModuleRegistry raw-body split", () => {
  it("keeps a raw-body module out of the ordinary router", () => {
    const registry = new ModuleRegistry([new RawModule(), new NormalModule()]);
    const routes = RouteModule.describeRouter(registry.createRouter(), "");

    expect(routes.map((route) => route.path)).toEqual(["/normal/thing"]);
  });

  it("puts it in the raw router instead", () => {
    const registry = new ModuleRegistry([new RawModule(), new NormalModule()]);
    const routes = RouteModule.describeRouter(registry.createRawBodyRouter(), "");

    expect(routes.map((route) => route.path)).toEqual(["/raw/hook"]);
  });

  it("returns no raw router at all when no module needs one", () => {
    // So Application does not mount an empty layer for the common case.
    expect(new ModuleRegistry([new NormalModule()]).createRawBodyRouter()).toBeNull();
  });

  it("still reports both modules in the route table", () => {
    // The split is a mounting detail; parity must still see every route.
    const registry = new ModuleRegistry([new RawModule(), new NormalModule()]);

    expect(registry.describe().map((route) => route.path)).toEqual([
      "/normal/thing",
      "/raw/hook",
    ]);
  });
});

describe("Application body parsing", () => {
  it("hands a raw-body module the unparsed bytes", async () => {
    const app = new Application({
      registry: new ModuleRegistry([new RawModule(), new NormalModule()]),
    }).build();

    await expect(post(app, "/raw/hook", '{"a":1}')).resolves.toEqual({ isBuffer: true });
  });

  it("still parses JSON for every other module", async () => {
    const app = new Application({
      registry: new ModuleRegistry([new RawModule(), new NormalModule()]),
    }).build();

    await expect(post(app, "/normal/thing", '{"a":1}')).resolves.toEqual({ isBuffer: false });
  });
});

describe("the real registry", () => {
  it("mounts the Stripe webhook, and only the Stripe webhook, as raw", () => {
    // A second module quietly opting in would be worth noticing: raw bodies
    // mean no `req.body` object, which most handlers assume they have.
    const raw = createRegistry()
      .modules.filter((module) => module.needsRawBody)
      .map((module) => module.basePath);

    expect(raw).toEqual(["/stripe"]);
  });

  it("serves the webhook ahead of express.json in the built app", async () => {
    const app = new Application({ registry: createRegistry() }).build();
    const layers = app._router?.stack ?? app.router.stack;

    const rawIndex = layers.findIndex((layer) => layer.name === "router");
    const jsonIndex = layers.findIndex((layer) => layer.name === "jsonParser");

    expect(rawIndex).toBeGreaterThanOrEqual(0);
    expect(jsonIndex).toBeGreaterThan(rawIndex);
  });
});
