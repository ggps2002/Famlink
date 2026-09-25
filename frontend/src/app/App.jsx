import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  Navigate,
  useLocation,
  matchPath,
} from "react-router-dom";
import { useSelector } from "react-redux";
import { useEffect, useState, lazy } from "react";
import PageLayout from "@app/PageLayout";
import { useNotifications } from "@features/notifications/useNotification";
import lazyNamed from "@app/lazyNamed";

// "/" is the commonest cold entry, so it is imported eagerly: splitting it would
// put a spinner in front of the page most first-time visitors land on, and cost
// a second round trip before anything paints. Every other screen below is a
// separate chunk, fetched the first time someone navigates to it.
import NannyShare from "@features/nanny-share/pages/NannyShareLanding";


const ForgetPass = lazy(() => import("@features/auth/pages/ForgotPassword"));
const JoinNow = lazy(() => import("@features/auth/pages/JoinNow"));
const Login = lazy(() => import("@features/auth/pages/Login"));
const ResetPassword = lazy(() => import("@features/auth/pages/ResetPassword"));
const Message = lazy(() => import("@features/chat/pages/FamilyMessages"));
const Family = lazy(() => import("@features/dashboard/pages/BrowseCaregivers"));
const Nanny = lazy(() => import("@features/dashboard/pages/DashboardShell"));
const EditProfile = lazy(() => import("@features/dashboard/pages/EditFamilyProfile"));
const EditProfileNanny = lazy(() => import("@features/dashboard/pages/EditNannyProfile"));
const Favorites = lazy(() => import("@features/dashboard/pages/FamilyFavorites"));
const ProfileNanny = lazy(() => import("@features/dashboard/pages/NannyProfile"));
const Setting = lazy(() => import("@features/dashboard/pages/Settings"));
const JobDescription = lazy(() => import("@features/jobs/pages/JobDescription"));
const JobListing = lazy(() => import("@features/jobs/pages/JobListing"));
const JobListingView = lazy(() => import("@features/jobs/pages/JobListingView"));
const PostAJob = lazy(() => import("@features/jobs/post/postAJob"));
const TermsAndConditions = lazy(() => import("@features/legal/pages/TermsAndConditions"));
const Unsubscribe = lazy(() => import("@features/legal/pages/Unsubscribe"));
const Caregivers = lazy(() => import("@features/marketing/pages/Caregivers"));
const Events = lazy(() => import("@features/marketing/pages/Events"));
const NewHome = lazy(() => import("@features/marketing/pages/FamiliesHome"));
const MatchRequests = lazy(() => import("@features/matching/pages/MatchRequests"));
const NannyShareMatchForm = lazy(() => import("@features/nanny-share/pages/NannyShareMatchForm"));
const PostANannyShare = lazyNamed(() => import("@features/nanny-share/post/PostANannyShare"), "PostANannyShare");
const FullTime = lazyNamed(() => import("@features/nanny-share/post/Type/FullTime"), "FullTime");
const PartTime = lazyNamed(() => import("@features/nanny-share/post/Type/PartTime"), "PartTime");
const FamilyProfileView = lazy(() => import("@features/nanny-share/profile-views/FamilyProfileView"));
const NannyProfileView = lazy(() => import("@features/nanny-share/profile-views/NannyProfileView"));
const ProfileFamily = lazy(() => import("@features/nanny-share/profile-views/ProfileFamily"));
const EditNannyShare = lazy(() => import("@features/nanny-share/profile/EditNannyShare"));
const NannyShareDetails = lazy(() => import("@features/nanny-share/profile/NannyShareDetails"));
const NannyShareCityPage = lazy(() => import("@features/nanny-share/search/NannyShareCityPage"));
const ViewProfileDetails = lazy(() => import("@features/nanny-share/search/ViewProfile"));
const JobQuestionnaire = lazyNamed(() => import("@features/onboarding/caregiver-job/JobQuestionnaire"), "JobQuestionnaire");
const JobScreen4 = lazyNamed(() => import("@features/onboarding/caregiver-job/Screen4"), "Screen4");
const FamilyScreen4 = lazyNamed(() => import("@features/onboarding/caregiver-share/Screen4"), "Screen4");
const ShareQuestionnaire = lazyNamed(() => import("@features/onboarding/caregiver-share/ShareQuestionnaire"), "ShareQuestionnaire");
const FamilyOnboarding = lazyNamed(() => import("@features/onboarding/family/FamilyOnboarding"), "FamilyOnboarding");
const ChooseNannyShare = lazy(() => import("@features/onboarding/pages/ChooseNannyShare"));
const ArticlePage = lazy(() => import("@features/resources/pages/ArticlePage"));
const ResourcesPage = lazy(() => import("@features/resources/pages/ResourcesPage"));
const ResourceCenter = lazy(() => import("@features/resources/ResourceCenter"));
const ResourceDownloadPage = lazy(() => import("@features/resources/ResourceDownloadPage"));
const ShareManagement = lazy(() => import("@features/share-link/pages/ShareManagement"));
const SharedProfilePage = lazy(() => import("@features/share-link/SharedProfilePage"));
const WaitlistForm = lazy(() => import("@features/waitlist/pages/WaitlistForm"));
const NotFound = lazy(() => import("@features/marketing/pages/NotFound"));

