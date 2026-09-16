import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import Loader from "@shared/ui/Loader";
import { Avatar } from "antd";
import { formatCreatedAt, formatTimeRange } from "@shared/lib/dates";
import { MapPin, Calendar, Clock } from "lucide-react";
import {
  deleteNannyShareThunk,
  fetchNannyShareByIdThunk,
} from "@features/nanny-share/store/nannyShareSlice";
import { SwalFireDelete } from "@shared/ui/swalFire";
import { Card, Tag, Spin } from "antd";
import { createChatThunk } from "@features/chat/store/chatSlice";
import { fireToastMessage } from "@shared/ui/toast";
import CustomButton from "@shared/ui/Button";
import { getSubscriptionStatusThunk } from "@features/subscription/store/cardSlice";
import { formatStartDate } from "@shared/lib/dates";
import { formatCareTypeLabel } from "@shared/lib/scheduleFormat";

function formatLocation(loc) {
  if (!loc?.format_location) return "Neighborhood";
  const parts = loc.format_location.split(",") || [];
  const neighborhood = parts.at(-4)?.trim();
  const city = parts.at(-3)?.trim();
  const state = parts.at(-2)?.trim().split(" ")[0];
  return city && state && neighborhood
    ? ` ${city}, ${state}`
    : "Neighborhood";
}

