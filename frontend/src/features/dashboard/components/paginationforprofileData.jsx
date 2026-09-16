import { useEffect, useState } from "react";
import { Pagination } from "antd";
import ProfileCard from "@features/nanny-share/components/profileCard";
import { NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllNanniesThunk } from "@features/dashboard/store/nannyDataSlice";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { fetchAllFamiliesThunk } from "@features/dashboard/store/familyDataSlice";
import Loader from "@shared/ui/Loader";
import CustomButton from "@shared/ui/Button";
// ProfileList component
export default function ProfileList({
  nanny,
  location,
  priceRange,
  availability,
  careOptions,
  services,
  start,
  nannyShare,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const dispatch = useDispatch();
  const data = useSelector((state) =>
    nanny ? state.familyData : state.nannyData
  );
    const subscription = useSelector(
      (state) => state.cardData.subscriptionStatus
    );
    const isSubscribed = subscription?.active;
  const pageSize = 4;
  useEffect(() => {
    const filters = {
      page: currentPage,
      limit: pageSize,
    };

    // Conditionally append filter parameters if they have values
    if (availability?.length > 0) {
      filters.avaiForWorking = availability.join(", ");
    }
    if (location > 0) {
      filters.location = location;
    }
    if (careOptions.length > 0) {
      filters.ageGroupsExp = careOptions.join(", ");
    }
    if (services.length > 0) {
      const camelCaseAvailability = services.map(toCamelCase);
      filters.interestedPosi = camelCaseAvailability.join(", ");
    }
    if (start && start.length > 0) {
      filters.start = start.join(", ");
    }
    if (priceRange[0] >= 0 && priceRange[1] >= 0) {
      filters.salaryRange = priceRange;
    }
    // Dispatch the fetch action with the dynamically built filter object
    nanny
      ? dispatch(fetchAllFamiliesThunk(filters))
      : dispatch(fetchAllNanniesThunk(filters));
  }, [dispatch, currentPage, availability, location, careOptions, services, start, priceRange, nanny]);
  useEffect(() => {
    setCurrentPage(1);
  }, [availability, location, careOptions, services, priceRange]);
  const total = data.pagination.totalRecords;
  const paginatedProfiles = nanny ? data.families : data.nannies; // Use the nannies directly after fetching

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Calculate the range of items being shown (e.g., "Showing 1-08 from 100")
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);
  const { user } = useSelector((s) => s.auth);
  return (
    <div className="flex flex-col w-full px-0 lg:px-4 2xl:px-8">
      <div
        className={
          "flex flex-wrap gap-4"
        }
      >
        {data?.isLoading ? (
          <Loader />
        ) : paginatedProfiles.length > 0 ? (
          <>
            <p className="w-full text-start Livvic-SemiBold text-3xl mb-4">
              {total} Results
            </p>
            {paginatedProfiles.map(
              (profile) =>
                profile._id !== user._id && (
                  <NavLink
                    key={profile._id}
                    to={
                      nannyShare
                        ? `/family/description/${profile._id}`
                        : nanny
                        ? `/nanny/jobDescription/${profile._id}`
                        : `/family/profileNanny/${profile._id}`
                    }
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  >
                    <ProfileCard
                      totalRatings={profile?.reviews?.length}
                      img={profile.imageUrl}
                      averageRating={
                        profile?.reviews?.length
                          ? (
                              profile.reviews.reduce(
                                (sum, r) => sum + r.rating,
                                0
                              ) / profile.reviews.length
                            ).toFixed(1)
                          : 0
                      }
                      time={
                        nanny
                          ? profile?.additionalInfo?.find(
                              (info) => info.key === "preferredSchedule"
                            )?.value?.option
                          : profile?.additionalInfo?.find(
                              (info) => info.key === "avaiForWorking"
                            )?.value?.option || "N/A"
                      }
                      name={profile.name}
                      intro={
                        profile?.additionalInfo.find(
                          (info) => info.key === "jobDescription"
                        )?.value || "N/A"
                      }
                      loc={profile?.location}
                      zipCode={profile?.zipCode}
                      hr={
                        nanny
                          ? Object.keys(
                              profile?.additionalInfo.find(
                                (info) => info.key === "noOfChildren"
                              )?.value || {}
                            ).length
                          : 40
                      }
                      exp={
                        profile?.additionalInfo?.find(
                          (info) => info.key === "experience"
                        )?.value?.option || "N/A"
                      }
                      rate={profile.rate}
                      nanny={nanny}
                    />
                  </NavLink>
                )
            )}
          </>
        ) : (
          <div className="col-span-full text-start text-gray-600">
            <p>No profiles available at the moment. Please check back later.</p>
          </div>
        )}
      </div>

      {/* Ant Design Pagination */}
      <div className="w-full flex items-end justify-end">
        {!data?.isLoading && paginatedProfiles.length != 0 && (
          <div className="flex justify-end mt-6">
            <p
              style={{ color: "#667085" }}
              className="mt-1 mr-4 Livvic-Medium text-sm Quicksand"
            >
              Showing {startItem}-{endItem} from {total}
            </p>
            <Pagination
              className="Livvic-Bold"
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
