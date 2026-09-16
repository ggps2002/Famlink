#!/usr/bin/env node
/**
 * Generates the move manifest for the feature migration.
 *
 *   node scripts/build-manifest.mjs > manifests/features.json
 *
 * Rules are ordered and first-match-wins, so a specific file can be pulled out
 * of a directory rule by listing it above that rule. Each rule is either:
 *
 *   [exact/source/path.jsx, exact/destination/path.jsx]
 *   [source/directory/,     destination/directory/]      keeps the substructure
 *
 * Written as rules rather than 250 hand-typed pairs so the intent stays legible
 * — the point is which feature owns what, and that is lost in a wall of paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const C = "src/Components";
const N = "src/NewComponents";
const F = "src/features";

const RULES = [
  // ── auth ───────────────────────────────────────────────────────────────────
  [`${C}/Login/login.jsx`, `${F}/auth/pages/Login.jsx`],
  [`${C}/JoinNow/joinNow.jsx`, `${F}/auth/pages/JoinNow.jsx`],
  [`${C}/JoinNow/Job.jsx`, `${F}/auth/pages/JobSeekerSignup.jsx`],
  [`${C}/Forget-Password/forgetPass.jsx`, `${F}/auth/pages/ForgotPassword.jsx`],
  [`${C}/Forget-Password/resetPassword.jsx`, `${F}/auth/pages/ResetPassword.jsx`],
  [`${C}/subComponents/PhoneVerification.jsx`, `${F}/auth/components/PhoneVerification.jsx`],
  [`${N}/VerifyEmailDialogBox.jsx`, `${F}/auth/components/VerifyEmailDialogBox.jsx`],

  // ── hire (the public "find a nanny" lead form at /hire) ────────────────────
  [`${C}/JoinNow/NewHire.jsx`, `${F}/hire/pages/HireForm.jsx`],
  [`${C}/subComponents/Hire/`, `${F}/hire/components/`],

  // ── jobs ───────────────────────────────────────────────────────────────────
  [`${C}/LoginAsFamily/PostAJob/`, `${F}/jobs/post/`],
  [`${C}/LoginAsFamily/JobListing/job-listing.jsx`, `${F}/jobs/pages/JobListing.jsx`],
  [`${C}/LoginAsFamily/JobListing/job-listing-view.jsx`, `${F}/jobs/pages/JobListingView.jsx`],
  [`${C}/LoginAsNanny/jobDescription.jsx`, `${F}/jobs/pages/JobDescription.jsx`],
  [`${C}/LoginAsNanny/application.jsx`, `${F}/jobs/pages/Application.jsx`],
  [`${C}/LoginAsNanny/SubComponents/paginationForApplication.jsx`, `${F}/jobs/components/ApplicationPagination.jsx`],
  [`${C}/subComponents/Job/MultipleStep/`, `${F}/jobs/types/`],

  // ── chat ───────────────────────────────────────────────────────────────────
  [`${C}/LoginAsFamily/Message.jsx`, `${F}/chat/pages/FamilyMessages.jsx`],
  [`${C}/LoginAsNanny/Message.jsx`, `${F}/chat/pages/NannyMessages.jsx`],
  [`${C}/LoginAsFamily/chatInterface.jsx`, `${F}/chat/components/ChatInterface.jsx`],
  [`${C}/subComponents/chatView.jsx`, `${F}/chat/components/ChatView.jsx`],
  [`${N}/ChatInterfaceRequests.jsx`, `${F}/chat/components/ChatInterfaceRequests.jsx`],

  // ── booking ────────────────────────────────────────────────────────────────
  [`${C}/LoginAsFamily/Booking/booking.jsx`, `${F}/booking/pages/FamilyBookings.jsx`],
  [`${C}/LoginAsNanny/booking.jsx`, `${F}/booking/pages/NannyBookings.jsx`],
  [`${C}/LoginAsFamily/Booking/`, `${F}/booking/components/`],

  // ── matching ───────────────────────────────────────────────────────────────
  [`${N}/MatchRequests.jsx`, `${F}/matching/pages/MatchRequests.jsx`],
  [`${N}/IncomingRequests.jsx`, `${F}/matching/components/IncomingRequests.jsx`],
  [`${N}/OutgoingRequests.jsx`, `${F}/matching/components/OutgoingRequests.jsx`],
  [`${N}/DeclinedRequests.jsx`, `${F}/matching/components/DeclinedRequests.jsx`],
  [`${N}/MatchRequestFormModal.jsx`, `${F}/matching/components/MatchRequestFormModal.jsx`],
  [`${N}/MatchSuccessModal.jsx`, `${F}/matching/components/MatchSuccessModal.jsx`],
  [`${N}/RejectMatchModal.jsx`, `${F}/matching/components/RejectMatchModal.jsx`],
  [`${N}/ReportMatchModal.jsx`, `${F}/matching/components/ReportMatchModal.jsx`],
  [`${N}/BlockMatchModal.jsx`, `${F}/matching/components/BlockMatchModal.jsx`],
  [`${N}/RequestMatchDenied.jsx`, `${F}/matching/components/RequestMatchDenied.jsx`],
  [`${N}/CompleteProfileModal.jsx`, `${F}/matching/components/CompleteProfileModal.jsx`],

  // ── onboarding (questionnaire flows, before a profile exists) ──────────────
  [`${N}/Caregivers/NannyShareOnboarding/LookingForFamily/`, `${F}/onboarding/caregiver-share/`],
  [`${N}/Caregivers/NannyShareOnboarding/LookingForJob/`, `${F}/onboarding/caregiver-job/`],
  [`${N}/Caregivers/Onboarding/`, `${F}/onboarding/components/`],
  [`${N}/NannyShare/Onboarding/`, `${F}/onboarding/family/`],
  [`${N}/Caregivers/ChooseNannyShare.jsx`, `${F}/onboarding/pages/ChooseNannyShare.jsx`],

  // ── nanny-share (the core domain) ──────────────────────────────────────────
  [`${N}/NannyShare/PostANannyShare/`, `${F}/nanny-share/post/`],
  [`${N}/NannyShare/Profile/`, `${F}/nanny-share/profile/`],
  [`${N}/NannyShare/Search/`, `${F}/nanny-share/search/`],
  [`${N}/NannyShare/NannyShare.jsx`, `${F}/nanny-share/pages/NannyShareLanding.jsx`],
  [`${N}/NannyShare/`, `${F}/nanny-share/landing/`],
  [`${N}/NannyShareProfile/`, `${F}/nanny-share/profile-views/`],
  [`${N}/NannyShareCard.jsx`, `${F}/nanny-share/components/NannyShareCard.jsx`],
  [`${N}/NannyShareMatchForm.jsx`, `${F}/nanny-share/pages/NannyShareMatchForm.jsx`],
  [`${C}/LoginAsFamily/PostANannyShare/postANannyShare.jsx`, `${F}/nanny-share/post/PostANannyShare.jsx`],
  [`${C}/LoginAsFamily/NannyShare/ProfileList.jsx`, `${F}/nanny-share/browse/FamilyProfileList.jsx`],
  [`${C}/LoginAsFamily/NannyShare/FilterSlide.jsx`, `${F}/nanny-share/browse/FamilyFilterSlide.jsx`],
  [`${C}/LoginAsNanny/Profile/profileList.jsx`, `${F}/nanny-share/browse/NannyProfileList.jsx`],
  [`${C}/LoginAsNanny/Profile/filterSlide.jsx`, `${F}/nanny-share/browse/NannyFilterSlide.jsx`],
  [`${C}/LoginAsFamily/nannyShare.jsx`, `${F}/nanny-share/pages/FamilyNannyShare.jsx`],
  [`${C}/subComponents/profileCard.jsx`, `${F}/nanny-share/components/profileCard.jsx`],
  [`${N}/Home/FamilyProfile/ProfileFamily.jsx`, `${F}/nanny-share/profile-views/ProfileFamily.jsx`],

  // ── resources (lead-magnet hub + articles) ─────────────────────────────────
  [`${N}/ResourceCenter/`, `${F}/resources/`],
  [`${N}/Home/ArticlePage.jsx`, `${F}/resources/pages/ArticlePage.jsx`],
  [`${N}/Home/ResourcesPage.jsx`, `${F}/resources/pages/ResourcesPage.jsx`],
  [`${N}/Home/articleProse.js`, `${F}/resources/articleProse.js`],
  [`${N}/CommunityResourceCard.jsx`, `${F}/resources/components/CommunityResourceCard.jsx`],

  // ── share-link (the public /share/:token page) ─────────────────────────────
  [`${N}/ShareProfile/`, `${F}/share-link/`],
  [`${N}/ShareManagement.jsx`, `${F}/share-link/pages/ShareManagement.jsx`],

  // ── referral / subscription / waitlist ─────────────────────────────────────
  [`${N}/ReferAFriendModal.jsx`, `${F}/referral/components/ReferAFriendModal.jsx`],
  [`${N}/ReferAFriendSettings.jsx`, `${F}/referral/components/ReferAFriendSettings.jsx`],
  [`${N}/ReferralRewardModal.jsx`, `${F}/referral/components/ReferralRewardModal.jsx`],
  [`${N}/SubscriptionModal.jsx`, `${F}/subscription/components/SubscriptionModal.jsx`],
  [`${N}/SubscriptionSettings.jsx`, `${F}/subscription/components/SubscriptionSettings.jsx`],
  [`${N}/PostCheckoutDialog.jsx`, `${F}/subscription/components/PostCheckoutDialog.jsx`],
  [`${C}/subComponents/Billings.jsx`, `${F}/subscription/components/Billings.jsx`],
  [`${C}/subComponents/modalPayment.jsx`, `${F}/subscription/components/ModalPayment.jsx`],
  [`${N}/Waitlist.jsx`, `${F}/waitlist/pages/WaitlistForm.jsx`],

  // ── feedback / legal ───────────────────────────────────────────────────────
  [`${C}/Feedback/feedbackPage.jsx`, `${F}/feedback/pages/FeedbackPage.jsx`],
  [`${N}/Feedback.jsx`, `${F}/feedback/components/FeedbackForm.jsx`],
  [`${C}/Contact/contact.jsx`, `${F}/feedback/pages/Contact.jsx`],
  [`${C}/Authority/Terms&Condition.jsx`, `${F}/legal/pages/TermsAndConditions.jsx`],
  [`${N}/TermsNotice.jsx`, `${F}/legal/components/TermsNotice.jsx`],
  [`${C}/Preferences/unsubscribe.jsx`, `${F}/legal/pages/Unsubscribe.jsx`],

  // ── marketing (public landing pages) ───────────────────────────────────────
  [`${N}/Home/Home.jsx`, `${F}/marketing/pages/FamiliesHome.jsx`],
  [`${N}/Home/`, `${F}/marketing/home/`],
  [`${N}/Caregivers/Caregivers.jsx`, `${F}/marketing/pages/Caregivers.jsx`],
  [`${N}/Caregivers/`, `${F}/marketing/caregivers/`],
  [`${N}/Events.jsx`, `${F}/marketing/pages/Events.jsx`],
  [`${N}/TestimonialCard.jsx`, `${F}/marketing/components/TestimonialCard.jsx`],
  [`${N}/MetricCard.jsx`, `${F}/marketing/components/MetricCard.jsx`],
  [`${N}/ServicesCard.jsx`, `${F}/marketing/components/ServicesCard.jsx`],

  // ── dashboard (the signed-in shell and its own pages) ──────────────────────
  [`${C}/LoginAsNanny/nanny.jsx`, `${F}/dashboard/pages/DashboardShell.jsx`],
  [`${C}/LoginAsFamily/family.jsx`, `${F}/dashboard/pages/BrowseCaregivers.jsx`],
  [`${C}/LoginAsFamily/setting.jsx`, `${F}/dashboard/pages/Settings.jsx`],
  [`${C}/LoginAsFamily/editProfile.jsx`, `${F}/dashboard/pages/EditFamilyProfile.jsx`],
  [`${C}/LoginAsNanny/editProfile.jsx`, `${F}/dashboard/pages/EditNannyProfile.jsx`],
  [`${C}/LoginAsFamily/favorite.jsx`, `${F}/dashboard/pages/FamilyFavorites.jsx`],
  [`${C}/LoginAsNanny/favourite.jsx`, `${F}/dashboard/pages/NannyFavorites.jsx`],
  [`${C}/LoginAsFamily/profileNanny.jsx`, `${F}/dashboard/pages/NannyProfile.jsx`],
  [`${C}/subComponents/favoriteCard.jsx`, `${F}/dashboard/components/FavoriteCard.jsx`],
  [`${C}/LoginAsFamily/subcomponents/`, `${F}/dashboard/components/`],
  // Not shared UI despite the generic names: modal.jsx is 1,547 lines of
  // settings and booking dialogs that dispatch thunks and open a socket, and
  // filter.jsx is the caregiver-browse filter. Both are imported only by
  // dashboard screens.
  [`${C}/subComponents/modal.jsx`, `${F}/dashboard/components/Modals.jsx`],
  [`${C}/subComponents/filter.jsx`, `${F}/dashboard/components/Filter.jsx`],

  // ── app chrome ─────────────────────────────────────────────────────────────
  [`${C}/Navbars/`, `src/app/layout/`],
  [`${N}/Footer/`, `src/app/layout/`],
  [`${N}/Header.jsx`, `src/app/layout/Header.jsx`],
  [`${N}/UserAvatar.jsx`, `src/app/layout/UserAvatar.jsx`], // only the navbar uses it
  [`${N}/SEOMetaData.jsx`, `src/shared/seo/SEOMetaData.jsx`],

  // ── genuinely shared UI and helpers ────────────────────────────────────────
  // Placed here on the evidence of who imports them: each is pulled in from
  // three or more unrelated features. `modal.jsx` and `filter.jsx` looked like
  // members of this group by name and are not — see the dashboard rules below.
  [`${C}/subComponents/input.jsx`, `src/shared/ui/Input.jsx`], // 20 importers
  [`${C}/subComponents/loader.jsx`, `src/shared/ui/Loader.jsx`], // 22
  [`${C}/subComponents/rate.jsx`, `src/shared/ui/Rate.jsx`], // 5
  [`${C}/subComponents/LanguageSelector.jsx`, `src/shared/ui/LanguageSelector.jsx`], // 4
  [`${C}/subComponents/toCamelStr.jsx`, `src/shared/lib/toCamelCase.js`], // 39

  // ── Redux slices, relocated as-is ──────────────────────────────────────────
  // Same reducers, same action names, same state shape — only the file moves,
  // into the feature whose screens read it. Renamed .jsx to .js because none of
  // them contains JSX.
  [`${C}/Redux/authSlice.jsx`, `${F}/auth/store/authSlice.js`],
  [`${C}/Redux/forgetPassword.jsx`, `${F}/auth/store/forgetPasswordSlice.js`],
  [`${C}/Redux/smsSlice.jsx`, `${F}/auth/store/smsSlice.js`],
  [`${C}/Redux/emailSlice.jsx`, `${F}/auth/store/emailSlice.js`],
  [`${C}/Redux/setAddtional.jsx`, `${F}/auth/store/additionalServicesSlice.js`],
  [`${C}/Redux/setFamilyExp.jsx`, `${F}/auth/store/familyExperienceSlice.js`],

  [`${C}/Redux/chatSlice.jsx`, `${F}/chat/store/chatSlice.js`],
  [`${C}/Redux/selectedContactSlice.jsx`, `${F}/chat/store/selectedContactSlice.js`],

  [`${C}/Redux/matchSlice.jsx`, `${F}/matching/store/matchSlice.js`],
  [`${C}/Redux/reportSlice.jsx`, `${F}/matching/store/reportSlice.js`],

  [`${C}/Redux/nannyShareSlice.jsx`, `${F}/nanny-share/store/nannyShareSlice.js`],
  [`${C}/Redux/postJobSlice.jsx`, `${F}/jobs/store/postJobSlice.js`],
  [`${C}/Redux/bookHireSlice.jsx`, `${F}/hire/store/bookHireSlice.js`],
  [`${C}/Redux/blogsSlice.jsx`, `${F}/resources/store/blogsSlice.js`],
  [`${C}/Redux/referralSlice.jsx`, `${F}/referral/store/referralSlice.js`],
  [`${C}/Redux/cardSlice.jsx`, `${F}/subscription/store/cardSlice.js`],
  [`${C}/Redux/shareProfileSlice.jsx`, `${F}/share-link/store/shareProfileSlice.js`],
  [`${C}/Redux/notificationSlice.jsx`, `${F}/notifications/store/notificationSlice.js`],

  [`${C}/Redux/favouriteSlice.jsx`, `${F}/dashboard/store/favouriteSlice.js`],
  [`${C}/Redux/nannyData.jsx`, `${F}/dashboard/store/nannyDataSlice.js`],
  [`${C}/Redux/familyData.jsx`, `${F}/dashboard/store/familyDataSlice.js`],
  [`${C}/Redux/updateSlice.jsx`, `${F}/dashboard/store/updateSlice.js`],
  [`${C}/Redux/review.jsx`, `${F}/dashboard/store/reviewSlice.js`],

  // The booking request lifecycle: one slice per state a request can be in.
  [`${C}/Redux/requestedData.jsx`, `${F}/booking/store/requestedDataSlice.js`],
  [`${C}/Redux/acceptedRequsterData.jsx`, `${F}/booking/store/acceptedRequesterSlice.js`],
  [`${C}/Redux/completedRequestData.jsx`, `${F}/booking/store/completedRequestSlice.js`],
  [`${C}/Redux/cancelRequsterData.jsx`, `${F}/booking/store/cancelledRequestSlice.js`],
  [`${C}/Redux/getWithdrawRequestData.jsx`, `${F}/booking/store/withdrawRequestSlice.js`],
  [`${C}/Redux/fetchOtherReq.jsx`, `${F}/booking/store/otherRequestsSlice.js`],

  // The multi-step form buffer every questionnaire writes into — onboarding,
  // post-a-share and each job type. It belongs to no single feature.
  [`${C}/Redux/formValue.jsx`, `src/shared/store/formValueSlice.js`],
];

const walk = (dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs
        .readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path
            .relative(ROOT, path.join(entry.parentPath ?? entry.path, entry.name))
            .split(path.sep)
            .join("/")
        )
    : [];

const sources = [...walk(C), ...walk(N)].sort();
const manifest = {};
const unmatched = [];

for (const file of sources) {
  const rule = RULES.find(([from]) =>
    from.endsWith("/") ? file.startsWith(from) : file === from
  );

  if (!rule) {
    unmatched.push(file);
    continue;
  }

  const [from, to] = rule;
  manifest[file] = from.endsWith("/") ? to + file.slice(from.length) : to;
}

if (unmatched.length) {
  console.error(`no rule for ${unmatched.length} file(s):`);
  for (const file of unmatched) console.error(`  ${file}`);
  process.exit(1);
}

const destinations = new Map();
for (const [from, to] of Object.entries(manifest)) {
  if (destinations.has(to)) {
    console.error(`two sources map to ${to}:\n  ${destinations.get(to)}\n  ${from}`);
    process.exit(1);
  }
  destinations.set(to, from);
}

console.log(JSON.stringify(manifest, null, 2));
