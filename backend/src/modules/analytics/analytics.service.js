import { BaseService } from "../../core/http/BaseService.js";
import {
  visitorIdFor,
  normalizePath,
  referrerHostOf,
  classifySource,
  parseCampaign,
  deviceFrom,
  isBot,
} from "./analytics.util.js";

/** Cap every string that reaches a $group key — see the class comment. */
const str = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * The public analytics beacon. Everything the traffic and page-usage screens
 * report enters the system through here.
 *
 * PUBLIC AND UNAUTHENTICATED, which makes it a write endpoint any script can
 * reach. Three things keep that from being a problem:
 *
 *   * A rate limit (in the module), because the alternative is one loop filling
 *     the largest collection in the database overnight.
 *   * Every field validated and length-capped rather than trusted — `path`,
 *     `title` and the utm values all end up in grouped aggregations, and an
 *     unbounded string in a $group key is a memory problem.
 *   * Bots dropped rather than stored. Facebook fetches every share link before
 *     attaching it to a post; counting those would make a link nobody clicked
 *     look like the most popular page on the site.
 *
 * Every method returns rather than throws on bad input. Analytics must never
 * surface an error to a visitor: a failed beacon costs one row in a reporting
 * table, a visible error costs trust in the page.
 */
export class AnalyticsService extends BaseService {
  /**
   * Record a page view.
   *
   * @returns {Promise<{ viewId: string } | null>} null when the beacon was
   *   dropped — a bot, or missing the fields that make a view meaningful.
   */
  async recordView({ body, userAgent, host, userId, req }) {
    if (isBot(userAgent)) return null;

    const { sessionId, path, title, referrer, query, isEntry } = body || {};

    const session = str(sessionId, 64);
    if (!session || !path) return null;

    const campaign = parseCampaign(query || {});
    const referrerHost = referrerHostOf(referrer);

    const view = await this.pageViewRepository.create({
      sessionId: session,
      visitorId: visitorIdFor(req),
      userId,
      // Query string is discarded by normalizePath. utm_* was read out above,
      // before that happens.
      path: normalizePath(path),
      title: str(title, 200),
      referrerHost,
      source: classifySource({ referrerHost, campaign, selfHost: host }),
      campaign,
      device: deviceFrom(userAgent),
      isEntry: isEntry === true,
    });

    await this.#markAsExit(view, { isEntry, session });

    return { viewId: view._id };
  }

  /**
   * Close off the previous view in this session.
   *
   * `isExit` is a moving target — the last view so far is the exit until
   * another arrives — so it is maintained as views come in rather than computed
   * at read time, which would need a per-session sort on every dashboard load.
   */
  async #markAsExit(view, { isEntry, session }) {
    if (isEntry !== true) {
      await this.pageViewRepository.updateMany(
        { sessionId: session, _id: { $ne: view._id }, isExit: true },
        { $set: { isExit: false } }
      );
    }
    await this.pageViewRepository.updateMany({ _id: view._id }, { $set: { isExit: true } });
  }

  /**
   * Fill in the numbers that only exist once a view has ended. Sent as the page
   * unloads via sendBeacon, which survives the navigation.
   */
  async closeView({ viewId, durationSec, clicks, maxScrollPct }) {
    if (!viewId) return;

    const update = {};

    // Capped at four hours. An unload beacon can arrive from a tab left open
    // over a weekend, and a single 200,000-second session would dominate every
    // average it is included in.
    const duration = Number(durationSec);
    if (Number.isFinite(duration) && duration >= 0) {
      update.durationSec = Math.min(Math.round(duration), 4 * 60 * 60);
    }

    const clickCount = Number(clicks);
    if (Number.isFinite(clickCount) && clickCount >= 0) {
      update.clicks = Math.min(Math.round(clickCount), 1000);
    }

    const scroll = Number(maxScrollPct);
    if (Number.isFinite(scroll)) {
      update.maxScrollPct = Math.min(100, Math.max(0, Math.round(scroll)));
    }

    if (Object.keys(update).length) {
      await this.pageViewRepository.updateMany({ _id: viewId }, { $set: update });
    }
  }
}

export default AnalyticsService;
