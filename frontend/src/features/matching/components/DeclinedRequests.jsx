import React, { useState } from "react";
import Loader from "@shared/ui/Loader";
import { FamilyProfile, NannyProfile } from "@features/nanny-share/components/profileCard";
import { MatchRequestSuccessModal } from "@features/matching/components/MatchSuccessModal";
import { formatSharedRate } from "@shared/lib/rates";

const DeclinedRequests = ({ matches, isMatchLoading, hasFetched }) => {
  const [isRequestMatchSuccessModal, setIsRequestMatchSuccessModal] = useState(false);
  const [chatUserId, setChatUserId] = useState(null);

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
        <p className="text-center py-5">No declined profiles</p>
      )}

      {matches?.map((profile) =>
        profile.userId?.type === "Parents" ? (
          <FamilyProfile
            key={profile._id}
            id={profile._id}
            matchId={profile.matchId}
            status={profile.status}
            userId={profile.userId?._id}
            setChatUserId={setChatUserId}
            setMatchRequestSuccessModal={setIsRequestMatchSuccessModal}
            requestType={profile.requestType}
            name={profile.userId?.name}
            imgUrl={profile.userId?.imageUrl}
            careType={profile.nannyShareType}
            schedule={profile.specificDays}
            location={profile.userId?.location}
            hosting={profile.hostingPreference}
            hasNanny={profile.hasNanny}
            start={profile.nannyshareStart}
            shareLocation={
              profile.shareLocation.length < 2
                ? profile.shareLocation
                : "flexible location"
            }
            sharedRate={formatSharedRate(profile.hourlyBudget) || "N/A"}
            ages={(() => {
              if (profile.childrenAges && profile.childrenAges.length > 0) {
                return profile.childrenAges.map((age) => age.label);
              }
              return [];
            })()}
            childrenCount={(() => {
              if (profile.numberOfChildren !== undefined)
                return profile.numberOfChildren;
              let childrenObj = profile.userId?.noOfChildren;
              if (typeof childrenObj === "string") {
                try { childrenObj = JSON.parse(childrenObj); } catch (e) {}
              }
              return childrenObj?.length || 0;
            })()}
          />
        ) : (
          <NannyProfile
            key={profile._id}
            id={profile._id}
            matchId={profile.matchId}
            status={profile.status}
            userId={profile.userId?._id}
            setMatchRequestSuccessModal={setIsRequestMatchSuccessModal}
            requestType={profile.requestType}
            sharedRate={profile.sharedRate}
            setChatUserId={setChatUserId}
            soloRate={profile.soloRate}
            rateType={profile.rateType}
            ages={profile.preferredAges}
            schedule={profile.specificDays}
            careType={profile.careType}
            start={profile.startAvailability}
            goal={profile.userId?.goal}
            img={profile.imageFile}
            name={profile.userId?.name}
            experience={profile?.careExperience}
            distance={profile?.careDistance}
            location={profile.userId?.location}
            created={profile?.createdAt}
          />
        )
      )}
    </div>
  );
};

export default DeclinedRequests;