import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { adminOnly } from "./admin.middleware.js";
import { logAdminAction } from "./adminAudit.js";
import { WaitlistAdminService } from "./waitlistAdmin.service.js";
import { WaitlistCampaignService } from "./waitlistCampaign.service.js";
import { WaitlistBackfillService } from "./waitlistBackfill.service.js";
import {
  recordWaitlistEntry,
  pendingLaunchRecipients,
} from "../waitlist/waitlist.util.js";
import {
  fetchSheet,
  findEmailColumn,
  normalizeEmail,
  sheetsConfigured,
} from "../../shared/integrations/sheetReader.js";
import {
  sendPlatformLaunchEmail,
  sendCustomLaunchEmail,
  sendOaklandAwarenessEmail,
  renderLaunchEmailPreview,
} from "../../shared/email/email.js";
import { userRepository } from "../user/user.repository.js";
import WaitlistEntry from "../waitlist/waitlistEntry.model.js";
import OnboardingLead from "../lead/onboardingLead.model.js";
import LaunchEmail from "../../shared/email/launchEmail.model.js";

class WaitlistEntryRepository extends BaseRepository {
  bulkWrite(operations, options) {
    return this.model.bulkWrite(operations, options);
  }
}

class LaunchEmailRepository extends BaseRepository {
  upsertForCity(city, update) {
    return this.model
      .findOneAndUpdate({ city }, update, { upsert: true, new: true })
      .lean()
      .exec();
  }
}

export const waitlistRepository = new WaitlistEntryRepository(WaitlistEntry);
export const launchEmailRepository = new LaunchEmailRepository(LaunchEmail);
export const onboardingLeadRepository = new BaseRepository(OnboardingLead);

class WaitlistAdminController extends BaseController {
  constructor({ waitlist, campaign, backfill }) {
    super();
    this.waitlist = waitlist;
    this.campaign = campaign;
    this.backfill = backfill;
  }

  async list(req, res) {
    const { data, pagination } = await this.waitlist.list({ query: req.query });
    return this.ok(res, { data, pagination });
  }

  async cities(req, res) {
    return this.sendData(res, await this.waitlist.cities());
  }

