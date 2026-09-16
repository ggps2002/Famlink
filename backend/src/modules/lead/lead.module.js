import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { ConfirmationThrottle } from "../../shared/throttle/ConfirmationThrottle.js";
import config from "../../config/index.js";
import { LeadService } from "./lead.service.js";
import Lead from "./lead.model.js";
import ResourceLead from "./resourceLead.model.js";
import OnboardingLead from "./onboardingLead.model.js";
import { recordWaitlistEntry } from "../waitlist/waitlist.util.js";
import { sendLeadToSlack } from "../../shared/integrations/slack.service.js";
import { sendResourceDownloadEmail } from "../../shared/email/email.js";

const APP_URL = config.urls.app || config.urls.client || "https://www.famlink.care";

export const leadRepository = new BaseRepository(Lead);
export const resourceLeadRepository = new BaseRepository(ResourceLead);
export const onboardingLeadRepository = new BaseRepository(OnboardingLead);

/**
 * One service, three route modules.
 *
 * The three capture flows are the same concern — people who gave us details
 * before having an account — but they were mounted under three separate
 * prefixes that the frontend already calls. The prefixes are preserved; the
 * logic is not triplicated.
 */
export const leadService = new LeadService({
  leadRepository,
  resourceLeadRepository,
  onboardingLeadRepository,
  // 15 rather than the waitlist's 10: one visitor may legitimately want both
  // resources, and may retry.
  resourceThrottle: new ConfirmationThrottle({ maxPerIp: 15 }),
  emailService: { sendResourceDownloadEmail },
  sendLeadToSlack,
  recordWaitlistEntry,
  appUrl: APP_URL,
});

class LeadController extends BaseController {
  constructor({ leadService: service }) {
    super();
    this.leadService = service;
  }

  async createInbound(req, res) {
    const lead = await this.leadService.createInboundLead(req.body);
    return this.created(res, lead, {
      message: "Lead successfully saved and sent to Slack!",
    });
  }

  async captureResource(req, res) {
    const result = await this.leadService.captureResourceLead({
      ...(req.body || {}),
      ip: req.ip,
    });
    return this.ok(res, result);
  }

  async captureOnboarding(req, res) {
    await this.leadService.captureOnboardingLead(req.body || {});
    return this.message(res, "Saved.");
  }
}

const controller = new LeadController({ leadService });

/** Inbound leads from external sources (scrapers, automations). */
export class LeadModule extends RouteModule {
  static basePath = "/leads";
  static moduleName = "leads";

  registerRoutes(router) {
    router.post("/incoming", controller.createInbound);
  }
}

/** Lead-magnet downloads. Public — fires before the visitor has an account. */
export class ResourceLeadModule extends RouteModule {
  static basePath = "/resource-leads";
  static moduleName = "resource-leads";

  registerRoutes(router) {
    router.post("/capture", controller.captureResource);
  }
}

/** Abandoned onboarding. Public, and the whole point is that it precedes signup. */
export class OnboardingLeadModule extends RouteModule {
  static basePath = "/onboarding-leads";
  static moduleName = "onboarding-leads";

  registerRoutes(router) {
    router.post("/capture", controller.captureOnboarding);
  }
}

export default LeadModule;
