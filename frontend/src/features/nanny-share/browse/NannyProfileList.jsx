import { useEffect, useState } from "react";
import { Pagination, Skeleton } from "antd";
import { FamilyProfile, NannyProfile, ProfileCard1 } from "@features/nanny-share/components/profileCard";
import { useDispatch, useSelector } from "react-redux";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { convertAgeRanges } from "@shared/lib/children";
import { formatEachFamilyRate, formatSharedRate, formatSoloRate } from "@shared/lib/rates";
import Loader from "@shared/ui/Loader";
import { fetchAllPostJobThunk } from "@features/jobs/store/postJobSlice";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { viewCurrentUserProfileThunk, viewNannyShareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";
import { RequestMatchDenied } from "@features/matching/components/RequestMatchDenied";
import { sentMatchRequestThunk } from "@features/matching/store/matchSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { CompleteProfileModal } from "@features/matching/components/CompleteProfileModal";
import { MatchRequestFormModal } from "@features/matching/components/MatchRequestFormModal";
import RejectMatchModal from "@features/matching/components/RejectMatchModal";
import { ReferAFriendModal } from "@features/referral/components/ReferAFriendModal";
import { ShareProfileModal } from "@features/share-link/ShareProfileModal";
import { getMatchGate, MATCH_GATE } from "@features/matching/matchGate";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";
import { Share2, SlidersHorizontal } from "lucide-react";

// How many times to re-fetch "Your Profile" while it's still coming back empty.
// Right after signup the nanny-share profile document can land on the server a
// beat after the first request, so we retry before settling on the empty state.
const MAX_PROFILE_FETCH_TRIES = 4;

export default function ProfileList({
  location,
  priceRange,
  availability,
  careOptions,
  services,
  maxChildren,
  minRating,
  // Opens the filter drawer. The drawer and its open state live in the parent
  // (nanny.jsx) because it also renders the drawer itself; only the button that
  // opens it belongs here, beside the heading it filters.
  onOpenFilters,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isMatchRequestDenied, setIsMatchRequestDenied] = useState(false);
  const [isReferModal, setIsReferModal] = useState(false);
  const [isShareModal, setIsShareModal] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [senderId, setSenderId] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [isRequestSubmitModal, setIsRequestSubmitModal] = useState(false);
  const { requestSentCount, isMatchLoading, message } = useSelector((state) => state.matchRequest);
  const { user, accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { data, pagination, isCurrentProfileLoading, isProfilesLoading, currentProfile } = useSelector((state) => state.postNannyShare);

  // "Your Profile" comes from viewCurrentUserProfileThunk. Right after signup the
  // nanny-share profile document can land on the server a beat after this first
  // request fires, so that initial fetch 404s (see viewUserProfile). The old bare
  // `[]` effect never retried, which is why the card stayed blank until a manual
  // refresh re-ran it. Retry a few times while it's still missing so it fills in
  // on its own — it stops the moment a profile comes back, or after a handful of
  // tries for users who genuinely don't have one yet.
  const [profileFetchTry, setProfileFetchTry] = useState(0);

  // True while we still don't have a profile but haven't given up looking — the
  // initial load or any pending retry. renderCurrentProfile shows the skeleton
  // for this whole window so a just-signed-up user never sees a blank card (or a
  // flicker between retries); only once retries are exhausted with nothing found
  // do we fall through to the empty state.
  const isResolvingCurrentProfile =
    !currentProfile &&
    (isCurrentProfileLoading || profileFetchTry < MAX_PROFILE_FETCH_TRIES);

  useEffect(() => {
    dispatch(viewCurrentUserProfileThunk());
  }, [dispatch, profileFetchTry]);

  useEffect(() => {
    if (currentProfile || isCurrentProfileLoading || profileFetchTry >= MAX_PROFILE_FETCH_TRIES) return;
    const t = setTimeout(() => setProfileFetchTry((n) => n + 1), 1200);
    return () => clearTimeout(t);
  }, [currentProfile, isCurrentProfileLoading, profileFetchTry]);

  // Refreshes referralMatchingUntil on the auth user, which the match gate
  // reads. Without this a caregiver whose friend signed up an hour ago would
  // still be locked out until their access token next refreshed.
  useEffect(() => {
    if (user?.type === "Nanny") dispatch(getMyReferralThunk());
  }, [dispatch, user?.type]);

  const pageSize = 10;

  useEffect(() => {
    const filters = {
      page: currentPage,
      limit: pageSize,
    };
    if (location > 0) filters.location = location;
    if (careOptions.length > 0) {
      const { min, max } = convertAgeRanges(careOptions);
      // Null bounds are omitted, not sent — see the note in the family-side
      // ProfileList: an explicit maxAge: null matches nothing on the server.
      if (min !== null) filters.minAge = min;
      if (max !== null) filters.maxAge = max;
    }
    if (priceRange[0] >= 0 && priceRange[1] >= 0) {
      filters.minRate = priceRange[0];
      filters.maxRate = priceRange[1];
    }
    if (maxChildren) filters.maxChildren = maxChildren;
    if (services.length > 0) filters.jobType = services;
    if (availability?.length > 0) filters.preferredSchedule = availability;
    // Omitted rather than sent as 0 — the server reads any falsy value as "no
    // rating filter", and an absent key says that more plainly than a zero.
    if (minRating > 0) filters.minRating = minRating;

    dispatch(viewNannyShareProfileThunk(filters));
  }, [dispatch, currentPage, location, careOptions, priceRange, availability, services, maxChildren, minRating, requestSentCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [location, careOptions, priceRange, maxChildren, minRating]);

  const total = pagination.totalRecords;
  const handlePageChange = (page) => setCurrentPage(page);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  const handleMatchRequest = async (user, senderId, receiverId, setIsMatchRequestDenied, setIsProfileComplete, setIsRequestSubmitModal) => {
    if (!user.nannyProfileCompleted) {
      setIsProfileComplete(true);
      return;
    }
    // Caregivers looking for a share job get the referral wall; everyone else
    // who's out of free matches gets the subscribe wall.
    const gate = getMatchGate(user, currentProfile);
    if (gate === MATCH_GATE.REFER) {
      setIsReferModal(true);
      return;
    }
    if (gate === MATCH_GATE.SUBSCRIBE) {
      setIsMatchRequestDenied(true);
      return;
    }
    setSenderId(senderId);
    setReceiverId(receiverId);
    setIsRequestSubmitModal(true);
  };

  const renderCurrentProfile = () => {
    if (isResolvingCurrentProfile) {
      return (
        <div className="p-4 border rounded-xl">
          <Skeleton active avatar={{ size: 64, shape: "circle" }} paragraph={{ rows: 3 }} />
        </div>
      );
    }

    if (!currentProfile) return null;


    const extraData =
      currentProfile.userId?.additionalInfo?.reduce(
        (acc, curr) => ({ ...acc, [curr.key]: curr.value }),
        {}
      ) || {};

    if (currentProfile.userId?.type === "Parents") {
      return (
        <FamilyProfile
          key={currentProfile._id}
          // From the auth user, not the profile: /share/current-user-profile
          // projects a narrow set of owner fields that does not include
          // `premium`, so the profile document cannot answer this.
          isPremium={user?.premium}
          id={currentProfile.userId?._id || currentProfile.userId}
          averageRating={currentProfile.averageRating}
          totalRatings={currentProfile.totalRatings}
          status={currentProfile.status}
          matchId={currentProfile.matchId}
          handleMatchRequest={currentProfile.userId._id !== user._id ? handleMatchRequest : null}
          setIsRequestSubmitModal={setIsRequestSubmitModal}
          setIsMatchRequestDenied={setIsMatchRequestDenied}
          setIsProfileComplete={setIsProfileComplete}
          userId={currentProfile.userId?._id}
          name={currentProfile.userId?.name}
          img={currentProfile.userId?.imageUrl}
          careType={currentProfile.nannyShareType || extraData.nannyShareType || currentProfile.careType}
          schedule={currentProfile.specificDays || extraData.specificDaysAndTime}
          location={currentProfile.userId?.location}
          hosting={currentProfile.hostingPreference || extraData.hosting}
          hasNanny={currentProfile.hasNanny}
          start={currentProfile.nannyshareStart || extraData.urgency}
          shareLocation={(() => {
            const loc = currentProfile.shareLocation || extraData.shareLocation;
            if (!loc) return "flexible location";
            let arr = Array.isArray(loc) ? loc : [loc];
            const parsedArr = arr.map((item) => {
              if (typeof item === "string" && (item.startsWith("[") || item.startsWith("{"))) {
                try {
                  const p = JSON.parse(item);
                  return Array.isArray(p) ? p.join(", ") : p;
                } catch (e) {
                  return item;
                }
              }
              return item;
            });
            return parsedArr.join(", ");
          })()}
          sharedRate={formatSharedRate(currentProfile.hourlyBudget) || "N/A"}
          ages={
            currentProfile.childrenAges?.length > 0
              ? currentProfile.childrenAges.map((age) => age.label)
              : []
          }
          childrenCount={(() => {
            if (currentProfile.numberOfChildren !== undefined) return currentProfile.numberOfChildren;
            let childrenObj = currentProfile.userId?.noOfChildren;
            if (typeof childrenObj === "string") {
              try { childrenObj = JSON.parse(childrenObj); } catch (e) { }
            }
            return childrenObj?.length || 0;
          })()}
        />
      );
    }

    return (
      <NannyProfile
        key={currentProfile._id}
        // Same as the family branch above — `premium` comes from the auth user.
        isPremium={user?.premium}
        id={currentProfile.userId?._id || currentProfile.userId}
        averageRating={currentProfile.averageRating}
        totalRatings={currentProfile.totalRatings}
        status={currentProfile.status}
        matchId={currentProfile.matchId}
        handleMatchRequest={currentProfile.userId._id !== user._id ? handleMatchRequest : null}
        userId={currentProfile.userId?._id}
        setIsRequestSubmitModal={setIsRequestSubmitModal}
        setIsMatchRequestDenied={setIsMatchRequestDenied}
        setIsProfileComplete={setIsProfileComplete}
        sharedRate={currentProfile.hasFamily
          ? formatSharedRate(currentProfile.hourlyBudget) ||
            (currentProfile.sharedRate
              ? (formatEachFamilyRate(currentProfile.sharedRate, `/${currentProfile.rateType === "weekly" ? "wk" : "hr"} per family`) || "N/A")
              : "N/A")
          : currentProfile.sharedRate}
        soloRate={currentProfile.hasFamily
          ? formatSoloRate(currentProfile.hourlyBudget) ||
            (currentProfile.soloRate
              ? `$${currentProfile.soloRate}/${currentProfile.rateType === "weekly" ? "wk" : "hr"}`
              : "N/A")
          : currentProfile.soloRate}
        rateType={currentProfile.rateType}
        ages={
          !currentProfile.hasFamily ? currentProfile.preferredAges?.length > 0
            ? currentProfile.preferredAges.map((age) => age.label)
            : [] : currentProfile.childrenAges?.length > 0
            ? currentProfile.childrenAges.map((age) => age.label)
            : []
        }
        childrenCount={(() => {
          if (currentProfile.numberOfChildren !== undefined) return currentProfile.numberOfChildren;
          let childrenObj = currentProfile.userId?.noOfChildren;
          if (typeof childrenObj === "string") {
            try { childrenObj = JSON.parse(childrenObj); } catch (e) { }
          }
          return childrenObj?.length || 0;
        })()}
        schedule={currentProfile.specificDays}
        careType={currentProfile.careType}
        start={currentProfile.startAvailability}
        img={currentProfile.userId?.imageUrl || currentProfile.imageFile}
        name={currentProfile.userId?.name}
        experience={currentProfile?.careExperience}
        distance={currentProfile?.careDistance}
        location={currentProfile.userId?.location}
        created={currentProfile?.createdAt}
        hasFamily={currentProfile.hasFamily}
        whereCare={currentProfile?.whereCare}
      />
    );
  };

  const renderProfiles = () => {
    if (isProfilesLoading) {
      return Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="p-4 border rounded-xl">
          <Skeleton active avatar={{ size: 64, shape: "circle" }} paragraph={{ rows: 3 }} />
        </div>
      ));
    }

    if (!data?.length) {
      return (
        <div className="col-span-full text-start text-gray-600">
          <p>No profiles available at the moment. Please check back later.</p>
        </div>
      );
    }

    return data
      .filter((profile) => profile && profile._id && profile.userId._id !== user._id)
      .map((profile) => {
        const extraData =
          profile.userId?.additionalInfo?.reduce(
            (acc, curr) => ({ ...acc, [curr.key]: curr.value }),
            {}
          ) || {};

        if (profile.userId?.type === "Parents") {
          return (
            <FamilyProfile
              key={profile._id}
              id={profile.userId?._id || profile.userId}
              averageRating={profile.averageRating}
              totalRatings={profile.totalRatings}
              status={profile.status}
              matchId={profile.matchId}
              handleMatchRequest={handleMatchRequest}
              setIsRequestSubmitModal={setIsRequestSubmitModal}
              setIsMatchRequestDenied={setIsMatchRequestDenied}
              setIsProfileComplete={setIsProfileComplete}
              userId={profile.userId?._id}
              name={profile.userId?.name}
              img={profile.userId?.imageUrl}
              careType={profile.nannyShareType || extraData.nannyShareType}
              schedule={profile.specificDays || extraData.specificDaysAndTime}
              location={profile.userId?.location}
              hosting={profile.hostingPreference || extraData.hosting}
              hasNanny={profile.hasNanny}
              start={profile.nannyshareStart || extraData.urgency}
              shareLocation={(() => {
                const loc = profile.shareLocation || extraData.shareLocation;
                if (!loc) return "flexible location";
                let arr = Array.isArray(loc) ? loc : [loc];
                const parsedArr = arr.map((item) => {
                  if (typeof item === "string" && (item.startsWith("[") || item.startsWith("{"))) {
                    try {
                      const p = JSON.parse(item);
                      return Array.isArray(p) ? p.join(", ") : p;
                    } catch (e) {
                      return item;
                    }
                  }
                  return item;
                });
                return parsedArr.join(", ");
              })()}
              sharedRate={formatSharedRate(profile.hourlyBudget) || "N/A"}
              ages={
                profile.childrenAges?.length > 0
                  ? profile.childrenAges.map((age) => age.label)
                  : []
              }
              childrenCount={(() => {
                if (profile.numberOfChildren !== undefined) return profile.numberOfChildren;
                let childrenObj = profile.userId?.noOfChildren;
                if (typeof childrenObj === "string") {
                  try { childrenObj = JSON.parse(childrenObj); } catch (e) { }
                }
                return childrenObj?.length || 0;
              })()}
            />
          );
        }

        return (
          <NannyProfile
            key={profile._id}
            id={profile.userId?._id || profile.userId}
            averageRating={profile.averageRating}
            totalRatings={profile.totalRatings}
            status={profile.status}
            matchId={profile.matchId}
            handleMatchRequest={handleMatchRequest}
            userId={profile.userId?._id}
            setIsRequestSubmitModal={setIsRequestSubmitModal}
            setIsMatchRequestDenied={setIsMatchRequestDenied}
            setIsProfileComplete={setIsProfileComplete}
            sharedRate={profile.hasFamily
              ? formatSharedRate(profile.hourlyBudget) ||
                (profile.sharedRate
                  ? (formatEachFamilyRate(profile.sharedRate, `/${profile.rateType === "weekly" ? "wk" : "hr"} per family`) || "N/A")
                  : "N/A")
              : profile.sharedRate}
            soloRate={profile.hasFamily
              ? formatSoloRate(profile.hourlyBudget) ||
                (profile.soloRate
                  ? `$${profile.soloRate}/${profile.rateType === "weekly" ? "wk" : "hr"}`
                  : "N/A")
              : profile.soloRate}
            rateType={profile.rateType}
            ages={
              !profile.hasFamily ? profile.preferredAges?.length > 0
                ? profile.preferredAges.map((age) => age.label)
                : [] : profile.childrenAges?.length > 0
                ? profile.childrenAges.map((age) => age.label)
                : []
            }
            schedule={profile.specificDays}
            careType={profile.careType || profile.currentSchedule}
            start={profile.startAvailability}
            img={profile.userId?.imageUrl || profile.imageFile}
            name={profile.userId?.name}
            experience={profile?.careExperience}
            distance={profile?.careDistance}
            location={profile.userId?.location}
            created={profile?.createdAt}
            childrenCount={(() => {
              if (profile.numberOfChildren !== undefined) return profile.numberOfChildren;
              let childrenObj = profile.userId?.noOfChildren;
              if (typeof childrenObj === "string") {
                try { childrenObj = JSON.parse(childrenObj); } catch (e) { }
              }
              return childrenObj?.length || 0;
            })()}
            hasFamily={profile.hasFamily}
            whereCare={profile?.whereCare}
          />
        );
      });
  };

  return (
    <div className="flex flex-col w-full mt-6">
      {isRequestSubmitModal && (
        <MatchRequestFormModal
          setIsRequestSubmitModal={setIsRequestSubmitModal}
          senderId={senderId}
          receiverId={receiverId}
          onReferralRequired={() => setIsReferModal(true)}
        />
      )}
      {isProfileComplete && <CompleteProfileModal setIsProfileComplete={setIsProfileComplete} />}
      {isMatchRequestDenied && <RequestMatchDenied setIsMatchRequestDenied={setIsMatchRequestDenied} />}
      {isReferModal && <ReferAFriendModal onClose={() => setIsReferModal(false)} />}
      {isShareModal && <ShareProfileModal onClose={() => setIsShareModal(false)} />}

      {/* Your Profile Section — only on the first page */}
      {currentPage === 1 && (
        <>
          <div className="flex justify-between items-center flex-wrap gap-3 mb-6">
            <h1 className="Livvic-Bold text-2xl text-[#0D134C]">Your Profile</h1>

            {/* Share Profile — offered to all four share types, and sited next
                to the card it publishes so it's obvious what gets shared. Hidden
                until a profile exists, since there'd be nothing behind the link;
                the "complete your profile" prompt on the card covers that case. */}
            {currentProfile && (
              <button
                onClick={() => setIsShareModal(true)}
                className="flex items-center gap-2 bg-white border border-[#AEC4FF] text-primary Livvic-SemiBold text-sm rounded-full px-4 py-2 shadow-sm transition-colors hover:bg-[#AEC4FF]/20"
              >
                <Share2 size={16} />
                Share Profile
              </button>
            )}
          </div>
          {renderCurrentProfile()}
        </>
      )}

      {/* Results Section */}
      <div className="flex justify-between items-center flex-wrap gap-3 mt-6">
        <h1 className="Livvic-Bold text-2xl text-[#0D134C]">Available Profiles</h1>

        {/* Filters — small screens only, where the drawer is collapsed. Sited
            next to the heading it acts on, and styled as the sibling of the
            "Share Profile" button above, so the two headers read as a pair. */}
        {onOpenFilters && (
          <button
            onClick={onOpenFilters}
            aria-label="Open filters"
            className="lg:hidden flex items-center gap-2 bg-white border border-[#AEC4FF] text-primary Livvic-SemiBold text-sm rounded-full px-4 py-2 shadow-sm transition-colors hover:bg-[#AEC4FF]/20"
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 mt-6">
        {renderProfiles()}
      </div>

      {/* Pagination */}
      <div className="mt-6 w-full flex justify-end">
        {!isProfilesLoading && data?.length !== 0 && (
          <div className="flex items-center space-x-4">
            <p className="Livvic-Medium text-sm">
              Showing {startItem}-{endItem} from {total}
            </p>
            <Pagination
              className="Livvic-Medium"
              current={currentPage}
              pageSize={pageSize}
              total={total - 1}
              onChange={handlePageChange}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}