  async export(req, res) {
    const { csv, filename, exported, filters } = await this.waitlist.export({
      query: req.query,
    });

    // Exporting personal data off the platform is worth a record of who did it.
    await logAdminAction({
      req,
      action: "waitlist.notify",
      targetType: "waitlist",
      reason: "Waitlist exported",
      metadata: { exported, filters },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  }

  async answers(req, res) {
    return this.sendData(res, await this.waitlist.answers({ city: req.query.city }));
  }

  /* ───────────────────────────── the draft ──────────────────────────────── */

  async readDraft(req, res) {
    return this.sendData(res, await this.waitlist.readDraft(req.query.city));
  }

  async saveDraft(req, res) {
    const { city, draft } = await this.waitlist.saveDraft({
      body: req.body,
      adminId: req.admin._id,
    });

    return this.ok(res, {
      message: `Saved the launch email for ${city}. Nothing has been sent.`,
      data: {
        city,
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        hasDraft: true,
        heroEyebrow: draft.heroEyebrow,
        heroHeadline: draft.heroHeadline,
        heroSub: draft.heroSub,
        ctaLabel: draft.ctaLabel,
        ctaNote: draft.ctaNote,
      },
    });
  }

  async previewDraft(req, res) {
    return this.sendData(res, this.waitlist.preview(req.body));
  }

  async deleteDraft(req, res) {
    const city = await this.waitlist.deleteDraft(req.query.city);
    return this.message(res, `${city} is back to the standard launch email.`);
  }

  /* ───────────────────────────── the sends ──────────────────────────────── */

  async notifyCity(req, res) {
    const result = await this.campaign.notifyCity({ body: req.body, adminId: req.admin._id });

    if (result.dryRun) {
      return this.ok(res, { dryRun: true, message: result.message, data: result.data });
    }

    if (result.data.sent > 0 || result.data.failed > 0) {
      await logAdminAction({
        req,
        action: "waitlist.notify",
        targetType: "waitlist",
        reason: `Launch notification sent for ${result.city}`,
        metadata: {
          city: result.city,
          sent: result.data.sent,
          failed: result.data.failed,
          campaign: result.campaign,
          usingDraft: result.usingDraft,
          subject: result.subject,
        },
      });
    }

    return this.ok(res, { message: result.message, data: result.data });
  }

  async awareness(req, res) {
    const result = await this.campaign.sendAwareness({
      body: req.body,
      adminId: req.admin._id,
    });

    if (result.dryRun) {
      return this.ok(res, { dryRun: true, message: result.message, data: result.data });
    }

    if (result.data.sent > 0 || result.data.failed > 0) {
      await logAdminAction({
        req,
        action: "waitlist.notify",
        targetType: "waitlist",
        reason: `Awareness campaign sent for ${result.city}`,
        metadata: {
          city: result.city,
          sent: result.data.sent,
          failed: result.data.failed,
          campaign: result.campaign,
        },
      });
    }

    return this.ok(res, { message: result.message, data: result.data });
  }

  async notifyOne(req, res) {
    const result = await this.campaign.notifyOne({
      id: req.params.id,
      body: req.body,
      adminId: req.admin._id,
    });

    if (result.dryRun) {
      return this.ok(res, { message: result.message, data: result.data });
    }

    await logAdminAction({
      req,
      action: "waitlist.notify",
      targetType: "waitlist",
      targetId: result.entry._id,
      targetUserId: result.entry.userId || null,
      reason: `Launch email sent individually to ${result.entry.email}`,
      metadata: {
        email: result.entry.email,
        city: result.city,
        usingDraft: result.usingDraft,
        resend: result.resend,
      },
    });

    return this.ok(res, { message: result.message, data: result.data });
  }

  /* ──────────────────────────── the backfills ───────────────────────────── */

  async backfillConsent(req, res) {
    const result = await this.backfill.backfillConsent({ body: req.body });

    if (!result.dryRun) {
      await logAdminAction({
        req,
        action: "waitlist.consent_backfill",
        targetType: "waitlist",
        reason:
          `Recorded consent for ${result.modified} waitlist signups ` +
          `(sources: ${result.sources.join(", ")})`,
        metadata: {
          sources: result.sources,
          eligible: result.eligible,
          modified: result.modified,
        },
      });
    }

    return this.ok(res, { message: result.message, data: result.data });
  }

  /**
   * The sheet pass on its own button.
   *
   * No dry run, unlike the consent backfill: this only ever fills fields that
   * are empty, never overwrites an answer, and mails nobody. There is nothing
   * here a preview would protect against.
   */
  async backfillAnswers(req, res) {
    const result = await this.backfill.recoverAnswersFromSheet();

    if (!result.ran) {
      return this.ok(res, { message: `Nothing was recovered. ${result.reason}`, data: result });
    }

    await logAdminAction({
      req,
      action: "waitlist.notify",
      targetType: "waitlist",
      reason: `Recovered intake answers from the waitlist sheet (${result.updatesApplied} rows updated)`,
      metadata: result,
    });

    const recovered = result.missingBefore - result.missingAfter;

    return this.ok(res, {
      message:
        result.updatesApplied === 0
          ? `Read ${result.sheetRows} sheet rows and found nothing to add — every row that could be matched already has its answers.`
          : `${result.updatesApplied} ${result.updatesApplied === 1 ? "row" : "rows"} updated from ${result.sheetRows} sheet rows. ` +
            `${recovered} ${recovered === 1 ? "person" : "people"} who showed a dash now have their answers.`,
      data: result,
    });
  }

  async backfillAll(req, res) {
    return this.ok(res, {
      message: "Backfill complete.",
      data: await this.backfill.backfillAll(),
    });
  }
}

export class AdminWaitlistModule extends RouteModule {
  static basePath = "/admin/waitlist";
  static moduleName = "admin:waitlist";

  registerRoutes(router) {
    const shared = { waitlistRepository, launchEmailRepository };

    const controller = new WaitlistAdminController({
      waitlist: new WaitlistAdminService({
        ...shared,
        renderLaunchEmailPreview,
      }),
      campaign: new WaitlistCampaignService({
        ...shared,
        userRepository,
        // Injected: every one of these either mails a real stranger or reads
        // the consent record they are mailed against.
        pendingLaunchRecipients,
        sendPlatformLaunchEmail,
        sendCustomLaunchEmail,
        sendOaklandAwarenessEmail,
      }),
      backfill: new WaitlistBackfillService({
        ...shared,
        userRepository,
        onboardingLeadRepository,
        recordWaitlistEntry,
        fetchSheet,
        findEmailColumn,
        normalizeEmail,
        sheetsConfigured,
      }),
    });

    router.use(adminOnly);

    // Literals before "/:id/notify" — the only parameterised route here.
    router.get("/", controller.list);
    router.get("/cities", controller.cities);
    router.get("/export", controller.export);
    router.get("/answers", controller.answers);

    router.get("/launch-email", controller.readDraft);
    router.put("/launch-email", controller.saveDraft);
    router.delete("/launch-email", controller.deleteDraft);
    router.post("/launch-email/preview", controller.previewDraft);

    router.post("/notify", controller.notifyCity);
    router.post("/awareness", controller.awareness);
    router.post("/:id/notify", controller.notifyOne);

    router.post("/backfill", controller.backfillAll);
    router.post("/consent-backfill", controller.backfillConsent);
    router.post("/answers-backfill", controller.backfillAnswers);
  }
}

export default AdminWaitlistModule;
