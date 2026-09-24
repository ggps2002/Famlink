import { ModuleRegistry } from "../core/http/ModuleRegistry.js";
import { AccountSettingsModule } from "./user/accountSettings.module.js";
import { AdminActivityModule } from "./admin/activity.module.js";
import { AdminAnalyticsModule } from "./admin/analyticsAdmin.module.js";
import { AdminAuditLogModule } from "./admin/auditLog.module.js";
import { AdminEmailLogModule } from "./admin/emailLog.module.js";
import { AdminEmailQueueModule } from "./admin/emailQueue.module.js";
import { AdminMatchModule } from "./admin/matchAdmin.module.js";
import { AdminMessagesModule } from "./admin/messages.module.js";
import { AdminReferralsModule } from "./admin/referrals.module.js";
import { AdminReportsModule } from "./admin/reports.module.js";
import { AdminShareLinksModule } from "./admin/shareLinks.module.js";
import { AdminSheetsModule } from "./admin/sheets.module.js";
import { AdminSubscriptionsModule } from "./admin/subscriptions.module.js";
import { AdminSupportModule } from "./admin/support.module.js";
import { AdminTermsModule } from "./admin/terms.module.js";
import { AdminTrafficModule } from "./admin/traffic.module.js";
import { AdminUserModule } from "./admin/adminUser.module.js";
import { AdminUsersModule } from "./admin/users.module.js";
import { AdminWaitlistModule } from "./admin/waitlist.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BlogModule } from "./blog/blog.module.js";
import { ChatModule } from "./messaging/chat.module.js";
import { DebugModule } from "./debug/debug.module.js";
import { EmailVerificationModule } from "./auth/emailVerification.module.js";
import { PhoneVerificationModule } from "./auth/phoneVerification.module.js";
import { FavouriteModule } from "./favourite/favourite.module.js";
import { FeedbackModule } from "./feedback/feedback.module.js";
import { JobModule } from "./job/job.module.js";
import {
  LeadModule,
  ResourceLeadModule,
  OnboardingLeadModule,
} from "./lead/lead.module.js";
import { LegalModule } from "./legal/legal.module.js";
import { LocationModule } from "./location/location.module.js";
import { MatchModule } from "./match/match.module.js";
import { NewsletterModule } from "./billing/newsletter.module.js";
import { PaymentModule } from "./billing/payment.module.js";
import { RevenueModule } from "./billing/revenue.module.js";
import { StripeWebhookModule } from "./billing/webhook.module.js";
import { MessageModule } from "./messaging/message.module.js";
import { NannyShareModule } from "./nannyShare/nannyShare.module.js";
import { OnboardingModule } from "./onboarding/onboarding.module.js";
import { OnboardingRecordModule } from "./onboardingRecord/onboardingRecord.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { ReferralModule } from "./referral/referral.module.js";
import { ReportModule } from "./report/report.module.js";
import { ReviewModule } from "./review/review.module.js";
import { ShareModule } from "./share/share.module.js";
import { IdentityVerificationModule } from "./verification/identity.module.js";
import { UnsubscribeModule } from "./unsubscribe/unsubscribe.module.js";
import { UserDataModule } from "./user/userData.module.js";
import { UserProfileModule } from "./user/userProfile.module.js";
import { WaitlistModule } from "./waitlist/waitlist.module.js";

/**
 * Every feature module the API serves.
 *
 * This list is the API surface. A module that is not here is not reachable, and
 * a module here cannot be reached under a prefix it does not declare — which is
 * what makes the route-parity test meaningful rather than a restatement of a
 * hand-maintained manifest.
 *
 * MIGRATION STATUS: modules are moved off Routes/ one at a time. Anything not
 * yet listed is still served by the legacy router, which the bootstrap mounts
 * alongside this registry until the list is complete. tests/architecture/
 * routes.test.js asserts that each migrated prefix reproduces its pre-refactor
 * route table exactly.
 */
/**
 * OUT OF SCOPE, deliberately: /postJob and /nannyShare stay on the legacy
 * router. Both are still called by the frontend and both back live, routed
 * screens — /nannyShare in particular carries the six-step nanny-share
 * questionnaire, which is the product's main funnel. They are left working;
 * excluding them from the module restructure is not the same as deleting them.
 *
 * DELETED, by contrast: /community and its Tips & Articles screens were removed
 * outright on 2026-08-12. See RETIRED_PREFIXES in tests/architecture/routes.test.js,
 * which asserts they stay gone.
 */
export const MIGRATED_MODULES = [
  AccountSettingsModule,
  // The admin console. One module per sub-prefix rather than one for /admin, so
  // the registry's duplicate-basePath check covers them individually and the
  // route table names which screen each endpoint belongs to.
  AdminActivityModule,
  AdminAnalyticsModule,
  AdminAuditLogModule,
  AdminEmailLogModule,
  AdminEmailQueueModule,
  AdminMatchModule,
  AdminMessagesModule,
  AdminReferralsModule,
  AdminReportsModule,
  AdminShareLinksModule,
  AdminSheetsModule,
  AdminSubscriptionsModule,
  AdminSupportModule,
  AdminTermsModule,
  AdminTrafficModule,
  AdminUserModule,
  AdminUsersModule,
  AdminWaitlistModule,
  AnalyticsModule,
  AuthModule,
  BlogModule,
  ChatModule,
  DebugModule,
  EmailVerificationModule,
  PhoneVerificationModule,
  FavouriteModule,
  FeedbackModule,
  JobModule,
  LeadModule,
  ResourceLeadModule,
  OnboardingLeadModule,
  LegalModule,
  LocationModule,
  MatchModule,
  MessageModule,
  NannyShareModule,
  NewsletterModule,
  OnboardingModule,
  OnboardingRecordModule,
  PaymentModule,
  RevenueModule,
  StripeWebhookModule,
  ProfileModule,
  ReferralModule,
  ReportModule,
  ReviewModule,
  ShareModule,
  IdentityVerificationModule,
  UnsubscribeModule,
  UserDataModule,
  UserProfileModule,
  WaitlistModule,
];

/** Prefixes this registry owns — the legacy router must no longer serve them. */
export const migratedPrefixes = () => MIGRATED_MODULES.map((Module) => Module.basePath);

export const createRegistry = () =>
  new ModuleRegistry(MIGRATED_MODULES.map((Module) => new Module()));

export default createRegistry;
