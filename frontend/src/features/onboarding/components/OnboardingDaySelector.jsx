import React from "react";
import { Checkbox, TimePicker } from "antd";

function OnboardingDaySelector({ daysState, setDaysState, head, subHead }) {
  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Handle individual day checkbox change
  const handleCheckboxChange = (day) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        checked: !prevState[day].checked,
      },
    }));
  };

  // Handle time picker changes
  const handleTimeChange = (day, field, time) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        [field]: time,
      },
    }));
  };

  // Handle "Select All" functionality
  const handleSelectAllChange = () => {
    const selectAll = !Object.values(daysState).some((day) => day.checked);
    setDaysState((prevState) => {
      const newState = {};
      daysOfWeek.forEach((day) => {
        newState[day] = {
          ...prevState[day],
          checked: selectAll,
        };
      });
      return newState;
    });
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-4">
        {daysOfWeek.map((day) => (
          <div className="flex mb-4" key={day}>
            <div className="p-4 border border-[#EEEEEE] rounded-[10px]">
              <Checkbox
                checked={daysState[day]?.checked || false}
                onChange={() => handleCheckboxChange(day)}
                className="mr-4"
              >
                <span className="Livvic-SemiBold text-lg">{day}</span>
              </Checkbox>
              <hr className="my-2 -mx-4" />
              <div className="flex items-center gap-4 mt-2">
                <TimePicker
                  value={daysState[day].start}
                  placeholder="Start"
                  onSelect={(time) => handleTimeChange(day, "start", time)} // works immediately
                  onChange={(time) => handleTimeChange(day, "start", time)} // fallback
                  disabled={!daysState[day].checked}
                  format="h:mm A"
                  needConfirm={false} // AntD v5 only
                  className="rounded-lg border-none"
                />
                <span className="w-px -mt-2 -mb-4 bg-[#EEEEEE] self-stretch block"></span>
                <TimePicker
                  value={daysState[day].end}
                  placeholder="End"
                  onSelect={(time) => handleTimeChange(day, "end", time)}
                  onChange={(time) => handleTimeChange(day, "end", time)}
                  disabled={!daysState[day].checked}
                  format="h:mm A"
                  needConfirm={false}
                  className="rounded-lg border-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="cursor-pointer" onClick={handleSelectAllChange}>
        Select all that apply
      </p>
    </div>
  );
}

export default OnboardingDaySelector;