const OnboardingCompleteProfile = () => {
  const { user } = useSelector((s) => s.auth);
  // The "Complete your profile" email links every recipient here regardless of
  // type, so this route resolves the right onboarding flow itself. Any flow that
  // needs a recordId gets it from the signed-in user's own sheetId rather than
  // the URL, since the email link carries no query params.
  const recordId = user?.sheetId;
  if (user?.type === "Parents") {
    return <PostANannyShare recordId={recordId} />;
  }
  if (user?.goal === "Nanny adding a share") {
    return <FamilyScreen4 />;
  }
  return <JobScreen4 recordId={recordId} />;
};

// Catch-all for any path the router doesn't match. Most of these are simply
// wrong — a typo, an old link, a removed profile — and get the 404 page. Two
// kinds are real pages the visitor just can't open in their current state, and
// those keep redirecting:
//
//  • A logged-out visitor on a /dashboard/* page (e.g. a "View Request" button
//    in an email opened without a session) goes to login with the intended path
//    in ?redirect=, so signing in drops them exactly where the email meant.
//  • A signed-in member on a logged-out-only page (/login, /joinNow, the signup
//    questionnaires) goes to their dashboard — they're past that step.
function AuthFallback({ isAuthed, hasSession, loggedOutPaths = [] }) {
  const { pathname, search } = useLocation();
  if (!hasSession && pathname.startsWith("/dashboard")) {
    const target = encodeURIComponent(pathname + search);
    return <Navigate to={`/login?redirect=${target}`} replace />;
  }
  const isLoggedOutOnly = loggedOutPaths.some((path) => matchPath(path, pathname));
  if (hasSession && isLoggedOutOnly) {
    return <Navigate to={isAuthed ? "/dashboard" : "/"} replace />;
  }
  return <NotFound />;
}

