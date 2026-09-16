import React from "react";

// eslint-disable-next-line react/prop-types
const CustomStepper = ({ totalSteps, currentStep }) => {
  if (totalSteps < 1) return null;

  return (
    <div className="w-full flex justify-center items-center">
      <div className="relative flex items-center justify-between w-full">
        {/* Background line */}
        <div className="absolute lg:h-2 h-1 bg-[#eaeaea] w-full"></div>

        {/* Active progress line */}
        <div
          className="absolute lg:h-2 h-1 bg-[#AEC4FF] transition-all duration-300"
          style={{ width: `${(currentStep / (totalSteps)) * 100}%` }}
        ></div>

        {/* Step circles */}
        {Array.from({ length: totalSteps+1 }, (_, index) => (
          <div
            key={index}
            className="relative z-10 flex flex-col items-center"
          >
            <div
              className={`lg:size-5 size-3 rounded-full flex items-center justify-center ${
                index <= currentStep ? "bg-[#AEC4FF] border-none" : "bg-white"
              } border-2 border-[#eaeaea]`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomStepper;
