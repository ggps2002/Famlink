import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ShieldCheck } from "lucide-react";
import SEOMetaData from "@shared/seo/SEOMetaData";
import Loader from "@shared/ui/Loader";
import SharedProfileCard from "@features/share-link/SharedProfileCard";
import { fetchSharedProfileThunk } from "@features/share-link/store/shareProfileSlice";
import { getShareProfileCopy } from "@features/share-link/shareProfileCopy";
import { rememberSharedProfile } from "@features/share-link/sharedProfileRef";

// The page behind a shared link: /share/<token>.
//
// This is the only FamLink page most of its readers will ever have seen — it
// arrives in a Facebook group or a group text from someone they trust, not from
// a search. So it opens with the opportunity ("Another family needed to build a
// share"), explains the arithmetic underneath, shows the card, and offers
// exactly one action.
//
// Public by design and safe to be: everything shown comes from the server's
// redacted projection, which carries no name, photo or address.

export default function SharedProfilePage() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { sharedProfile, isSharedProfileLoading, sharedProfileError } = useSelector(
    (s) => s.shareProfile
  );
  const { user } = useSelector((s) => s.auth);
  const isMember = user?.type === "Parents" || user?.type === "Nanny";

  useEffect(() => {
    if (token) dispatch(fetchSharedProfileThunk(token));
  }, [dispatch, token]);

  // Park the token immediately, not on the CTA click. Plenty of readers will
  // open the page, wander off to the home page to work out what FamLink even
  // is, and sign up from there — the loop should still bring them back here.
  useEffect(() => {
    if (token) rememberSharedProfile(token);
  }, [token]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copy = getShareProfileCopy(sharedProfile?.variant);

  // Where the CTA goes. A signed-in member can act right now, so send them
  // straight to the real profile. Everyone else goes to signup — the token is
  // already stored, and it also rides the URL so a signup finished in another
  // tab still resolves.
  const isOwnProfile = isMember && sharedProfile?.ownerId === user?._id;

  const handleCta = () => {
    if (!sharedProfile) return;
    if (isOwnProfile) {
      navigate("/dashboard");
      return;
    }
    if (isMember) {
      navigate(
        sharedProfile.role === "Family"
          ? `/dashboard/family-profile-view/${sharedProfile.ownerId}`
          : `/dashboard/nanny-profile-view/${sharedProfile.ownerId}`
      );
      return;
    }
    navigate(`/joinNow?share=${encodeURIComponent(token)}`);
  };

  return (
    <>
      {/* Shared profiles are noindex: they're privacy-sensitive, and a link
          meant for one Facebook group has no business in search results. */}
      <SEOMetaData
        title="A Nanny Share Opportunity Near You | FamLink"
        description="Someone shared an active nanny share opportunity with you. See the schedule, rate and neighborhood, then find out if it's a match."
        noIndex
      />

      <div className="Quicksand bg-[#F7F9FA] min-h-screen">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {isSharedProfileLoading ? (
            <Loader />
          ) : sharedProfileError || !sharedProfile ? (
            <div className="bg-white border border-[#ECECEC] rounded-3xl px-6 py-12 text-center">
              <h1 className="Livvic-Bold text-2xl text-[#0D134C] mb-2">
                This share is no longer available
              </h1>
              <p className="Livvic-Medium text-secondary text-[15px] mb-6">
                The link may have expired, or the family or caregiver may have
                already found their match. There are others nearby.
              </p>
              <button
                onClick={() => navigate("/joinNow")}
                className="bg-[#AEC4FF] text-[#0D134C] Livvic-SemiBold rounded-full px-6 py-3"
              >
                Find a Nanny Share
              </button>
            </div>
          ) : (
            <>
              {/* Headline + subheadline — chosen by share type, and phrased as
                  FamLink presenting an opening rather than a member pitching. */}
              <div className="text-center mb-8">
                <h1 className="Livvic-Bold text-2xl sm:text-3xl text-[#0D134C] leading-snug mb-2">
                  {copy.headline}
                </h1>
                <p className="Livvic-Medium text-secondary text-[15px] sm:text-base">
                  {copy.subheadline}
                </p>
              </div>

              <SharedProfileCard
                profile={sharedProfile}
                ctaText={isOwnProfile ? "Go to Your Dashboard" : copy.cta}
                onCta={handleCta}
              />

              {/* Says plainly why there's no name on the card, so its absence
                  reads as care rather than as a half-finished listing. */}
              <p className="flex items-center justify-center gap-2 mt-5 text-xs Livvic-Medium text-secondary text-center">
                <ShieldCheck size={14} className="flex-shrink-0" />
                Names and photos stay private until both sides agree to match.
              </p>

              {!isMember && (
                <p className="text-center mt-8 text-sm Livvic-Medium text-secondary">
                  New to FamLink? A nanny share splits one trusted nanny — and the
                  cost — between two families.{" "}
                  <button
                    onClick={() => navigate("/")}
                    className="text-primary Livvic-SemiBold underline"
                  >
                    See how it works
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
