import "../../App.css";
import {
  CloseCircleOutlined,
  PoweroffOutlined,
  RightOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "react-avatar";
import { persistor } from "@app/store";
import { selectUnseenCount } from "@features/notifications/store/notificationSlice";
import { useNotifications } from "@features/notifications/useNotification";
import { timeAgo } from "@shared/lib/toCamelCase";
import CustomButton from "@shared/ui/Button";
import PlusBadge from "@shared/ui/PlusBadge";
import UserAvatar from "@app/layout/UserAvatar";
import SubscriptionModal from "@features/subscription/components/SubscriptionModal";
import ReferAFriendModal from "@features/referral/components/ReferAFriendModal";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";
import { clearSelectedContact } from "@features/chat/store/selectedContactSlice";
import {
  getPendingIncomingCountThunk,
  selectPendingIncomingBadge,
  selectPendingIncomingCount,
} from "@features/matching/store/matchSlice";
import { logoutThunk } from "@features/auth/store/authSlice";

// eslint-disable-next-line react/prop-types
export default function Navbar1({ nanny }) {
  const { pathname } = useLocation();
  const unseenCount = useSelector(selectUnseenCount);
  const navigate = useNavigate();
  const notificationsData =
    useSelector((state) => state?.notifications?.notifications) || [];
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const basePath = "/dashboard";

  // Caregivers (Nanny + hasFamily === false) have no subscription — they keep
  // matching by referring a friend — so the navbar CTA is "Refer a Friend" for
  // them instead of "Upgrade". isReferralGated depends on hasFamily, which lives
  // on the profile and not the auth user, so it comes from the server.
  const { isReferralGated, code: referralCode } = useSelector((s) => s.referral);

  // Match requests waiting on this member's answer, shown on the Matches item.
  // `pendingBadge` is null when there is nothing waiting, and caps at "5+".
  const pendingRequests = useSelector(selectPendingIncomingCount);
  const pendingBadge = useSelector(selectPendingIncomingBadge);
  const pendingLabel = `${pendingRequests} match ${
    pendingRequests === 1 ? "request" : "requests"
  } waiting on your answer`;

  // Refetched on every dashboard navigation, not only on mount. The navbar
  // outlives each screen, so a mount-only fetch would leave the badge frozen at
  // whatever it read when the member signed in — and the badge matters most
  // while they are somewhere else in the dashboard. It is a count query, not
  // the requests listing. Answering a request adjusts the number locally
  // (matchSlice), so navigating is a correction rather than the only update.
  useEffect(() => {
    dispatch(getPendingIncomingCountThunk());
  }, [dispatch, pathname]);

  useEffect(() => {
    // Only nannies can be referral-gated; families are always on subscription,
    // so there's no reason to fetch (or mint a referral code) for them.
    if (user?.type === "Nanny") dispatch(getMyReferralThunk());
  }, [dispatch, user?.type]);

  // Whether this account already holds FamLink Plus.
  //
  // Read off the auth user rather than `cardData.subscriptionStatus`, for two
  // reasons. `premium` and `subscriptionStatus` ship with the login and refresh
  // responses, so the answer is known on first paint and a subscriber never
  // watches the Upgrade button appear and then vanish. And cardData starts life
  // as a hardcoded stub that claims `active: true` for everyone until a screen
  // fetches the real thing — reading it here would hide the button from free
  // members for that first moment instead.
  //
  // `premium` and `subscriptionStatus` are checked together because they
  // disagree by design: a cancelled subscription leaves `premium` true until
  // the period it was paid for actually ends. Both spellings of "subscribed"
  // count — a member mid-cancellation still has the thing the button sells, and
  // Settings is where that winding-down is shown ("Scheduled to cancel on …").
  // This mirrors subscriptionTier() on the server.
  const subscriptionStatus = String(user?.subscriptionStatus || "").toLowerCase();
  const hasPlus =
    user?.premium === true ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing";

  // Which billing CTA to show: "refer" for a referral caregiver, "upgrade" for
  // families and nannies who already have a family. For a nanny we hold off
  // until the referral status has loaded (referralCode becomes non-null) so a
  // caregiver never flashes the "Upgrade" button that shouldn't apply to them.
  //
  // A paying member gets neither. "Upgrade" would be selling them what they
  // already own — and the modal behind it opens a second checkout for the same
  // plan. A subscribed caregiver is not referral-gated either (the match gate
  // exempts `premium` outright), so there is nothing to nudge them toward.
  const billingCta = hasPlus
    ? null
    : user?.type === "Nanny"
      ? referralCode != null
        ? isReferralGated
          ? "refer"
          : "upgrade"
        : null
      : "upgrade";

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    setShowNotifications(false);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    setMenuOpen(false);
    setShowNotifications(false);
  };

  const { handleMarkAsSeen } = useNotifications({ userId: user._id });
  const markAsSeen = (id) => {
    handleMarkAsSeen(id);
  };
  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
    setMenuOpen(false);
    setMobileMenuOpen(false);
  };
  // Logging out has to leave the dashboard, not just clear the session. App.jsx
  // unregisters /dashboard/* the instant user.type goes away, so a bare
  // dispatch(logout()) left us sitting on a dashboard URL that no longer matched
  // any route: the "*" fallback fired, saw a logged-out visitor on /dashboard/…
  // and bounced them to /login?redirect=… — the sign-in page, not the landing
  // page. Routing away with navigate() instead races that same re-render (App.jsx
  // rebuilds the router on every auth change), so we leave through the browser:
  // it lands on "/" deterministically and drops the previous user's data still
  // held by the slices no reducer clears on logout (chat, notifications,
  // referral…). purge() wipes the persisted session first so the fresh load can't
  // rehydrate it; the in-memory store goes away with the page.
  const logOut = async () => {
    // The server call has to come first, and it is no longer optional. The
    // refresh token is in an httpOnly cookie: purging localStorage cannot touch
    // it, and without telling the server the session stayed valid for another
    // seven days after the member thought they had signed out. This deletes the
    // stored session and clears the cookie; it resolves either way, so a failed
    // request cannot strand someone on a page they are trying to leave.
    await dispatch(logoutThunk());
    await persistor.purge();
    window.location.replace("/");
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div
      style={{ background: "#FFFFFF" }}
      className={`${!(
        pathname.startsWith("/dashboard/post-a-job") ||
        pathname.startsWith("/dashboard/post-a-nannyShare")
      ) && "shadow-soft"
        } top-0 z-50 sticky flex justify-between items-center w-full h-20 padding-navbar1`}
    >
      {/* The logo leaves the dashboard for the public site, the way a logo does
          everywhere else — the session survives, and the header there offers a
          "Dashboard" button back. The dashboard home keeps its own entry
          ("Find a Match"), in the desktop nav and the mobile menu both. */}
      <NavLink
        to="/"
        title="Back to the Famlink home page"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <div className="flex gap-1 items-center">
          <img src="/logo3.png" alt="logo" className="w-6 h-6 sm:w-8 sm:h-8" />
          <p className="Livvic-Bold text-lg sm:text-xl Livvic-Bold">Famlink</p>
        </div>
      </NavLink>

      {/* Desktop Navigation */}
      {!(
        pathname.startsWith("/dashboard/post-a-job") ||
        pathname.startsWith("/dashboard/post-a-nannyShare")
      ) && (
          <div className="hidden lg:flex text-lg items-center gap-4">
            <NavLink
              to={basePath}
              className={() =>
                `transition-all duration-200 border-b-[3px] cursor-pointer Quicksand ${
                  window.location.pathname === basePath
                    ? "text-[#001243] border-[#DDE5FF]"
                    : "text-[#8A8E99] border-transparent hover:text-[#001243] hover:opacity-70"
                }`
              }
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <span className="Livvic-SemiBold text-md">Find a Match</span>
            </NavLink>

            {/* <NavLink
              className="transition delay-150 ease-in-out hover:text-[#AEC4FF] rounded-3xl duration-300 cursor-pointer Quicksand"
              to={`${basePath}/requests`}
              style={({ isActive }) => ({
                color: isActive ? "#001243" : "#8A8E99",
              })}
            >
              <p className="Livvic-SemiBold text-md">Requests</p>
            </NavLink> */}

            {/* {!nanny && (
            <NavLink
              className="transition delay-150 ease-in-out hover:text-[#AEC4FF] rounded-3xl duration-300 cursor-pointer Quicksand"
              to={"family/jobListing"}
              style={({ isActive }) => ({
                color: isActive ? "#001243" : "#8A8E99",
              })}
            >
              <p className="Livvic-SemiBold text-md">My Job Listings</p>
            </NavLink>
          )} */}

            {/* <NavLink
            className="transition delay-150 ease-in-out hover:text-[#AEC4FF] rounded-3xl duration-300 cursor-pointer Quicksand"
            to={nanny ? "nanny/community" : "family/community"}
            style={({ isActive }) => ({
              color: isActive ? "#001243" : "#8A8E99",
            })}
          >
            <p className="Livvic-SemiBold text-md">Community</p>
          </NavLink> */}

            <NavLink
              className={({ isActive }) =>
                `transition-all duration-200 border-b-[3px] cursor-pointer Quicksand ${
                  isActive
                    ? "text-[#001243] border-[#DDE5FF]"
                    : "text-[#8A8E99] border-transparent hover:text-[#001243] hover:opacity-70"
                }`
              }
              to={`${basePath}/message`}
            >
              <div className="relative inline-block">
                <span className="Livvic-SemiBold text-md">Matches</span>
                {pendingBadge && (
                  <span
                    title={pendingLabel}
                    aria-label={pendingLabel}
                    style={{ backgroundColor: "#ADC5FF", color: "#070926" }}
                    className="absolute -top-2 -right-3 min-w-[1.25rem] px-1 rounded-full text-xs Livvic-Medium text-center leading-5 shadow-sm"
                  >
                    {pendingBadge}
                  </span>
                )}
              </div>
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `transition-all duration-200 border-b-[3px] cursor-pointer Quicksand ${
                  isActive
                    ? "text-[#001243] border-[#DDE5FF]"
                    : "text-[#8A8E99] border-transparent hover:text-[#001243] hover:opacity-70"
                }`
              }
              to={`${basePath}/share-management`}
            >
              <div className="relative inline-block">
                <span className="Livvic-SemiBold text-md">Share Management</span>
                <span
                  className="absolute -bottom-2 -right-6 px-1 rounded-md text-xs Livvic-Medium whitespace-nowrap shadow-sm"
                  style={{ backgroundColor: "#AEC4FF", color: "#001243" }}
                >
                  coming soon
                </span>
              </div>
            </NavLink>

          </div>
        )}

      <div className="flex items-center gap-x-4">
        {/* Billing CTA — referral for caregivers, subscription for everyone else
            (see billingCta above). Null while a nanny's status is still loading. */}
        {billingCta === "refer" && (
          <CustomButton
            btnText={"Refer a Friend"}
            action={() => setShowReferModal(true)}
            className="btn-shine bg-[#D6FB9A] text-[#025747] text-sm px-3 py-2 whitespace-nowrap"
          />
        )}
        {billingCta === "upgrade" && (
          <CustomButton
            btnText={"Upgrade"}
            action={() => setShowUpgradeModal(true)}
            className="btn-shine bg-[#D6FB9A] text-[#025747] text-sm px-3 py-2"
          />
        )}

        {showUpgradeModal && (
          <SubscriptionModal onClose={() => setShowUpgradeModal(false)} />
        )}
        {showReferModal && (
          <ReferAFriendModal onClose={() => setShowReferModal(false)} />
        )}

        {/* Notifications */}
        <div className="relative">
          <img
            src="/bell-icon.svg"
            onClick={() => setShowNotifications(!showNotifications)}
            className="cursor-pointer w-6 h-6"
            alt="notification-icon"
          />
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs Livvic-Medium px-1 py-0.2 rounded-full">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </div>

        {/* Mobile Hamburger Menu */}
        {!(
          pathname.startsWith("/dashboard/post-a-job") ||
          pathname.startsWith("/dashboard/post-a-nannyShare")
        ) && (
            <div className="lg:hidden">
              <button
                onClick={toggleMobileMenu}
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors"
              >
                <MenuOutlined className="text-xl text-gray-600" />
              </button>
            </div>
          )}

        {/* Desktop Profile Menu */}
        <div className="hidden lg:block">
          {!(
            pathname.startsWith("/dashboard/post-a-job") ||
            pathname.startsWith("/dashboard/post-a-nannyShare")
          ) && (
              <div
                className="flex gap-x-2 bg-white px-2 py-1 rounded-full cursor-pointer"
                onClick={toggleMenu}
              >
                {/* {user.imageUrl ? (
                <img
                  style={{ borderRadius: "100px" }}
                  src={user.imageUrl}
                  alt="avatar"
                  className="rounded-full w-8 h-8 object-cover"
                />
              ) : (
                <Avatar
                  className="rounded-full text-black"
                  size="32"
                  color={"#AEC4FF"}
                  name={user.name
                    ?.split(" ")
                    .slice(0, 2)
                    .join(" ")}
                />
              )} */}
                <UserAvatar
                  user={user}
                  className={"rounded-full w-8 h-8 object-cover"}
                  size={32}
                  avatarClassName={"rounded-full text-primary"}
                />
              </div>
            )}
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-20 left-0 right-0 z-40 bg-white shadow-lg lg:hidden"
              style={{ maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}
            >
              <div className="p-4">
                {/* Profile Section */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 mb-4">
                  {/* {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt="avatar"
                      className="rounded-full w-12 h-12 object-cover"
                    />
                  ) : (
                    <Avatar
                      className="rounded-full text-black"
                      size="48"
                      color={"#AEC4FF"}
                      name={user.name?.split(" ").slice(0, 2).join(" ")}
                    />
                  )} */}
                  <UserAvatar
                    user={user}
                    className={"rounded-full w-12 h-12 object-cover"}
                    size={48}
                    avatarClassName={"rounded-full text-primary"}
                  />
                  <div>
                    <p className="Livvic-SemiBold text-lg Quicksand flex items-center gap-1.5">
                      {user.name}
                      <PlusBadge active={hasPlus} size="md" />
                    </p>
                  </div>
                </div>

                {/* Main Navigation Links */}
                <div className="space-y-3">
                  <NavLink
                    to={basePath}
                    onClick={() => {
                      closeMobileMenu();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    style={() => ({
                      backgroundColor: window.location.pathname === basePath ? "#001243" : "transparent",
                      color: window.location.pathname === basePath ? "#FFFFFF" : "#374151",
                    })}
                  >
                    <p className="Livvic-Medium">
                      Find a Match
                    </p>
                  </NavLink>


                  <NavLink
                    to={`${basePath}/message`}
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#001243" : "transparent",
                      color: isActive ? "#FFFFFF" : "#374151",
                    })}
                  >
                    <p className="Livvic-Medium flex items-center gap-2">
                      Matches
                      {pendingBadge && (
                        <span
                          aria-label={pendingLabel}
                          style={{ backgroundColor: "#ADC5FF", color: "#070926" }}
                          className="min-w-[1.25rem] px-1 rounded-full text-xs Livvic-Medium text-center leading-5"
                        >
                          {pendingBadge}
                        </span>
                      )}
                    </p>
                  </NavLink>

                  <NavLink
                    to={`${basePath}/share-management`}
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#001243" : "transparent",
                      color: isActive ? "#FFFFFF" : "#374151",
                    })}
                  >
                    <div className="relative inline-block">
                      <p className="Livvic-Medium">Share Management</p>
                      <span
                        className="absolute -bottom-2.5 -right-7 px-1 rounded-md text-xs Livvic-Medium whitespace-nowrap shadow-sm"
                        style={{ backgroundColor: "#AEC4FF", color: "#001243" }}
                      >
                        coming soon
                      </span>
                    </div>
                  </NavLink>
                  {/* 
                  {!nanny && (
                    <NavLink
                      to="family/jobListing"
                      onClick={closeMobileMenu}
                      className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "transparent",
                        color: isActive ? "#001243" : "#374151",
                      })}
                    >
                      <p className="Livvic-Medium">My Job Listings</p>
                    </NavLink>
                  )} */}

                  {/* <NavLink
                    to={nanny ? "nanny/community" : "family/community"}
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "transparent",
                      color: isActive ? "#001243" : "#374151",
                    })}
                  >
                    <p className="Livvic-Medium">Community</p>
                  </NavLink> */}


                  {/* <NavLink
                    to={`${basePath}/booking`}
                    onClick={closeMobileMenu}
                    className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "transparent",
                      color: isActive ? "#001243" : "#374151",
                    })}
                  >
                    <p className="Livvic-Medium">Payments</p>
                  </NavLink> */}

                  {/* Profile & Settings */}
                  <div className="border-t border-gray-200 pt-4 mt-4">


                    <NavLink
                      to={`${basePath}/edit`}
                      onClick={closeMobileMenu}
                      className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "transparent",
                        color: isActive ? "#001243" : "#374151",
                      })}
                    >
                      <p className="Livvic-Medium">Edit Profile</p>
                    </NavLink>

                    <NavLink
                      to={`${basePath}/favorites`}
                      onClick={closeMobileMenu}
                      className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "transparent",
                        color: isActive ? "#001243" : "#374151",
                      })}
                    >
                      <p className="Livvic-Medium">Favorites</p>
                    </NavLink>

                    <NavLink
                      to={`${basePath}/setting`}
                      onClick={closeMobileMenu}
                      className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "transparent",
                        color: isActive ? "#001243" : "#374151",
                      })}
                    >
                      <p className="Livvic-Medium">Settings</p>
                    </NavLink>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <button
                      onClick={() => {
                        dispatch(clearSelectedContact());
                        logOut();
                        closeMobileMenu();
                      }}
                      className="flex items-center gap-2 py-3 px-4 text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full text-left"
                    >
                      <PoweroffOutlined />
                      <span className="Livvic-Medium">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Menu Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
              onClick={closeMobileMenu}
            />
          </>
        )}

        {/* Desktop Profile Dropdown Menu */}
        {menuOpen && (
          <>
            <div
              style={{
                top: 0,
                maxHeight: "80vh",
                overflowY: "auto",
              }}
              className="right-0 z-50 absolute bg-white shadow-lg w-72 hidden lg:block"
            >
              {/* Profile Section */}
              <div style={{ background: "#001243" }}>
                <div className="pb-2">
                  <CloseCircleOutlined
                    onClick={toggleMenu}
                    className="p-2 cursor-pointer text-white text-xl"
                  />
                  <NavLink
                    onClick={toggleMenu}
                    to={basePath}
                  >
                    <div className="flex justify-center w-full text-center">
                      <div>
                        {/* {user.imageUrl ? (
                          <img
                            src={user.imageUrl}
                            alt="avatar"
                            className="mx-auto rounded-full w-12 h-12 object-cover"
                          />
                        ) : (
                          <Avatar
                            className="rounded-full text-5xl text-black"
                            size="48"
                            color={"#AEC4FF"}
                            name={user.name?.split(" ").slice(0, 2).join(" ")}
                          />
                        )} */}
                        <UserAvatar
                          user={user}
                          className={
                            "mx-auto rounded-full w-12 h-12 object-cover"
                          }
                          size={48}
                          avatarClassName={"rounded-full text-5xl text-primary"}
                        />
                        <p className="py-2 Livvic-SemiBold text-2xl Quicksand text-white flex items-center justify-center gap-2">
                          {user.name}
                          <PlusBadge active={hasPlus} size="md" tone="onDark" />
                        </p>
                      </div>
                    </div>
                  </NavLink>
                </div>
              </div>

              {/* Menu Options */}
              <div className="mt-8 flex justify-center">
                <div>


                  <NavLink
                    className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                    to={`${basePath}/edit`}
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                    })}
                    onClick={toggleMenu}
                  >
                    <p>Edit Profile</p>
                    <RightOutlined className="text-sm" />
                  </NavLink>

                  {/* {!nanny && (
                    <NavLink
                      className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                      to={"dashboard/post-a-job"}
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                      })}
                      onClick={toggleMenu}
                    >
                      <p>Post a Job</p>
                      <RightOutlined className="text-sm" />
                    </NavLink>
                  )} */}

                  {/* <NavLink
                    className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                    to={nanny ? "nanny/booking" : "family/booking"}
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                    })}
                    onClick={toggleMenu}
                  >
                    <p>Application</p>
                    <RightOutlined className="text-sm" />
                  </NavLink> */}

                  <NavLink
                    className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                    to={`${basePath}/favorites`}
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                    })}
                    onClick={toggleMenu}
                  >
                    <p>Favorite</p>
                    <RightOutlined className="text-sm" />
                  </NavLink>

                  <NavLink
                    className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                    to={`${basePath}/setting`}
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                    })}
                    onClick={toggleMenu}
                  >
                    <p>Settings</p>
                    <RightOutlined className="text-sm" />
                  </NavLink>
                </div>
              </div>

              {/* <div className="my-2">
                <h5 className="mx-8 mb-4 Livvic-SemiBold text-2xl">Support</h5>
                <div className="flex justify-center">
                  <div>
                    <NavLink
                      className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                      to={nanny ? "nanny/tipsAndArticles" : "family/tipsAndArticles"}
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                      })}
                      onClick={toggleMenu}
                    >
                      <p>Tips & Articles</p>
                      <RightOutlined className="text-sm" />
                    </NavLink>
                    <NavLink
                      className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                      to={nanny ? "nanny/howItWorks" : "family/howItWorks"}
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                      })}
                      onClick={toggleMenu}
                    >
                      <p>How it Works</p>
                      <RightOutlined className="text-sm" />
                    </NavLink>
                    <NavLink
                      className="flex justify-between border-2 hover:opacity-60 mb-4 px-2 py-1 rounded-3xl w-56 Livvic-Medium text-sm duration-300 cursor-pointer Quicksand"
                      to={nanny ? "nanny/trustsAndSafety" : "family/trustsAndSafety"}
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "#E9F8FF" : "#F7F9FA",
                      })}
                      onClick={toggleMenu}
                    >
                      <p>Trust & Safety</p>
                      <RightOutlined className="text-sm" />
                    </NavLink>
                  </div>
                </div>
              </div> */}

              {/* Logout */}
              <div className="flex justify-center mt-4 mb-6 Quicksand">
                <button
                  onClick={logOut}
                  className="flex items-center gap-2 hover:opacity-65 duration-300"
                >
                  <PoweroffOutlined />
                  Logout
                </button>
              </div>
            </div>

            {/* Desktop Backdrop */}
            <div
              className="z-40 fixed inset-0 bg-black opacity-50 hidden lg:block"
              onClick={toggleMenu}
            />
          </>
        )}

        {/* Notifications Dropdown */}
        {showNotifications && (
          <>
            <div onClick={toggleNotifications} className="fixed inset-0 z-40" />
            <div
              style={{
                top: 70,
                right: 20,
                maxHeight: "80vh",
                overflowY: "auto",
              }}
              className="absolute right-0 mt-2 lg:w-96 w-80 z-50 bg-white rounded-xl shadow-lg"
            >
              <div className="p-4 border-b border-[#001243] flex items-center justify-between bg-[#001243] rounded-t-xl text-white">
                <h3 className="Livvic-SemiBold text-lg">Notifications</h3>
                <button
                  onClick={toggleNotifications}
                  className="text-white opacity-80 hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>

              {notificationsData.length > 0 ? (
                <div className="space-y-3 p-4">
                  {notificationsData.map((n, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        toggleNotifications();
                        markAsSeen(n._id);
                        if (n.type === "Booking") {
                          n.content === "Give review"
                            ? navigate(
                              `${basePath}/profile`
                            )
                            : navigate(
                              `${basePath}/booking`
                            );
                        } else if (n.type === "Message") {
                          navigate(
                            `${basePath}/message`
                          );
                        } else {
                          navigate("/notifications");
                        }
                      }}
                      className={`flex items-start justify-between cursor-pointer p-3 rounded-lg ${n.seen ? "bg-gray-100" : "bg-blue-50"
                        } hover:bg-blue-100 transition`}
                    >
                      <div className="flex items-center gap-3">
                        {n.senderId?.imageUrl ? (
                          <img
                            src={n.senderId?.imageUrl}
                            className="w-10 h-10 rounded-full object-cover"
                            alt="profile"
                          />
                        ) : (
                          <Avatar
                            className="rounded-full text-5xl text-black"
                            size="40"
                            color={"#AEC4FF"}
                            name={n.senderId?.name
                              ?.split(" ")
                              .slice(0, 2)
                              .join(" ")}
                          />
                        )}
                        <div>
                          <p className="Livvic-SemiBold">{n.senderId?.name}</p>
                          <p className="text-sm text-gray-600 whitespace-normal">
                            {n.type === "Message" &&
                              `New Message: ${n.content.length > 25
                                ? n.content.slice(0, 25) + "..."
                                : n.content
                              }`}
                            {n.type === "Booking" &&
                              `${n.content.length > 25
                                ? n.content.slice(0, 25) + "..."
                                : n.content
                              }`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No notifications
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
