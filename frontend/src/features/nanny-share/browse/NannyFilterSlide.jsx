import React, { useState, useEffect } from "react";
import { Slider } from "antd";
import { useSelector } from "react-redux";
import { MapPin, Clock, Calendar, Home, DollarSign, Star } from "lucide-react";
import { SHARE_TYPE_GOALS } from "@features/nanny-share/shareTypeTheme";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";
import { RATING_FILTER_OPTIONS, ratingFilterHint } from "@shared/lib/ratingFilter";

// Card wrapper + heading with a colored icon (colors mirror the profile-card
// meta-row icons so the whole dashboard reads as one system).
const FilterCard = ({ icon: Icon, iconColor, title, children }) => (
  <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5">
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="flex-shrink-0" style={{ color: iconColor }} />
      <h4 className="text-[17px] font-black text-[#001243] Livvic-Bold tracking-tight">{title}</h4>
    </div>
    {children}
  </div>
);

export default function FilterSlidersJobPost({
  onLocationChange,
  onPriceChange,
  onAvailabilityChange,
  onCareChange,
  maxChildrenChange,
  onServicesChange,
  onRatingChange,
}) {
  const { user } = useSelector((s) => s.auth);
  const budgetRange = user?.additionalInfo
    .find((info) => info.key === "totalBudget")
    ?.value.option.split("to")
    .map((value) => parseFloat(value.trim()));

  const [locationValue, setLocationValue] = useState(5);
  const [priceValue, setPriceValue] = useState(
    budgetRange ? [0, budgetRange[1]] : [0, 50]
  );
  const ageOfChildren = ["Infant", "Toddler", "Preschool", "School-age"];
  const [selectedCare, setSelectedCare] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  // 0 is "Any" — the absence of a filter, not a threshold of zero.
  const [minRating, setMinRating] = useState(0);

  // Push the initial defaults to the parent once on mount (so the results list
  // and the filter UI start from the same values).
  useEffect(() => {
    onLocationChange(locationValue);
    onPriceChange(priceValue);
    onAvailabilityChange(selectedAvailability);
    onCareChange(selectedCare);
    onServicesChange(selectedServices);
    onRatingChange(minRating);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle a value in a multi-select filter and apply it live (no Apply button).
  const toggleAvailability = (value) => {
    const next = selectedAvailability.includes(value)
      ? selectedAvailability.filter((v) => v !== value)
      : [...selectedAvailability, value];
    setSelectedAvailability(next);
    onAvailabilityChange(next);
  };

  const toggleCare = (value) => {
    const next = selectedCare.includes(value)
      ? selectedCare.filter((v) => v !== value)
      : [...selectedCare, value];
    setSelectedCare(next);
    onCareChange(next);
  };

  const toggleShareType = (value) => {
    const next = selectedServices.includes(value)
      ? selectedServices.filter((v) => v !== value)
      : [...selectedServices, value];
    setSelectedServices(next);
    onServicesChange(next);
  };

  const chooseRating = (value) => {
    setMinRating(value);
    onRatingChange(value);
  };

  const getChipClassName = (isSelected) => {
    return `text-[13px] px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
      isSelected
        ? "bg-[#DDE5FF] text-[#001243] font-bold Livvic-Bold border border-transparent"
        : "bg-white text-[#6B7280] font-medium Livvic-Medium border border-[#E5E7EB] hover:bg-gray-50"
    }`;
  };

  return (
    <div className="filter-width flex flex-col gap-4">
      {/* Distance */}
      <FilterCard icon={MapPin} iconColor="#F59E0B" title="Distance">
        <Slider
          min={0}
          max={10}
          value={locationValue}
          onChange={(val) => setLocationValue(val)}
          onChangeComplete={(val) => onLocationChange(val)}
          trackStyle={{ background: "#AEC4FF" }}
        />
        <p className="Livvic-SemiBold text-[#001243] text-sm">
          Within {locationValue}mi of 10mi,{" "}
          {user?.location?.format_location
            ? user.location.format_location
            : "Your given location (please add your address in the Edit Profile tab from the menu after clicking your profile picture in the navbar)"}
        </p>
      </FilterCard>

      {/* Schedule */}
      <FilterCard icon={Clock} iconColor="#6366F1" title="Schedule">
        <div className="flex flex-wrap gap-2">
          {SHARE_SCHEDULES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleAvailability(option)}
              className={getChipClassName(selectedAvailability.includes(option))}
            >
              {option}
            </button>
          ))}
        </div>
      </FilterCard>

      {/* Age of Children */}
      <FilterCard icon={Calendar} iconColor="#3B82F6" title="Age of Children">
        <div className="flex flex-wrap gap-2">
          {ageOfChildren.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleCare(option)}
              className={getChipClassName(selectedCare.includes(option))}
            >
              {option}
            </button>
          ))}
        </div>
      </FilterCard>

      {/* Share Type */}
      <FilterCard icon={Home} iconColor="#F97316" title="Share Type">
        <div className="flex flex-col gap-1.5">
          {Object.values(SHARE_TYPE_GOALS).map((entry) => {
            const isSelected = selectedServices.includes(entry.value);
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => toggleShareType(entry.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-3 ${
                  isSelected
                    ? "bg-[#F4F7FF] text-[#001243] font-bold Livvic-Bold"
                    : "bg-transparent text-[#6B7280] font-medium Livvic-Medium hover:bg-gray-50"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isSelected ? "bg-[#AEC4FF]" : "bg-[#D1D5DB]"}`} />
                <span className="text-[13px] leading-tight">
                  {entry.role} <span className="mx-1 opacity-50">•</span> {entry.goal}
                </span>
              </button>
            );
          })}
        </div>
      </FilterCard>

      {/* Rating */}
      <FilterCard icon={Star} iconColor="#FEA500" title="Rating">
        <div className="flex flex-wrap gap-2">
          {RATING_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseRating(option.value)}
              className={getChipClassName(minRating === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="Livvic-SemiBold text-[#001243] text-sm mt-3">
          {ratingFilterHint(minRating)}
        </p>
      </FilterCard>

      {/* Price */}
      <FilterCard icon={DollarSign} iconColor="#10B981" title="Price">
        <Slider
          range
          min={0}
          max={50}
          value={priceValue}
          onChange={(val) => setPriceValue(val)}
          onChangeComplete={(val) => onPriceChange(val)}
          trackStyle={{ background: "#AEC4FF" }}
        />
        <p className="Livvic-SemiBold text-[#001243] text-sm">
          Within ${priceValue[0]} - ${priceValue[1]}/hr
        </p>
      </FilterCard>
    </div>
  );
}
