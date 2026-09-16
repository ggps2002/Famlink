import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import Loader from "@shared/ui/Loader";
import { Avatar } from "antd";
import { formatCreatedAt, formatStartDate, formatTimeRange } from "@shared/lib/dates";
import { Calendar, Clock } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import { fetchNannyShareByIdThunk } from "@features/nanny-share/store/nannyShareSlice";
import Header from "@features/nanny-share/search/Header";
import Footer from "@app/layout/Footer";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { formatCareTypeLabel } from "@shared/lib/scheduleFormat";

function formatLocation(loc) {
  if (!loc?.format_location) return "Neighborhood";
  const parts = loc.format_location.split(",") || [];
  const neighborhood = parts.at(-4)?.trim();
  const city = parts.at(-3)?.trim();
  const state = parts.at(-2)?.trim().split(" ")[0];

  return city && state && neighborhood
    ? `${city}, ${state}`
    : "Neighborhood";
}

const formatAge = (age) => {
  const numAge = parseFloat(age);

  if (numAge < 1) {
    const months = Math.round(numAge * 12);
    return `${months} month${months > 1 ? "s" : ""}`;
  }

  return `${numAge} year${numAge > 1 ? "s" : ""}`;
};

function ViewProfileDetails() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, isLoading } = useSelector((state) => state.postNannyShare);


  useEffect(() => {
    dispatch(fetchNannyShareByIdThunk(id));
  }, [dispatch, id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const title = `${formatLocation(data.user?.location)}`;

  return (
    <>
      {/* Individual profiles are noindex — they're dynamic and privacy-sensitive. */}
      <SEOMetaData
        title="Nanny Share Profile | FamLink"
        description="View a nanny share profile on FamLink and connect with local families and caregivers."
        noIndex
      />
      <div className="Livvic container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <Header />
      </div>

      <div className="padding-navbar1 w-full flex flex-col items-center">
        {isLoading ? (
          <Loader />
        ) : (
          <div className="relative min-h-screen w-full flex flex-col items-center space-y-4 py-2">

            {/* Main */}
            <div className="w-full flex flex-col items-center space-y-4 py-2">

              {/* Header Card */}
              <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
                <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between md:items-center">
                  <h1 className="Livvic-SemiBold text-2xl text-primary">
                    {title}
                  </h1>

                  <div className="flex gap-2">
                    {data?.urgency && (
                      <div className="py-2 px-4 rounded-full bg-[#D6F7FF] Livvic-SemiBold text-sm">
                        {data.urgency === "urgent – i need care soon"
                          ? "Urgent"
                          : data.urgency}
                      </div>
                    )}

                    <div className="py-2 px-4 rounded-full bg-[#ECF1FF] Livvic-SemiBold text-sm">
                      {formatCareTypeLabel(data?.nannyShareType) || "Not specified"}
                    </div>
                  </div>
                </div>

                {/* Seasonal */}
                {data?.Seasonal?.startDate && data?.Seasonal?.endDate && (
                  <p className="Livvic-Medium flex gap-4 text-sm text-[#555555]">
                    <Clock className="w-5 h-5" />
                    {`${new Date(data.Seasonal.startDate).toLocaleDateString()} – ${new Date(data.Seasonal.endDate).toLocaleDateString()}`}
                  </p>
                )}

                {/* Children */}
                {data?.numberOfChildren > 0 && (
                  <p className="Livvic-Medium flex gap-4 text-sm text-[#555555]">
                    <img src="/care-person.svg" alt="nanny" />
                    {data.numberOfChildren} kids (
                    {data.childrenAges?.map(formatAge).join(", ")})
                  </p>
                )}

                {/* Created */}
                <p className="Livvic-Medium flex gap-4 text-sm text-[#555555]">
                  <Calendar className="w-5 h-5" />
                  {formatCreatedAt(data.createdAt)}
                </p>

                {/* User */}
                <p className="Livvic-Medium flex gap-4 text-sm text-[#222222]">
                  <Avatar size={24} src={data.user?.imageUrl}>
                    {!data.user?.imageUrl &&
                      data.user?.name
                        ?.split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                  </Avatar>
                  {data?.user?.name}
                </p>
              </div>

              {/* Budget & Communication */}
              <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
                <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                  Budget & Communication
                </h1>

                <div className="text-sm text-gray-700 space-y-2">

                  {(data.communicationPreference || data.communicationSpecify) && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Communication Preference
                      <span className="Livvic-SemiBold">
                        {`: ${data.communicationPreference}${data.communicationSpecify
                          ? `, ${data.communicationSpecify} (specified)`
                          : ""
                          }`}
                      </span>
                    </p>
                  )}

                  {(data.backupCare || data.backupCareSpecify) && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Backup Care
                      <span className="Livvic-SemiBold">
                        {`: ${data.backupCare}${data.backupCareSpecify
                          ? `, ${data.backupCareSpecify} (specified)`
                          : ""
                          }`}
                      </span>
                    </p>
                  )}

                  {data.involvementLevel && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Involvement
                      <span className="Livvic-SemiBold">
                        {`: ${data.involvementLevel}`}
                      </span>
                    </p>
                  )}

                  {/* The per-family share only — a family quotes what they pay,
                      never a standalone rate for the caregiver. */}
                  {data.hourlyBudget?.minShare && (
                    <div className="space-y-2">
                      <p>
                        • Share:{" "}
                        <span className="Livvic-SemiBold">{`$${data.hourlyBudget.minShare}${data.hourlyBudget.maxShare ? ` – $${data.hourlyBudget.maxShare}` : '+'}/hr per family`}</span>
                      </p>
                    </div>
                  )}

                  {data.hourlyBudgetSpecify && (
                    <p>
                      • My share (specified):{" "}
                      <span className="Livvic-SemiBold">
                        ${data.hourlyBudgetSpecify}/hr
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
                <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                  Details
                </h1>

                <div className="text-sm text-gray-700 space-y-2">
                  <p className="text-[#555555] Livvic-Medium">
                    • Schedule Flexibility
                    <span className="text-[#555555] Livvic-SemiBold">
                      {data.flexibility ? `: ${data.flexibility}` : ""}
                    </span>
                  </p>

                  <p className="text-[#555555] Livvic-Medium">
                    • Hosting
                    <span className="text-[#555555] Livvic-SemiBold">
                      {data.hostingPreference ? `: ${data.hostingPreference}` : ""}
                    </span>
                  </p>

                  {data.hasNanny && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Have a Nanny
                      <span className="text-[#555555] Livvic-SemiBold">
                        {data.hasNanny ? `: ${data.hasNanny}` : ""}
                      </span>
                    </p>
                  )}

                  {/* Open to share */}
                  {Array.isArray(data?.shareLocation) && data?.shareLocation?.length > 0 && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Open to share:
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.shareLocation.map((loc, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {loc === "near my workplace"
                              ? data.specifyNearbyWorkplace
                                ? `${loc} (${data.specifyNearbyWorkplace})`
                                : loc
                              : loc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.nannyshareStart && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Nanny Share Start
                      {/* `capitalize` matches the profile card, so the legacy
                          free-text values ("in 1–3 months") read the same in
                          both places. Formatted dates are unaffected. */}
                      <span className="text-[#555555] Livvic-SemiBold capitalize">
                        {`: ${formatStartDate(data.nannyshareStart)}`}
                      </span>
                    </p>
                  )}

                  {data.urgency && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Urgency
                      <span className="text-[#555555] Livvic-SemiBold">
                        {data.urgency ? `: ${data.urgency}` : ""}
                      </span>
                    </p>
                  )}

                  {data.childrenSchools && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Children Schools
                      <span className="text-[#555555] Livvic-SemiBold">
                        {`: ${data.childrenSchools}`}
                      </span>
                    </p>
                  )}

                  {/* Allergies */}
                  {data.allergiesHealth?.length > 0 && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Allergies
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.allergiesHealth.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                        {data.allergiesHealthSpecify && (
                          <span className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs">
                            {data.allergiesHealthSpecify} (specified)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Responsibilities */}
                  {data.childResponsibilities?.length > 0 && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Responsibilities
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.childResponsibilities.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Household AddOns */}
                  {data.householdAddOns?.length > 0 && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Household AddOns
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.householdAddOns.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parenting Style */}
                  {(data.parentingStyle?.length > 0 || data.parentingStyleSpecify) && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Parenting Style
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.parentingStyle?.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                        {data.parentingStyleSpecify && (
                          <span className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs">
                            {data.parentingStyleSpecify} (specified)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* House Rules */}
                  {(data.houseRules?.length > 0 || data.houseRulesSpecify) && (
                    <div className="text-[#555555] Livvic-Medium">
                      • House Rules
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.houseRules?.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                        {data.houseRulesSpecify && (
                          <span className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs">
                            {data.houseRulesSpecify} (specified)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Daily Routine */}
                  {data.dailyRoutine?.length > 0 && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Daily Routine
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.dailyRoutine.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pets */}
                  {(data.pets?.length > 0 || data.petsSpecify) && (
                    <div className="text-[#555555] Livvic-Medium">
                      • Pets
                      <div className="ml-4 mt-1 flex flex-wrap gap-2">
                        {data.pets?.map((item, i) => (
                          <span
                            key={i}
                            className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs"
                          >
                            {item}
                          </span>
                        ))}
                        {data.petsSpecify && (
                          <span className="px-2 py-[2px] border border-gray-300 rounded-full w-fit text-[#555555] Livvic-SemiBold text-xs">
                            {data.petsSpecify} (specified)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px]">
                <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                  Schedule
                </h1>

                {data?.specificDays &&
                  Object.entries(data.specificDays).map(([day, time], i) => (
                    <div key={i}>
                      <p className="Livvic-SemiBold text-[#555555]">• {day}</p>
                      <p className="Livvic-Medium text-[#666666]">
                        {formatTimeRange(time.start, time.end)}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Description */}
              {data?.careDescription && (
                <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px]">
                  <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                    Care Description
                  </h1>
                  <p className="text-[#555555] text-sm">
                    {data.careDescription}
                  </p>
                </div>
              )}

              {/* Open Notes */}
              {data?.openNotes && (
                <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px]">
                  <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                    Open Note for Family
                  </h1>
                  <p className="text-[#555555] text-sm">
                    {data.openNotes}
                  </p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex gap-2 mt-4">
              <CustomButton
                btnText={"Join to Contact"}
                action={() => navigate("/joinNow")}
                className="bg-[#AEC4FF]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Footer />
      </div>
    </>
  );
}

export default ViewProfileDetails;