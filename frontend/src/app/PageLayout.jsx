import { useLocation, useNavigate, matchPath } from "react-router-dom";
import RouteOutlet from "@app/RouteOutlet";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Header from "@app/layout/navbar";
import Navbar1 from "@app/layout/navbar1";
import Footer from "@app/layout/Footer";
import { api } from "@shared/api/client";
import { refreshTokenThunk, logoutThunk } from "@features/auth/store/authSlice";
import Feedback from "@features/feedback/components/FeedbackForm";
import { captureReferralFromUrl } from "@features/referral/referral";
import { captureSharedProfileFromUrl } from "@features/share-link/sharedProfileRef";
import CookieConsentGate from "@shared/consent/CookieConsentGate";

// ─── Route Config ────────────────────────────────────────────────────────────

// Every entry here is a path App.jsx actually registers. It used to carry a
// dozen that it never did — /yourBusiness, /services, /pricing, /nannShare,
// /tutor, /swim, /music, /communitySign — which cost nothing at runtime and a
// great deal when reading: there is no way to tell a live route from a ghost,
// so the list stops being usable as a map of the app.
const ROUTES = {
  withHeaderAndFooter: [
    "/", "/families", "/jobSeekers", "/terms-and-conditions",
    "/resources", "/resources/:slug",
  ],
  withHeaderOnly: [
    "/joinNow", "/login", "/forgetPass", "/hire", "/waitlist",
    "/caregiver/nannyshare",
    "/find-nanny-share",
    "/find-nanny-share/family/:id",
    "/caregiver/nanny-share/looking-for-another-family/:id",
    "/caregiver/nanny-share/looking-for-nanny-share-job/:id",
    "/find-nanny-share/nanny-share-questionnaire/:id",
    "/find-nanny-share/nanny-share-questionnaire/fulltime-care/:id",
    "/find-nanny-share/nanny-share-questionnaire/parttime-care/:id",
  ],
  withNothing: [
    "/events", "/nanny-share/:city", "/nanny-share/profile/:id",
    // Resource Center pages render their own chrome (hub: header + footer;
    // download: a print-friendly toolbar), so the layout adds nothing.
    "/nanny-share-resources", "/nanny-share-resources/:slug",
  ],
  // Standalone pages reached from a link in one of our emails. The recipient may
  // have no session and no other way into the site, so they get the full chrome
  // — neither renders a header or footer of its own.
  emailLanding: ["/unsubscribe", "/reset-password"],
  // A member's shared nanny share. Same chrome as the email landings and for
  // the same reason — the reader followed a link out of a Facebook group and
  // has no other way around the site — but listed separately because it isn't
  // one of ours, it's one a member sent.
  sharedProfile: ["/share/:token"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Matches a pathname against a route pattern that may contain :param segments */
function matchesRoute(pathname, routePattern) {
  return matchPath({ path: routePattern, end: true }, pathname);
}

function matchesAnyRoute(pathname, routeList) {
  return routeList.some((route) => matchesRoute(pathname, route));
}

// ─── Token Refresh Hook ──────────────────────────────────────────────────────

function useTokenRefresh() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { accessTokenExpiry } = useSelector((state) => state.auth);

  // useNavigate() hands back a new function on every location change, so an
  // effect that captured it (or pathname) re-runs on every navigation. The 401
  // interceptor below must not do that — see the comment where it's registered —
  // so the redirect reads both through a ref that each render keeps current.
  const routeRef = useRef({ navigate, pathname });
  routeRef.current = { navigate, pathname };

  // `logoutThunk` rather than the bare `logout` action: the refresh cookie is
  // still in the browser at this point, and only the server can remove it. It
  // is a dead credential — the refresh that brought us here is what 401'd — but
  // leaving it there means it is attached to every /auth request from now on,
  // and the stored session sits in the database until it expires.
  const handleAuthFailure = async () => {
    const { navigate: go, pathname: from } = routeRef.current;
    await dispatch(logoutThunk());
    go("/login", { state: { from }, replace: true });
  };

  const tryRefreshToken = async () => {
    try {
      const { status } = await dispatch(refreshTokenThunk()).unwrap();
      if (status !== 200) await handleAuthFailure();
      return status === 200;
    } catch {
      await handleAuthFailure();
      return false;
    }
  };

  // On mount: refresh token immediately if already expired
  useEffect(() => {
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = accessTokenExpiry && currentTime >= accessTokenExpiry;
    if (isExpired) tryRefreshToken();
  }, [accessTokenExpiry]);

  // Schedule a proactive refresh 60 seconds before expiry
  useEffect(() => {
    if (!accessTokenExpiry) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = accessTokenExpiry - currentTime;
    const shouldSchedule = secondsUntilExpiry > 60;

    if (!shouldSchedule) return;

    const refreshAfterMs = (secondsUntilExpiry - 60) * 1000;
    const timeout = setTimeout(async () => {
      const success = await tryRefreshToken();
      // Re-scheduling is handled by the accessTokenExpiry change after a successful refresh
    }, refreshAfterMs);

    return () => clearTimeout(timeout);
  }, [accessTokenExpiry]);

  // Intercept 401 API responses and attempt a token refresh.
  //
  // Registered once for the session, not per navigation. Keyed on pathname (as
  // it was), the cleanup ejected the interceptor on every route change and the
  // replacement only went back on in PageLayout's effect — which React runs
  // *after* the effects of everything below it. So during the commit that mounts
  // a page, its children's own mount-time requests had no 401 handling at all:
  // one unauthorized response there was final, with no refresh and no retry.
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const is401 = error.response?.status === 401;
        const notRetried = !originalRequest._retry;

        if (is401 && notRetried) {
          originalRequest._retry = true;
          const success = await tryRefreshToken();
          if (success) return api(originalRequest);
        }

        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Layout Sections ─────────────────────────────────────────────────────────

/**
 * The signed-in shell, for both member types.
 *
 * There was a FamilyLayout and a NannyLayout. The second keyed off paths under
 * `/nanny/*` — `/nanny/message`, `/nanny/edit`, `/nanny/setting`, `/nanny/pricing`
 * — and App.jsx registers no such routes: every member screen lives under
 * `/dashboard`. So NannyLayout could only ever render for a URL that then fell
 * through to the "*" redirect, and one layout served both types in practice.
 * The two are now one, which is also the truth of the product: families and
 * caregivers see the same dashboard chrome.
 */
function UserLayout({ pathname }) {
  const isPostingJob = pathname.startsWith("/dashboard/post-a-nannyShare");
  const isMessaging = pathname.startsWith("/dashboard/message");
  const isPricing = pathname.startsWith("/dashboard/pricing");
  const isDetails = pathname.startsWith("/dashboard/nannyShareView/");
  const isCompletProfilePage = pathname.startsWith("/dashboard/complete-profile");
  const isShareManagement = pathname.startsWith("/dashboard/share-management");

  const noFeedback = isPostingJob || isMessaging || isDetails || isCompletProfilePage;
  const noNavbar = isCompletProfilePage;
  const noPadding = isPostingJob || isPricing || isMessaging || isShareManagement;

  // Messaging owns the viewport: the thread list and the conversation scroll
  // independently inside it, so the page itself must not scroll.
  if (isMessaging) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar1 nanny={true} />
        <div className="flex-1 min-h-0 overflow-hidden bg-white">
          <RouteOutlet />
        </div>
      </div>
    );
  }

  return (
    <>
      {noNavbar ? <Header join={true} /> : <Navbar1 nanny={true} />}
      <div className={noPadding ? "bg-white" : "py-8"}>
        <RouteOutlet />
      </div>
      {/* Footer intentionally omitted for all /dashboard routes */}
      {/* {!noFeedback && <Feedback />} */}
    </>
  );
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

/* Picks the header/footer combination for a path. Split out from PageLayout
 * below purely so that anything which must appear on EVERY page is written
 * once: this function has six separate returns, and a component added to them
 * one at a time is a component that will be missing from the seventh. */
function PageChrome() {
  const { pathname, search } = useLocation();

  useTokenRefresh();

  // Park any ?ref= code from a caregiver's referral link. It sits here rather
  // than on a single landing page because a shared link can point at anything —
  // the home page, a city page, a job form — and the signup that redeems it
  // usually happens several screens later.
  //
  // The ?share= token from a shared profile's CTA rides along the same way, and
  // for the same reason: the signup that redeems it is several screens past the
  // page that carried it.
  useEffect(() => {
    captureReferralFromUrl(search);
    captureSharedProfileFromUrl(search);
  }, [search]);

  if (matchesAnyRoute(pathname, ROUTES.withNothing)) {
    return <RouteOutlet />;
  }

  if (matchesAnyRoute(pathname, ROUTES.withHeaderAndFooter)) {
    return (
      <>
        {pathname.startsWith("/terms-and-conditions") && <Header join={true} />}
        <RouteOutlet />
        <Footer />
      </>
    );
  }

  if (matchesAnyRoute(pathname, ROUTES.withHeaderOnly)) {
    return (
      <>
        {!pathname.startsWith("/login") && <Header join={true} />}
        <RouteOutlet />
      </>
    );
  }

  if (matchesAnyRoute(pathname, [...ROUTES.emailLanding, ...ROUTES.sharedProfile])) {
    return (
      <>
        <Header join={true} />
        <RouteOutlet />
        <Footer />
      </>
    );
  }

  if (pathname.startsWith("/dashboard")) {
    return <UserLayout pathname={pathname} />;
  }

  // A path that App.jsx routes but no list above claims used to land here and get
  // `null` back. PageLayout is the parent route element, so returning null means
  // its <RouteOutlet /> never mounts: the page comes up blank on a 200, with nothing in
  // the console to explain it. That is how /unsubscribe and /reset-password —
  // the landing pages our emails link to — shipped broken.
  // Degrade to the standard chrome instead, so the next missed registration is a
  // page with a header rather than a white screen.
  return (
    <>
      <Header join={true} />
      <RouteOutlet />
      <Footer />
    </>
  );
}

/**
 * The layout every route renders inside, plus the site-wide furniture.
 *
 * The cookie consent gate sits here rather than in `App.jsx` because the
 * banner it loads renders a react-router <Link> to the cookie policy, which
 * needs the router's context — and PageLayout is the parent route element, so
 * it is the outermost place that context exists. The gate itself is a storage
 * read and renders nothing for a visitor who has already answered.
 */
export default function PageLayout() {
  return (
    <>
      <PageChrome />
      <CookieConsentGate />
    </>
  );
}
