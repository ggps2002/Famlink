import React from "react";
import { EnvironmentOutlined } from "@ant-design/icons";
import { createChatThunk } from "@features/chat/store/chatSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import CustomButton from "@shared/ui/Button";
import { fireToastMessage } from "@shared/ui/toast";
import { DollarSign, Baby, Info, Bookmark, MapPin } from "lucide-react";
import { formatCareTypeLabel } from "@shared/lib/scheduleFormat";

function formatLocation(loc) {
  if (!loc?.format_location) return "Neighborhood";
  const parts = loc.format_location.split(",") || [];
  const neighborhood = parts.at(-4)?.trim();
  const city = parts.at(-3)?.trim();
  const state = parts.at(-2)?.trim().split(" ")[0];
  return city && state && neighborhood ? ` ${city}, ${state}` : "Neighborhood";
}

function NannyShareCard({ share, cta = false }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const handleMessage = async () => {
    try {
      const participants = [share?.user?._id, user._id];
      const { status } = await dispatch(
        createChatThunk({ participants })
      ).unwrap();
      if (status == 201 || status == 200) {
        navigate(`/family/message/`);
      }
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  const chips = [
    share.childrenAges?.length
      ? {
        icon: <Baby />,
        text: `Children: ${share.childrenAges
          .map((age) => {
            const numAge = parseFloat(age);
            if (numAge < 1) {
              const months = Math.round(numAge * 12);
              return `${months} month${months > 1 ? "s" : ""}`;
            }
            return `${numAge} year${numAge > 1 ? "s" : ""}`;
          })
          .join(", ")}`,
      }
      : null,
    share.shareLocation?.length > 0 && {
      icon: <Info />,
      text: `Open to: ${share.shareLocation.length <= 2
        ? share.shareLocation.join(", ")
        : "Flexible locations"
        }`,
    },
    share.hourlyBudget
      ? {
        icon: <DollarSign />,
        text: `$${share.hourlyBudget.minShare}${share.hourlyBudget.maxShare ? `–${share.hourlyBudget.maxShare}` : "+"
          }/hr per family`,
      }
      : {
        icon: <DollarSign />,
        text: `$${share.hourlyBudgetSpecify}/hr`,
      },
  ].filter(Boolean);

  const formattedName = (share.user?.name || "")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  // Normalised rather than looked up: the old table keyed on five slugs the
  // family form used to write, so anything stored by the caregiver side or by
  // the share editor missed every key and fell through to "Other".
  const shareTypeLabel =
    formatCareTypeLabel(share.nannyShareType || share.otherShareTypeSpecify) || "Part-time";

  const blurb =
    share.careDescription?.length > 0
      ? share.careDescription
      : share.openNotes?.length > 0
        ? share.openNotes
        : null;

  const initials = share.user?.name
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="onboarding-box w-full h-[380px] xl:h-[380px] mr-0 xl:mr-9 bg-white relative overflow-hidden p-0">
      <div className="flex flex-row h-full">

        {/* Profile image */}
        <div
          className={`flex-shrink-0 h-full w-[180px] xl:w-[250px] flex items-center justify-center rounded-[14px] overflow-hidden text-white Livvic-SemiBold text-[clamp(18px,4vw,30px)] ${!share.user?.imageUrl ? "bg-[#AEC4FF]" : ""
            }`}
        >
          {share.user?.imageUrl ? (
            <img
              src={share.user.imageUrl}
              alt={formattedName}
              className="w-full h-full object-cover block"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Right content */}
        <div className="flex flex-col justify-between flex-1 min-w-0 relative p-3 sm:p-4">

          {/* Name + Bookmark */}
          <div className="flex items-start justify-between gap-2">
            <p className="Livvic-SemiBold text-primary leading-snug text-base md:text-lg lg:text-xl">
              {formattedName}
            </p>
            <div className="flex gap-2 items-center">
              <div className="rounded-full hidden xl:block bg-[#ECF1FF] text-primary Livvic-SemiBold whitespace-nowrap text-xs md:text-sm lg:text-base px-2 sm:px-3 py-0.5 sm:py-1">
                {shareTypeLabel}
              </div>
              {share.nannyshareStart && (
                <div className="rounded-full hidden xl:block bg-[#d6f7ff] text-primary Livvic-SemiBold whitespace-nowrap text-xs md:text-sm lg:text-base px-2 sm:px-3 py-0.5 sm:py-1">
                  {share.nannyshareStart}
                </div>
              )}
              <Bookmark
                className="cursor-pointer text-[#555555] flex-shrink-0 mt-0.5"
              />
            </div>
          </div>

          {/* Pills */}
          <div className="flex xl:hidden flex-wrap gap-1.5 mt-2">
            <div className="rounded-full bg-[#ECF1FF] text-primary Livvic-SemiBold whitespace-nowrap text-xs md:text-sm lg:text-base px-2 sm:px-3 py-0.5 sm:py-1">
              {shareTypeLabel}
            </div>
            {share.nannyshareStart && (
              <div className="rounded-full bg-[#d6f7ff] text-primary Livvic-SemiBold whitespace-nowrap text-xs md:text-sm lg:text-base px-2 sm:px-3 py-0.5 sm:py-1">
                {share.nannyshareStart}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 my-1">
            <MapPin className="text-[#555555] w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5" />
            <p className="text-[#555555] Livvic-Medium truncate text-sm md:text-base">
              {formatLocation(share.user?.location)}
            </p>
          </div>

          {/* Chips */}
          <div className="flex flex-col gap-1">
            {chips.map((chip, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[#555555] flex-shrink-0 flex items-center">
                  {React.cloneElement(chip.icon, {
                    className: "w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5",
                  })}
                </span>
                <span className="text-[#555555] Livvic-Medium truncate text-sm md:text-base">
                  {chip.text}
                </span>
              </div>
            ))}
          </div>

          {/* Description */}
          {blurb && (
            <div className="">
              <p className="relative mt-2 text-sm md:text-xl  line-clamp-2 lg:line-clamp-3 xl:pl-6 before:content-none xl:before:content-['“'] before:absolute before:left-0 before:top-0 xl:before:text-5xl before:text-[#AEC4FF] before:Livvic-Bold">

                <span className="block mt-0 xl:mt-2 text-[#666666] italic">
                  {blurb.length > 140 ? `${blurb.substring(0, 140)}...` : blurb}
                </span>

              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col xl:flex-row xl:justify-end gap-2 mt-auto justify-start">
            {share?.user?._id !== user._id && !cta && (
              <CustomButton
                btnText="Request Match"
                action={handleMessage}
                className="bg-[#AEC4FF] w-full xl:w-fit !text-sm md:!text-base !px-3 md:!px-5 !py-1.5 md:!py-2"
              />
            )}
            <CustomButton
              btnText="View Details"
              action={() => navigate(`/family/nannyShareView/${share._id}`)}
              className="border w-full xl:w-fit border-[#777777] !text-sm md:!text-base !px-3 md:!px-5 !py-1.5 md:!py-2"
            />
          </div>

        </div>
      </div>
    </div>
  );
}

export default NannyShareCard;