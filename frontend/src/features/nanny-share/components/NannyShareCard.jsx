import React from "react";
import { EnvironmentOutlined } from "@ant-design/icons";
import { DollarSign, Baby, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

function NannyShareCard({
  _id,
  img,
  name,
  location,
  schedule,
  child,
  description,
  req,
  start,
  profile,
  hourlyBudget,
  shareLocation = [],
}) {
  const navigate = useNavigate();

  const initials = name
    ?.split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const chips = [
    child && {
      icon: <Baby size={16} />,
      text: `Child: ${child}`,
    },
    shareLocation?.length > 0 && {
      icon: <Info size={16} className="relative top-[1px]" />,
      text: `Open to: ${shareLocation.length <= 2
          ? shareLocation.join(", ")
          : "Flexible locations"
        }`,
    },
    hourlyBudget && {
      icon: <DollarSign size={16} />,
      text:
        hourlyBudget?.minShare != null && hourlyBudget?.maxShare != null
          ? `$${hourlyBudget.minShare}–${hourlyBudget.maxShare}/hr per family`
          : `$20+/hr per family`,
    },
  ].filter(Boolean);

  return (
    <div className="onboarding-box w-full sm:w-[400px] min-h-[330px] bg-white space-y-1 relative pb-16">
      {/* Top row: img + pills */}
      <div className="flex justify-between mb-2">
        {img ? (
          <img
            src={img}
            alt={name}
            className="rounded-full w-20 h-20 object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="rounded-full w-20 h-20 flex items-center justify-center flex-shrink-0 text-white text-xl Livvic-SemiBold"
            style={{ backgroundColor: "#AEC4FF" }}
          >
            {initials}
          </div>
        )}

        <div className="space-y-2">
          <div className="rounded-lg w-fit mb-2 py-1 px-4 bg-[#ECF1FF] text-primary Livvic-Medium text-sm">
            {profile}
          </div>
          <div className="rounded-lg w-fit py-1 px-4 bg-[#d6f7ff] text-primary Livvic-Medium text-sm">
            {start}
          </div>
        </div>
      </div>

      {/* Name */}
      <p className="Livvic-SemiBold text-lg text-primary">{name}</p>

      {/* Location */}
      <p className="text-[#555555] Livvic-Medium flex gap-1 mb-0">
        <EnvironmentOutlined className="text-base mr-1" />
        {location}
      </p>

      {/* Chips */}
      <div className="space-y-1">
        {chips.map((chip, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-[#555555] shrink-0 mt-[2px]">{chip.icon}</span>
            <span className="text-[#555555] Livvic-Medium text-sm">{chip.text}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      <p className="text-[#555555] text-sm">
        {description?.length > 120
          ? `${description.slice(0, 120)}...`
          : description}
      </p>
    </div>
  );
}

export default NannyShareCard;