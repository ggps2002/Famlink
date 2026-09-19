import { Application } from "./core/Application.js";
import { Server } from "./core/Server.js";
import { createRegistry, migratedPrefixes } from "./modules/index.js";
import { assertRequiredEnv } from "./config/index.js";
import config from "./config/index.js";

/**
 * Assembles the running application.
 *
 * Everything here used to be top-level statements in index.js, which meant the
 * whole system — database, sockets, cron — started as a side effect of anyone
 * importing that file. Now starting is something you call, and each piece is
 * obtained separately so a test can take the app without the rest.
 *
 * ── The hybrid mount ──────────────────────────────────────────────────────
 * The migration is incremental, so at any moment some prefixes are served by
 * feature modules and the rest by the original Routes/ tree. Both are mounted,
 * modules first. Express matches layers in registration order, so a migrated
 * prefix is answered by its module and never reaches the legacy router even
 * while the old file still declares it.
 *
 * The legacy router is imported dynamically for a specific reason: importing it
 * opens a Redis connection and schedules cron jobs at module scope, which is
 * fine for a server process and fatal for a test run — the process never exits.
 * Keeping it behind an await means buildApp({ legacy: false }) is genuinely
 * inert, which is what the route-parity and unit suites rely on.
 */

export const buildApp = async ({ legacy = true } = {}) => {
  const registry = createRegistry();

  const application = new Application({
    // Nothing left here: the Stripe webhook, the one endpoint that needs the
    // unparsed body, is now a module declaring `static rawBody = true`, and the
    // registry hands it to Application ahead of the JSON parser.
    rawBodyRouters: [],
    registry,
    legacyRouter: legacy ? (await import("../Routes/index.js")).default : null,
  });

  return { app: application.build(), application, registry };
};

/** The scheduled jobs, as declarations the Server starts and can stop. */
const scheduledJobs = async () => {
  const [
    { startCompleteProfileReminderJob },
    { startWeeklyResourcesJob },
    { startNewUsersInAreaJob },
    { startReengagementJob },
    { startOnboardingNudgeJob },
    { startFeedbackRequestJob },
    { startTrafficRollupJob },
    { startEmailDispatcherJob },
  ] = await Promise.all([
    import("./shared/jobs/completeProfileReminder.js"),
    import("./shared/jobs/weeklyResources.js"),
    import("./shared/jobs/newUsersInArea.js"),
    import("./shared/jobs/reengagementReminder.js"),
    import("./shared/jobs/onboardingNudge.js"),
    import("./shared/jobs/feedbackRequest.js"),
    import("./shared/jobs/trafficRollup.js"),
    import("./shared/email/emailDispatcher.js"),
  ]);

  return [
    { name: "complete-profile-reminder", start: startCompleteProfileReminderJob },
    { name: "weekly-resources", start: startWeeklyResourcesJob },
    { name: "new-users-in-area", start: startNewUsersInAreaJob },
    { name: "reengagement", start: startReengagementJob },
    { name: "onboarding-nudge", start: startOnboardingNudgeJob },
    { name: "feedback-request", start: startFeedbackRequestJob },
    // Not optional: raw page views are dropped by a TTL index after 180 days,
    // so any traffic history older than that exists only because this ran.
    { name: "traffic-rollup", start: startTrafficRollupJob },
    // Not a cron job like the others: it polls continuously rather than firing
    // on a schedule. It lives here because Server already owns starting and
    // stopping background work, and the dispatcher above all needs the stopping
    // — a clean SIGTERM lets it finish the pass it is in, so its claimed rows
    // are settled instead of left for another machine to reclaim.
    { name: "email-dispatcher", start: startEmailDispatcherJob },
  ];
};

const socketHandlers = async () => {
  // Chat only. The booking socket retired with /book-hire on 2026-09-20 — it
  // served booking status to the hire screens, which no longer exist.
  const [{ default: chatSocket }] = await Promise.all([
    import("./modules/messaging/chat.socket.js"),
  ]);

  return [chatSocket];
};

export const startServer = async () => {
  assertRequiredEnv();

  const { app, registry } = await buildApp({ legacy: true });

  const server = new Server({
    app,
    port: config.port,
    socketHandlers: await socketHandlers(),
    jobs: await scheduledJobs(),
  });

  await server.start();

  console.log(
    `[modules] ${registry.modules.length} feature modules mounted: ${migratedPrefixes().join(", ")}`
  );
  console.log("[modules] remaining prefixes served by the legacy router");

  return server;
};

export default startServer;
