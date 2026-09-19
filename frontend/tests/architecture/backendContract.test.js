import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AuthService } from "@features/auth/api/AuthService";
import { VerificationService } from "@features/auth/api/VerificationService";
import { PasswordResetService } from "@features/auth/api/PasswordResetService";
import { ChatService } from "@features/chat/api/ChatService";
import { DashboardService } from "@features/dashboard/api/DashboardService";
import { AccountSettingsService } from "@features/dashboard/api/AccountSettingsService";
import { JobsService } from "@features/jobs/api/JobsService";
import { MatchService } from "@features/matching/api/MatchService";
import { ReportService } from "@features/matching/api/ReportService";
import { NannyShareService } from "@features/nanny-share/api/NannyShareService";
import { ReferralService } from "@features/referral/api/ReferralService";
import { ShareLinkService } from "@features/share-link/api/ShareLinkService";
import { PaymentService } from "@features/subscription/api/PaymentService";

/**
 * Every URL the frontend calls is a route the backend actually serves.
 *
 * This is the one contract neither suite can check alone: the frontend's tests
 * do not know what the server routes, and the server's tests do not know what
 * the browser asks for. A mismatch is invisible until someone clicks the thing
 * — the request 404s, the thunk rejects, and the screen shows a spinner or a
 * generic error. Five such calls were sitting in this codebase, including
 * `/blog/:id` where the server has only ever served `/blogs/:id`.
 *
 * The URLs are collected by CALLING each service method against a fake client
 * rather than by reading the source. Several are built by private helpers from
 * an interpolated path — `/book-hire/${action}/${bookingId}` — and a regex over
 * the source can only see the template, not the six real paths it produces.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.resolve(HERE, "../../../backend/tests/architecture/route-baseline.json");

/** `/nannyShare/:id` → matches `/nannyShare/anything`. */
const asPattern = (routePath) =>
  new RegExp(
    `^${routePath
      .split("/")
      .map((segment) =>
        segment.startsWith(":") ? "[^/?]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      )
      .join("/")}$`
  );

/**
 * One argument that satisfies every method shape here: it destructures as
 * paging, stringifies for `params.toString()`, and interpolates into a path
 * segment as a non-empty string.
 */
const ANY = {
  limit: 1,
  page: 1,
  status: "pending",
  toString: () => "q=1",
};

const SERVICES = {
  AuthService,
  VerificationService,
  PasswordResetService,
  ChatService,
  DashboardService,
  AccountSettingsService,
  JobsService,
  MatchService,
  ReportService,
  NannyShareService,
  ReferralService,
  ShareLinkService,
  PaymentService,
};

/** Drive every public method of every service and record what it requested. */
const collectCalls = async () => {
  const calls = [];

  for (const [name, Service] of Object.entries(SERVICES)) {
    const record = (verb) => (url) => {
      calls.push({ service: name, verb: verb.toUpperCase(), url: String(url) });
      return Promise.resolve({ data: {}, status: 200 });
    };
    const client = {
      get: record("get"),
      delete: record("delete"),
      post: record("post"),
      put: record("put"),
      patch: record("patch"),
    };

    const service = new Service(client);
    const methods = Object.getOwnPropertyNames(Service.prototype).filter(
      (key) => key !== "constructor" && typeof service[key] === "function"
    );

    for (const method of methods) {
      // Two arguments covers every signature here; extras are ignored.
      await service[method](ANY, ANY);
    }
  }

  return calls;
};

describe("the frontend's URLs against the backend's routes", () => {
  const baselineExists = fs.existsSync(BASELINE);

  it.runIf(baselineExists)("calls only routes the backend serves", async () => {
    const routes = JSON.parse(fs.readFileSync(BASELINE, "utf8")).map((route) => ({
      ...route,
      pattern: asPattern(route.path),
    }));

    const calls = await collectCalls();

    const missing = calls
      .filter((call) => {
        const pathOnly = call.url.split("?")[0].replace(/\/$/, "") || "/";
        return !routes.some(
          (route) => route.method === call.verb && route.pattern.test(pathOnly)
        );
      })
      .map((call) => `${call.service}: ${call.verb} ${call.url}`);

    expect(missing).toEqual([]);
  });

  it.runIf(baselineExists)("exercises every service", async () => {
    // Guards the walker: a service whose methods all threw would contribute
    // nothing and quietly pass the check above.
    const calls = await collectCalls();
    const covered = new Set(calls.map((call) => call.service));

    expect([...covered].sort()).toEqual(Object.keys(SERVICES).sort());
    expect(calls.length).toBeGreaterThan(60);
  });
});