function App() {
  const { user } = useSelector((s) => s.auth); // Fetching user from Redux state
  const [loading, setLoading] = useState(true);
  useNotifications({ userId: user._id });
  useEffect(() => {
    // Simulate an async operation to fetch user data
    if (user) {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>; // Show loading spinner or fallback while user loads
  }

  // Pages only a logged-out visitor can open. Their paths are also what the
  // "*" fallback checks to send a signed-in member to the dashboard instead of
  // the 404 page, so both read from this one list.
  const loggedOutRoutes = [
    { path: "/login", element: <Login /> },
    { path: "/forgetPass", element: <ForgetPass /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/nanny-share/profile/:id", element: <ViewProfileDetails /> },
    { path: "/events", element: <Events /> },
    { path: "/families", element: <NewHome /> },
    { path: "/joinNow", element: <JoinNow /> },
    { path: "/caregiver/nannyshare", element: <ChooseNannyShare /> },
    { path: "/find-nanny-share/family/:id", element: <FamilyOnboarding /> },
    { path: "/caregiver/nanny-share/looking-for-nanny-share-job/:id", element: <JobQuestionnaire /> },
    { path: "/caregiver/nanny-share/looking-for-another-family/:id", element: <ShareQuestionnaire /> },
    { path: "/find-nanny-share/nanny-share-questionnaire/:id", element: <PostANannyShare login={false} /> },
    { path: "/find-nanny-share/nanny-share-questionnaire/fulltime-care/:id", element: <FullTime login={false} /> },
    { path: "/find-nanny-share/nanny-share-questionnaire/parttime-care/:id", element: <PartTime login={false} /> },
  ];

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route element={<PageLayout />}>
        {/* Public Blog / Resources Routes */}
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:slug" element={<ArticlePage />} />

        {/* Nanny Share Resource Center (lead-magnet hub + printable downloads).
            Public and outside the logged-out block so it resolves for everyone,
            and reachable from the link in the resource-download email. */}
        <Route path="/nanny-share-resources" element={<ResourceCenter />} />
        <Route path="/nanny-share-resources/:slug" element={<ResourceDownloadPage />} />

        {/* A member's shared nanny share — the privacy-safe public page behind
            the "Share Profile" button. Outside the logged-out block because it
            gets pasted into group chats where members and strangers both click
            it: a signed-in reader gets a CTA straight into the real profile,
            and without this they'd hit the "*" fallback and bounce to their
            dashboard instead. */}
        <Route path="/share/:token" element={<SharedProfilePage />} />

        {/* Programmatic city/neighborhood landing pages (with the coverage map).
            Outside the logged-out block so members can open them too — e.g. from
            the footer's "Find Nanny Shares" links — instead of being bounced to
            /dashboard by the "*" fallback. */}
        <Route path="/nanny-share/:city" element={<NannyShareCityPage />} />

        {/* The unsubscribe landing, linked from the footer of every email we
            send. Registered outside the logged-out block so it resolves whether
            or not there's a session — CAN-SPAM wants one click, no login. */}
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        {/* Also linked from automated emails, so they must resolve with or
            without a session. The footer Terms link ships in every email (all of
            which go to logged-in users), and the "Start Browsing / Browse
            Families" CTA in 03/13/16 targets logged-in members — if these lived
            only in the logged-out block below they'd fall through to the "*"
            redirect and bounce the recipient to /dashboard. */}
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/find-nanny-share" element={<NannyShareMatchForm />} />

        {/* Outside the logged-out block for the same reason /nanny-share/:city
            is: the San Francisco page is the one city page that still pitches
            the waitlist (NannyShare/Search/Hero.jsx), and members can open it.
            Registered logged-out only, its "Join Waitlist" button fell through
            to the "*" fallback and bounced signed-in visitors to /dashboard.
            The form reads no auth state, so it renders the same for both. */}
        <Route path="/waitlist" element={<WaitlistForm />} />

        {/* The two marketing pages the public header and footer link to. They
            sit outside the logged-out block so a signed-in member can browse
            back out to them and return: registered only for logged-out
            visitors, "/" fell through to the "*" fallback below, which bounced
            members straight back to /dashboard. That redirect is what made the
            dashboard a one-way door — the logo, the footer links and a typed
            URL all led back to where you already were. Neither page reads auth
            state, so they render the same for a member as for a visitor.
            /login and /joinNow deliberately stay logged-out only — a member
            landing there SHOULD be sent to their dashboard. */}
        <Route path="/" element={<NannyShare />} />
        <Route path="/jobSeekers" element={<Caregivers />} />

        {/* Logged-out only — see loggedOutRoutes. */}
        {!user?.type &&
          loggedOutRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        {/* The member area. One dashboard for both types — see PageLayout. */}
        {(user?.type === "Parents" || user?.type === "Nanny") && (
          // No splat and no "*" child: an unknown /dashboard/... path must not
          // match here, so it falls through to the site-wide 404 below instead
          // of rendering inside the dashboard shell.
          <Route path="/dashboard" element={<Nanny />}>
            <Route path="nanny-profile-view/:id" element={<NannyProfileView />} />
            <Route path="family-profile-view/:id" element={<FamilyProfileView />} />
            <Route path="profileNanny/:id" element={<ProfileNanny />} />
            <Route path="profileFamily/:id" element={<ProfileFamily />} />
            <Route path="requests" element={<MatchRequests />} />
            <Route path="post-a-job" element={<PostAJob />} />
            <Route path="complete-profile" element={<OnboardingCompleteProfile />} />
            {/* A share is full-time or part-time, so there are two
                questionnaires. The after-school, pickup/drop-off, weekend and
                seasonal screens described services the product does not run;
                each was a part-time week, and part-time now asks for them. */}
            <Route path="post-a-nannyShare" element={<PostANannyShare />} />
            <Route path="post-a-nannyShare/fulltime-care" element={<FullTime />} />
            <Route path="post-a-nannyShare/parttime-care" element={<PartTime />} />
            <Route path="edit" element={user?.type === "Nanny" ? <EditProfileNanny /> : <EditProfile />} />
            <Route
              path="terms-and-conditions"
              element={<TermsAndConditions />}
            />
            <Route path="setting" element={<Setting />} />
            <Route path="message" element={<Message />} />
            <Route path="share-management" element={<ShareManagement />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="caregivers" element={<Family />} />
            <Route path="nannyShareView/:id" element={<NannyShareDetails />} />
            <Route path="nannyShareEdit/:id" element={<EditNannyShare />} />
            <Route path="description/:id" element={<JobDescription />} />
            <Route path="jobListing" element={<JobListing />} />
            <Route path="jobListingView/:id" element={<JobListingView />} />
          </Route>
        )}

        {/* Fallback: the 404 page, except for the two redirects in AuthFallback. */}
        <Route
          path="*"
          handle={{ standalone: true }}
          element={
            <AuthFallback
              isAuthed={user?.type === "Parents" || user?.type === "Nanny"}
              hasSession={Boolean(user?.type)}
              loggedOutPaths={loggedOutRoutes.map(({ path }) => path)}
            />
          }
        />
      </Route>,
    ),
  );

  return <RouterProvider router={router} />;
}

export default App;