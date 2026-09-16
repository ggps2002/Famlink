import React, {
  useEffect,
  useState,
  useCallback
} from "react";

import {
  useDispatch,
  useSelector
} from "react-redux";

import {
  getOutgoingRequestsThunk
} from "@features/matching/store/matchSlice";

import Loader from "@shared/ui/Loader";
import {
  FamilyProfile,
  NannyProfile
} from "@features/nanny-share/components/profileCard";
import { MatchRequestSuccessModal } from "@features/matching/components/MatchSuccessModal";
import { formatSharedRate } from "@shared/lib/rates";

const OutgoingRequests = () => {
  const dispatch = useDispatch();

  const {
    outgoingMatches: matches,
    isMatchLoading,
    outgoingPagination
  } = useSelector(
    (state) => state.matchRequest
  );

  const hasMore = outgoingPagination?.hasMore;

  const [page, setPage] = useState(1);
  const [isRequestMatchSuccessModal, setIsRequestMatchSuccessModal] = useState(false);
  const [chatUserId, setChatUserId] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    dispatch(
      getOutgoingRequestsThunk({
        page: 1,
        limit: 10
      })
    )
      .unwrap()
      .catch(() => {})
      .finally(() => setHasFetched(true));
  }, [dispatch]);

  const handleScroll = useCallback(() => {
    const scrollTop =
      window.scrollY;

    const windowHeight =
      window.innerHeight;

    const documentHeight =
      document.documentElement
        .scrollHeight;

    if (
      scrollTop + windowHeight >=
      documentHeight - 200 &&
      !isMatchLoading &&
      hasMore
    ) {
      setPage(prev => prev + 1);
    }
  }, [
    isMatchLoading,
    hasMore
  ]);

  useEffect(() => {
    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, [handleScroll]);

  useEffect(() => {
    if (page > 1) {
      dispatch(
        getOutgoingRequestsThunk({
          page,
          limit: 10
        })
      );
    }
  }, [page, dispatch]);

  return (
    <div>
      {isRequestMatchSuccessModal && (
        <MatchRequestSuccessModal
          setIsRequestMatchSuccessModal={setIsRequestMatchSuccessModal}
          chatUserId={chatUserId}
        />
      )}

      {isMatchLoading && <Loader />}

      {hasFetched && !isMatchLoading && matches?.length === 0 && (
        <p className="text-center py-5">No sent requests</p>
      )}

      {matches?.map((profile) =>
        profile.userId?.type ===
          "Parents" ? (
          <FamilyProfile
            key={profile._id}
            id={profile._id}
            matchId={profile.matchId}
            status={profile.status}
            requestType={profile.requestType}
            setChatUserId={setChatUserId}
            setMatchRequestSuccessModal={setIsRequestMatchSuccessModal}
            userId={profile.userId?._id}
            name={profile.userId?.name}
            imgUrl={profile.userId?.imageUrl}
            careType={profile.nannyShareType}
            schedule={profile.specificDays}
            location={profile.userId?.location}
            hosting={profile.hostingPreference}
            hasNanny={profile.hasNanny}
            start={profile.nannyshareStart}
            shareLocation={profile.shareLocation.length < 2 ? profile.shareLocation : "flexible location"}
            sharedRate={formatSharedRate(profile.hourlyBudget) || "N/A"}
            ages={profile.childrenAges}
          />
        ) : (
          <NannyProfile
            key={profile._id}
            id={profile._id}
            matchId={profile.matchId}
            status={profile.status}
            requestType={profile.requestType}
            setChatUserId={setChatUserId}
            setMatchRequestSuccessModal={setIsRequestMatchSuccessModal}
            userId={profile.userId?._id}
            sharedRate={profile.sharedRate}
            soloRate={profile.soloRate}
            rateType={profile.rateType}
            ages={profile.preferredAges}
            schedule={profile.specificDays}
            careType={profile.careType}
            start={profile.startAvailability}
            // type={profile.userId?.type}
            goal={profile.userId?.goal}
            img={profile.imageFile}
            name={profile.userId?.name}
            // bio={profile?.bio}
            experience={profile?.careExperience}
            distance={profile?.careDistance}
            // roles={profile?.responsibilities}
            location={profile.userId?.location}
            created={profile?.createdAt}
          />
        )
      )}

      {!hasMore &&
        matches?.length > 0 && (
          <p className="text-center py-5">
            No more profiles
          </p>
        )}
    </div>
  );
};

export default OutgoingRequests;