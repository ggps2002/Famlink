import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import { fetchPostJobByCurrentUserThunk } from "@features/jobs/store/postJobSlice";
import Loader from "@shared/ui/Loader";
import { formatSentence } from "@shared/lib/toCamelCase";
import { format, isToday, isYesterday, parseISO } from "date-fns";

function formatRelativeTime(dateString) {
  const date = parseISO(dateString);
  if (isToday(date)) {
    return `Today ${format(date, "hh:mmaaa")}`; // e.g. "Today 10:50AM"
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, "hh:mmaaa")}`; // e.g. "Yesterday 10:50AM"
  }
  return format(date, "dd MMM yyyy hh:mmaaa"); // fallback e.g. "11 Jul 2025 10:50AM"
}

function formatJobTitle(jobType) {
  if (!jobType) return "Job Needed";

  const withSpaces = jobType.replace(/([a-z])([A-Z])/g, "$1 $2");
  const capitalized = withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${capitalized} Needed`;
}

const JobListing = () => {
  const dispatch = useDispatch();
  const { data, isLoading } = useSelector((s) => s.jobPost);

  useEffect(() => {
    dispatch(fetchPostJobByCurrentUserThunk());
  }, [dispatch]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="padding-navbar1 min-h-screen">
          <div className="flex lg:my-8 max-lg:mb-8 justify-between items-center">
            <p className="text-3xl Livvic-SemiBold">My Job Listing</p>
            <NavLink
              to={"/family/post-a-job"}
              className="bg-[#AEC4FF]  flex justify-center items-center text-center lg:w-40 lg:h-10 w-28 h-8 lg:text-lg rounded-3xl text-white transition hover:-translate-y-1 duration-700 delay-150 ... ease-in-out hover:scale-110"
            >
              <p className="text-primary Livvic-SemiBold text-sm">Post a Job</p>
            </NavLink>
          </div>
          <div className="flex flex-col gap-4">
            {data && data.length > 0 ? (
              data.map((v) => {
                const formatLocation = () => {
                  const parts =
                    v?.user?.location?.format_location.split(",") || [];
                  const city = parts.at(-3)?.trim();
                  const state = parts.at(-2)?.trim().split(" ")[0];
                  return city && state ? `${city}, ${state}` : "";
                };
                return (
                  <NavLink
                    key={v._id}
                    to={`/family/jobListingView/${v._id}`}
                    className="flex flex-col justify-between"
                  >
                    <div className="onboarding-box">
                      <div className="flex justify-between">
                        <h1 className="onboarding-subHead">
                          {formatJobTitle(v?.jobType)}
                        </h1>
                        <div className="flex gap-2 items-center">
                          {v?.time && (
                            <p
                              style={{ background: "#E7F6FD" }}
                              className="Livvic-SemiBold text-primary bg-primary px-4 py-2 rounded-full text-sm"
                            >
                              {v?.time}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="Livvic text-md text-secondary mt-4">
                        {v?.[v?.jobType]?.jobDescription.length > 300
                          ? `${v?.[v?.jobType]?.jobDescription.substring(
                              0,
                              300
                            )}...`
                          : v?.[v?.jobType]?.jobDescription}
                      </p>
                      <p className="onboarding-form-label mt-4 flex flex-wrap items-center gap-x-2 text-[#555555]">
                        <span className="onboarding-form-label">
                          {v?.[v?.jobType]?.preferredSchedule}
                        </span>
                        <span className="onboarding-form-label">|</span>
                        <span className="onboarding-form-label">
                          {v?.user?.noOfChildren?.length} kids
                        </span>
                        <span className="onboarding-form-label">|</span>
                        <span className="onboarding-form-label">
                          {formatLocation()}
                        </span>
                        <span className="onboarding-form-label">|</span>
                        <span className="onboarding-form-label">
                          {formatRelativeTime(v?.createdAt)}
                        </span>
                      </p>
                    </div>
                  </NavLink>
                );
              })
            ) : (
              <div className="text-center text-gray-500 mt-8 text-lg">
                You have not posted any jobs yet.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default JobListing;
