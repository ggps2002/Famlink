import { Checkbox, TimePicker } from "antd";
import PropTypes from "prop-types";

export default function HireStep3({ daysState, setDaysState, head, subHead }) {
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
          checked: selectAll, // Apply the new checked state to all
        };
      });
      return newState;
    });
  };

  return (
    <div>
      <p className="Livvic-Bold text-primary text-4xl px-3 text-center mb-5 width-form">
        {head}
      </p>

      <div className="flex justify-center">
        <div>
          <p className="Livvic text-xl my-2 line1-20">{subHead}</p>

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
                    onChange={(time) => handleTimeChange(day, "start", time)}
                    disabled={!daysState[day].checked}
                    format="h:mm A"
                    className="rounded-lg border-none"
                  />
                <span className="w-px -mt-2 -mb-4 bg-[#EEEEEE] self-stretch block"></span>
                  <TimePicker
                    value={daysState[day].end}
                    placeholder="End"
                    onChange={(time) => handleTimeChange(day, "end", time)}
                    disabled={!daysState[day].checked}
                    format="h:mm A"
                    className="rounded-lg border-none"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* {daysOfWeek.map((day) => (
                        <div className="flex justify-center mb-4" key={day}>
                            <div>
                                <Checkbox
                                    checked={daysState[day].checked}
                                    onChange={() => handleCheckboxChange(day)}
                                    className="mr-4"
                                >
                                    <span className='text-2xl'>{day}</span>
                                </Checkbox>

                                <div className="flex items-center gap-4 mt-1 ml-6">
                                    <TimePicker
                                        value={daysState[day].start}
                                        placeholder='Start'
                                        onChange={(time) => handleTimeChange(day, "start", time)}
                                        disabled={!daysState[day].checked}
                                        format="h:mm A" // 12-hour format with AM/PM
                                        className="rounded-lg date-picker"
                                    />
                                    <span className="text-lg">to</span>
                                    <TimePicker
                                        value={daysState[day].end}
                                        onChange={(time) => handleTimeChange(day, "end", time)}
                                        disabled={!daysState[day].checked}
                                        placeholder='End'
                                        format="h:mm A" // 12-hour format with AM/PM
                                        className="rounded-lg date-picker"
                                    />
                                </div>
                            </div>
                        </div>
                    ))} */}
          <p
            className="text-end cursor-pointer"
            onClick={handleSelectAllChange}
          >
            Select all that apply
          </p>
        </div>
      </div>
    </div>
  );
}

HireStep3.propTypes = {
  daysState: PropTypes.objectOf(
    PropTypes.shape({
      checked: PropTypes.bool.isRequired,
      start: PropTypes.any,
      end: PropTypes.any,
    })
  ).isRequired,
  setDaysState: PropTypes.func.isRequired,
  head: PropTypes.node,
  subHead: PropTypes.node,
};
