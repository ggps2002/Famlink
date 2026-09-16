import React, { useState, useEffect } from "react";
import { Slider } from "antd";
import { useSelector } from "react-redux";

export default function FilterSliders({
  onLocationChange,
  onPriceChange,
  onAvailabilityChange,
  onCareChange,
  onServicesChange,
  onStartChange,
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
  const careOptionsMap = {
    "0-12m old": "Newborns (0-12 months)",
    "1-3yr old": "Toddlers (1-3 years)",
    "3-5yr old": "Preschoolers (3-5 years)",
    "5-12yr old": "School-age (5-12 years)",
    "12+yr old": "Teenagers (12+ years)",
  };
  // State for selected values
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [selectedStart, setSelectedStart] = useState([]);
  const [selectedCare, setSelectedCare] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);

  // Notify parent when values change
  useEffect(() => {
    onLocationChange(locationValue);
  }, [locationValue, onLocationChange]);

  useEffect(() => {
    onPriceChange(priceValue);
  }, [priceValue, onPriceChange]);

  useEffect(() => {
    onAvailabilityChange(selectedAvailability);
  }, [selectedAvailability, onAvailabilityChange]);

  useEffect(() => {
    onStartChange(selectedStart);
  }, [selectedStart, onStartChange]);

  useEffect(() => {
    onCareChange(selectedCare);
  }, [selectedCare, onCareChange]);

  useEffect(() => {
    onServicesChange(selectedServices);
  }, [selectedServices, onServicesChange]);

  // Toggle selection with smooth transition for any category
  const toggleSelection = (category, value) => {
    switch (category) {
      case "availability":
        setSelectedAvailability((prev) =>
          prev.includes(value)
            ? prev.filter((item) => item !== value)
            : [...prev, value]
        );
        break;
      case "care":
        const actualValue = careOptionsMap[value];
        setSelectedCare((prev) =>
          prev.includes(actualValue)
            ? prev.filter((item) => item !== actualValue)
            : [...prev, actualValue]
        );
        break;
      case "start":
        setSelectedStart((prev) =>
          prev.includes(value)
            ? prev.filter((item) => item !== value)
            : [...prev, value]
        );
        break;
      case "services":
        setSelectedServices((prev) =>
          prev.includes(value)
            ? prev.filter((item) => item !== value)
            : [...prev, value]
        );
        break;
      default:
        break;
    }
  };

  // Define a function to apply conditional styling
  const getOptionStyle = (category, value) => {
    const isSelected =
      category === "care"
        ? selectedCare.includes(careOptionsMap[value])
        : category === "availability"
        ? selectedAvailability.includes(value)
        : category === "start"
        ? selectedStart.includes(value)
        : selectedServices.includes(value);

    return {
      background: isSelected ? "#AEC4FF" : "transparent",
      color: isSelected ? "#FFFFFF" : "#666",
      borderColor: isSelected ? "" : "#D6DDEB",
      transition: "all 0.3s ease",
    };
  };

  return (
    <div className="border-[1px] border-[#D6DDEB] bg-white p-4 rounded-2xl h-5/6 filter-width">
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
            background: "#AEC4FF",
          }}
          // handleStyle={{ borderColor: '#FF6B6B' }}
        />
        <p className="Livvic-SemiBold text-[#001243] text-sm">
          Within {locationValue}mi of 50,{" "}
          {user?.location?.format_location
            ? user.location.format_location
            : "Your given location (please add your address in the Edit Profile tab from the menu after clicking your profile picture in the navbar)"}
        </p>
      </div>
      <hr className="border-1 my-4" />

      {/* Price Slider */}
      {user?.type == "Parents" && (
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
              handleStyle={[
                { borderColor: "#FF6B6B" },
                { borderColor: "#FF6B6B" },
              ]}
            />
            <p className="Livvic-SemiBold text-[#001243] text-sm">
              Within ${priceValue[0]} - ${priceValue[1]}/hr
            </p>
          </div>
          <hr className="border-1 my-4" />
        </div>
      )}

      {/* Availability Options */}
      <div>
        <h4 className="onboarding-subHead text-[#001243]">Availability</h4>
        <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
          {[
            "Full-time",
            "Part-time",
            "Flexible",
            "Occasional",
            "Weekends only",
            "Nights only",
          ].map((option) => (
            <p
              key={option}
              onClick={() => toggleSelection("availability", option)}
              style={getOptionStyle("availability", option)} // Pass the correct category here
              className="Livvic-Medium text-[#555555] border border-[#EEEEEE] px-4 py-1 rounded-full cursor-pointer"
            >
              {option}
            </p>
          ))}
        </div>
      </div>
      <hr className="border-1 my-4" />

      {/* Care Options */}
      {user?.type == "Nanny" ? (
        <div>
          <h4 className="onboarding-subHead text-[#001243]">Start</h4>
          <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
            {[
              "ASAP",
              "With in a day",
              "With in a week",
              "With in a month",
              "More than a month",
            ].map((option) => (
              <p
                key={option}
                onClick={() => toggleSelection("start", option)}
                style={getOptionStyle("start", option)} // Pass the correct category here
                className=" px-4 py-1 rounded-3xl Livvic-Medium text-[#555555] border border-[#EEEEEE] cursor-pointer"
              >
                {option}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h4 className="onboarding-subHead text-[#001243]">Care</h4>
          <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
            {Object.keys(careOptionsMap).map((option) => (
              <p
                key={option}
                onClick={() => toggleSelection("care", option)}
                style={getOptionStyle("care", option)}
                className=" px-4 py-1 rounded-3xl Livvic-Medium text-[#555555] border border-[#EEEEEE] cursor-pointer"
              >
                {option}
              </p>
            ))}
          </div>
        </div>
      )}

      <hr className="border-1 my-4" />

      {/* Services Options */}
      <div>
        <h4 className="onboarding-subHead text-[#001243]">Services</h4>
        <div className="flex flex-wrap gap-x-2 gap-y-4 mt-3">
          {[
            "Nanny",
            "Private Educator",
            "Music Instructor",
            "Sports Coach",
            "House Manager",
            "Swim Instructor",
            "Specialized Caregiver",
          ].map((option) => (
            <p
              key={option}
              onClick={() => toggleSelection("services", option)}
              style={getOptionStyle("services", option)} // Pass the correct category here
              className=" px-4 py-1 rounded-3xl Livvic-Medium text-[#555555] border border-[#EEEEEE] cursor-pointer"
            >
              {option}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