function NannyShareDetails() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { data, isLoading } = useSelector((state) => state.postNannyShare);
  const title = `${formatLocation(data.user?.location)}`;

  useEffect(() => {
    dispatch(fetchNannyShareByIdThunk(id));
  }, [dispatch, id]);

  const subscription = useSelector(
    (state) => state.cardData.subscriptionStatus,
  );
  const isSubscribed = subscription?.active;

  useEffect(() => {
    dispatch(getSubscriptionStatusThunk());
  }, [dispatch]);

  const handleDeleteClick = () => {
    const handleDelete = async () => {
      try {
        await dispatch(deleteNannyShareThunk(id));
        fireToastMessage({ message: "Nanny Share job deleted successfully" });
        navigate("/family/nannyShare");
      } catch (err) {
        fireToastMessage({ type: "error", message: err.message });
      }
    };
    SwalFireDelete({
      title: "Are you sure for delete this nanny share job",
      handleDelete,
    });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleMessage = async () => {
    try {
      const participants = [data?.user?._id, user._id];
      const { status } = await dispatch(
        createChatThunk({ participants }),
      ).unwrap();
      if (status === 201 || status === 200) {
        navigate(`/family/message/`);
      }
    } catch (error) {
      // console.log(error);
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  return (
    <div className="padding-navbar1 w-full flex flex-col items-center">
      {isLoading ? (
        <Loader />
      ) : (
        <div className="relative min-h-screen padding-navbar1 w-full flex flex-col items-center space-y-4 py-2">
          <div className="w-full flex flex-col items-center space-y-4 pt-2 pb-12">
            <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
              <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between md:items-center">
                <h1 className="Livvic-SemiBold text-2xl text-primary">
                  {title}
                </h1>
                <div className="flex gap-2">
                  {data?.urgency && <div className="py-2 px-4 rounded-full bg-[#D6F7FF] Livvic-SemiBold text-sm w-fit">
                    {data?.urgency === "urgent – i need care soon" ? "Urgent" : data?.urgency}
                  </div>}
                  <div className="py-2 px-4 rounded-full bg-[#ECF1FF] Livvic-SemiBold text-sm w-fit">
                    {formatCareTypeLabel(data?.nannyShareType) || "Not specified"}
                  </div>
                </div>
              </div>
              {data.Seasonal?.startDate && data.Seasonal?.endDate && (
                <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
                  <Clock className="w-5 h-5" />
                  {`${new Date(data.Seasonal.startDate).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })} – ${new Date(data.Seasonal.endDate).toLocaleDateString(
                    [],
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}`}
                </p>
              )}
              {data?.numberOfChildren > 0 && (
                <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
                  <img src="/care-person.svg" alt="nanny" />{" "}
                  {data?.numberOfChildren} kids (
                  {data?.childrenAges
                    ?.map((age) => {
                      const numAge = parseFloat(age); // extract number from "0.75 yrs"

                      if (numAge < 1) {
                        const months = Math.round(numAge * 12);
                        return `${months} month${months > 1 ? "s" : ""}`;
                      }

                      return `${numAge} year${numAge > 1 ? "s" : ""}`;
                    })
                    .join(", ")}
                  )
                </p>
              )}
              {/* <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
              <Calendar className="w-5 h-5" />{" "}
              {formatCreatedAt(data.createdAt)}
            </p> */}
              <p className="Livvic-Medium items-center text-sm text-[#222222] flex gap-4">
                <Avatar size={24} src={data.user?.imageUrl} style={{ backgroundColor: '#AEC4FF', color: '#001243', fontWeight: 'bold' }}>
                  {!data.user?.imageUrl &&
                    data.user?.name
                      ?.split(" ")
                      .map((word) => word[0])
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
                {(data.communicationPreference ||
                  data.communicationSpecify) && (
                    <p className="text-[#555555] Livvic-Medium">
                      • Communication Preference
                      <span className="text-[#555555] Livvic-SemiBold">
                        {`: ${data.communicationPreference}, ${data.communicationSpecify
                          ? `${data.communicationSpecify} (specified)`
                          : ""
                          }`}
                      </span>
                    </p>
                  )}
                {(data.backupCare || data.backupCareSpecify) && (
                  <p className="text-[#555555] Livvic-Medium">
                    • Backup Care
                    <span className="text-[#555555] Livvic-SemiBold">
                      {`: ${data.backupCare}, ${data.backupCareSpecify
                        ? `${data.backupCareSpecify} (specified)`
                        : ""
                        }`}
                    </span>
                  </p>
                )}
                {data.involvementLevel && (
                  <p className="text-[#555555] Livvic-Medium">
                    • Involvement
                    <span className="text-[#555555] Livvic-SemiBold">{`: ${data.involvementLevel}`}</span>
                  </p>
                )}

                {data.hourlyBudget && (
                  <div className="text-[#555555] Livvic-Medium space-y-2">
                    {/* The per-family share only. `min`/`max` beside it is the
                        caregiver's full rate for the whole share — not a rate
                        this family sets, and not one their listing should quote. */}
                    {data.hourlyBudget.minShare && (
                      <p className="text-[#555555] Livvic-Medium">
                        • Share:{" "}
                        <span className="Livvic-SemiBold">{`$${data.hourlyBudget.minShare}${data.hourlyBudget.maxShare ? ` – $${data.hourlyBudget.maxShare}` : '+'}/hr per family`}</span>
                      </p>
                    )}
                    {data.hourlyBudgetSpecify && (
                      <p className="text-[#555555] Livvic-Medium">
                        • My share (specified):{" "}
                        <span className="Livvic-SemiBold">{`$${data.hourlyBudgetSpecify}/hr`}</span>
                      </p>
                    )}
                  </div>
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
            <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
              <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                Schedule
              </h1>
              {data?.specificDays &&
                Object.entries(data.specificDays).map(([day, time], idx) => (
                  <div key={idx}>
                    <p className="text-[#555555] Livvic-SemiBold">• {day}</p>
                    <p className="text-[#666666] Livvic-Medium">
                      {formatTimeRange(time.start, time.end)}
                    </p>
                  </div>
                ))}
            </div>

            {/* Care Description */}
            {data.careDescription && (
              <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
                <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                  Care Description
                </h1>
                <div className="text-sm text-gray-700 space-y-2">
                  <p className="text-[#555555] Livvic-Medium">
                    {data.careDescription}
                  </p>
                </div>
              </div>
            )}

            {/* Open Note */}
            <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
              <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
                Open Note for Family
              </h1>
              <div className="text-sm text-gray-700 space-y-2">
                {data.openNotes && (
                  <p className="text-[#555555] Livvic-Medium">
                    {data.openNotes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-2 fixed bottom-0 p-4 bg-white w-screen justify-center z-[50]">
            {data?.user?._id !== user._id && (
              <CustomButton
                btnText={"Request Match"}
                action={handleMessage}
                className="bg-[#AEC4FF]"
              />
            )}
            {data?.user?._id === user._id && (
              <>
                <CustomButton
                  btnText={"Delete"}
                  action={handleDeleteClick}
                  className="bg-[#FF8484] text-white"
                />
                <CustomButton
                  btnText={"Edit"}
                  action={() => navigate(`/family/nannyShareEdit/${id}`)}
                  className="text-[#555555] border border-[#EEEEEE]"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NannyShareDetails;
