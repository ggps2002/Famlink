import React, { useState, useEffect } from "react";
import { Slider } from "antd";
import { useSelector } from "react-redux";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";
import { RATING_FILTER_OPTIONS, ratingFilterHint } from "@shared/lib/ratingFilter";

export default function FilterSlidersNannyShare({
  onLocationChange,
  onPriceChange,
  onCareTypeChange,
  // onAvailabilityChange,
  onCareChange,
  maxChildrenChange,
  onRatingChange,
  // onServicesChange,
  // onStartChange
}) {
  // State for sliders
  const { user } = useSelector((s) => s.auth);
  const budgetRange = user?.additionalInfo
    .find((info) => info.key === "totalBudget")
    ?.value.option.split("to")
    .map((value) => parseFloat(value.trim())); // Convert to numbers and remove any extra spaces

  const [locationValue, setLocationValue] = useState(5); // Location slider
  const [priceValue, setPriceValue] = useState(
    budgetRange ? [0, budgetRange[1]] : [0, 100]
  ); // Price slider
  const ageOfChildren = ["0-1yr old", "1-3yr old", "4-9yr old", "10+yr old"];
  // The same two the caregiver dashboard's "Schedule" card offers. This list
  // used to carry seven, five of them services the product does not run.
  const service = SHARE_SCHEDULES;
  const [selectedCare, setSelectedCare] = useState([]);
  const [selectedCareType, setSelectedCareType] = useState([]);
  // 0 is "Any" — the absence of a filter, not a threshold of zero.
  const [minRating, setMinRating] = useState(0);
  // State for selected values
  // const [selectedAvailability, setSelectedAvailability] = useState([])
  // const [selectedStart, setSelectedStart] = useState([])

  // const [selectedServices, setSelectedServices] = useState([])

  // Notify parent when values change
  useEffect(() => {
    onLocationChange(locationValue);
  }, [locationValue, onLocationChange]);

  useEffect(() => {
    onPriceChange(priceValue);
  }, [priceValue, onPriceChange]);
  useEffect(() => {});
  // useEffect(() => {
  //     onAvailabilityChange(selectedAvailability)
  // }, [selectedAvailability, onAvailabilityChange])

  // useEffect(() => {
  //     onStartChange(selectedStart)
  // }, [selectedStart, onStartChange])

  useEffect(() => {
    onCareChange(selectedCare);
  }, [selectedCare, onCareChange]);

  useEffect(() => {
    onRatingChange(minRating);
  }, [minRating, onRatingChange]);

  useEffect(() => {
    onCareTypeChange(selectedCareType);
  }, [selectedCareType, onCareTypeChange]);

  // useEffect(() => {
  //     onServicesChange(selectedServices)
  // }, [selectedServices, onServicesChange])

  // Toggle selection with smooth transition for any category
  const toggleSelection = (category, value) => {
    switch (category) {
      case "care": {
        const actualValue = value;
        setSelectedCare((prev) =>
          prev.includes(actualValue)
            ? prev.filter((item) => item !== actualValue)
            : [...prev, actualValue]
        );
        break;
      }
      case "careType": {
        const actualValue = value
        setSelectedCareType((prev) =>
          prev.includes(actualValue)
            ? prev.filter((item) => item !== actualValue)
            : [...prev, actualValue]
        );
        break;
      }
      // case 'start':
      //     setSelectedStart(prev =>
      //         prev.includes(value)
      //             ? prev.filter(item => item !== value)
      //             : [...prev, value]
      //     )
      //     break
      // case 'services':
      //     setSelectedServices(prev =>
      //         prev.includes(value)
      //             ? prev.filter(item => item !== value)
      //             : [...prev, value]
      //     )
      //     break
      default:
        break;
    }
  };

  // Define a function to apply conditional styling
  const getOptionStyle = (category, value) => {
    const isSelected = category === "care" && selectedCare.includes(value);
    // : category === 'availability'
    //     ? selectedAvailability.includes(value)
    //     : category === 'start'
    //         ? selectedStart.includes(value)
    //         : selectedServices.includes(value)

    return {
      background: isSelected ? "#AEC4FF" : "transparent",
      color: isSelected ? "#FFFFFF" : "#666",
      borderColor: isSelected ? "" : "#D6DDEB",
      transition: "all 0.3s ease",
    };
  };

  // Define a function to apply conditional styling
  const getTypeOptionStyle = (category, value) => {
    const isSelected = category === "careType" && selectedCareType.includes(value);
    // : category === 'availability'
    //     ? selectedAvailability.includes(value)
    //     : category === 'start'
    //         ? selectedStart.includes(value)
    //         : selectedServices.includes(value)

    return {
      background: isSelected ? "#AEC4FF" : "transparent",
      color: isSelected ? "#FFFFFF" : "#666",
      borderColor: isSelected ? "" : "#D6DDEB",
      transition: "all 0.3s ease",
    };
  };

  return (
    <div className="border border-[#D6DDEB] bg-white p-4 rounded-2xl xl:w-[500px] mt-12 lg:mt-[5rem] xl:mt-16 2xl:mt-0 xl:ml-[4.2rem] relative z-[10000]">
      {/* Location Slider */}
      <div className="">
        <h4 className="onboarding-subHead text-[#001243]">Location</h4>
        <Slider
          className=""
          min={0}
          max={50}
          value={locationValue}
          onChange={setLocationValue}
          trackStyle={{
            background: `#AEC4FF'}`,
          }}
        />
        <p className="Livvic-SemiBold text-[#001243] text-sm">
          Within {locationValue}mi of 50,{" "}
          {user?.location?.format_location
            ? user.location.format_location
            : "Your given location (please add your address in the Edit Profile tab from the menu after clicking your profile picture in the navbar)"}
        </p>
      </div>
      <hr className="border-1 my-4" />
      <div>
        <div>
          <h4 className="onboarding-subHead text-[#001243]">Price</h4>
          <Slider
            className=""
            range
            min={0}
            max={100}
            value={priceValue}
            onChange={setPriceValue}
            trackStyle={{
              background: "#AEC4FF",
            }}
          />
          <p className="Livvic-SemiBold text-[#001243] text-sm">
            Within ${priceValue[0]} - ${priceValue[1]}/hr
          </p>
        </div>
        <hr className="border-1 my-4" />
      </div>

      <div>
        <h4 className="onboarding-subHead text-[#001243]">Rating</h4>
        <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
          {RATING_FILTER_OPTIONS.map((option) => (
            <p
              key={option.value}
              onClick={() => setMinRating(option.value)}
              style={{
                background: minRating === option.value ? "#AEC4FF" : "transparent",
                color: minRating === option.value ? "#FFFFFF" : "#666",
                borderColor: minRating === option.value ? "" : "#D6DDEB",
                transition: "all 0.3s ease",
              }}
              className="Livvic-Medium text-[#555555] border border-[#EEEEEE] px-4 py-1 rounded-full cursor-pointer"
            >
              {option.label}
            </p>
          ))}
        </div>
        <p className="Livvic-SemiBold text-[#001243] text-sm mt-3">
          {ratingFilterHint(minRating)}
        </p>
      </div>
      <hr className="border-1 my-4" />

      <div className="mt-6">
        <h4 className="onboarding-subHead text-[#001243]">
          Number of Children
        </h4>
        <input
          type="number"
          min={1}
          max={10}
          placeholder="Enter number of children"
          className="mt-2 w-full border rounded-full border-[#D6DDEB] px-4 py-2 outline-none focus:ring-2 focus:ring-[#9EDCE1]"
          onChange={(e) => {
            maxChildrenChange(parseInt(e.target.value));
          }}
        />
      </div>
      <hr className="border-1 my-4" />
      {/* Services Options */}
      <div>
        <h4 className="onboarding-subHead text-[#001243]">Age of Children</h4>
        <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
          {ageOfChildren.map((option) => (
            <p
              key={option}
              onClick={() => toggleSelection("care", option)}
              style={getOptionStyle("care", option)}
              className="Livvic-Medium text-[#555555] border border-[#EEEEEE] px-4 py-1 rounded-full cursor-pointer"
            >
              {option}
            </p>
          ))}
        </div>
      </div>

      <hr className="border-1 my-4" />
      {/* Services Options */}
      <div>
        <h4 className="onboarding-subHead text-[#001243]">Nanny Share Type</h4>
        <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
          {service.map((option) => (
            <p
              key={option}
              onClick={() => toggleSelection("careType", option)}
              style={getTypeOptionStyle("careType", option)}
              className="Livvic-Medium text-[#555555] border border-[#EEEEEE] px-4 py-1 rounded-full cursor-pointer"
            >
              {option}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
