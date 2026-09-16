import { Checkbox, Input, Modal, Radio, TimePicker } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deletePostJobThunk,
  fetchPostJobByIdThunk,
  updatePostJobThunk,
} from "@features/jobs/store/postJobSlice";
import { useDispatch, useSelector } from "react-redux";
import Loader from "@shared/ui/Loader";
import { formatSentence } from "@shared/lib/toCamelCase";
import { SwalFireDelete } from "@shared/ui/swalFire";
import { fireToastMessage } from "@shared/ui/toast";
import { hourlyData, prefer } from "@features/nanny-share/questionnaire/options";
import { findMatchingRate1, parseHourlyRate } from "@shared/lib/rates";
import { formatKey } from "@shared/lib/strings";
import Button from "@shared/ui/Button";

const parseTime = (time) => (time ? dayjs(time) : null);

function formatJobTitle(jobType) {
  if (!jobType) return "Job Needed";

  const withSpaces = jobType.replace(/([a-z])([A-Z])/g, "$1 $2");
  const capitalized = withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${capitalized} Needed`;
}

const JobListingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editableData, setEditableData] = useState({});
  const dispatch = useDispatch();
  const { data, isLoading } = useSelector((s) => s.jobPost);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const handleCheckboxChange = useCallback((day) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        checked: !prevState[day].checked,
      },
    }));
  }, []);

  const [daysState, setDaysState] = useState(() => {
    return days.reduce((acc, day) => {
      const specificDay = data?.[data?.jobType]?.specificDays?.[day];
      acc[day] = {
        checked: !!specificDay,
        start: specificDay?.start || null,
        end: specificDay?.end || null,
      };
      return acc;
    }, {});
  });

  const handleTimeChange = (day, field, time) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        [field]: time ? time.toISOString() : null, // Set to ISO string or null
      },
    }));
  };

  const handleEditClick = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    dispatch(fetchPostJobByIdThunk(id));
  }, [id, dispatch]);

  const handleDeleteClick = () => {
    const handleDelete = async () => {
      try {
        await dispatch(deletePostJobThunk(id));
        fireToastMessage({ message: "Job deleted successfully" });
        navigate(-1);
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
    if (data && data?.[data?.jobType]) {
      setEditableData(data?.[data?.jobType]);
      const specificDays = data?.[data?.jobType]?.specificDays;
      if (specificDays) {
        const initialDaysState = days.reduce((acc, day) => {
          const dayData = specificDays?.[day];
          acc[day] = {
            checked: !!dayData?.checked,
            start: dayData?.start || null,
            end: dayData?.end || null,
          };
          return acc;
        }, {});
        setDaysState(initialDaysState);
      }
    }
  }, [data]);
  // console.log(editableData)
  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        data?.[data?.jobType] && (
          <>
            <div className="padding-navbar1 Quicksand">
              <div className="flex flex-col justify-between shadow-soft lg:p-8 p-4 rounded-2xl bg-white">
                <p className=" lg:mb-4 mb-2 Livvic-SemiBold text-4xl text-primary">
                  {data?.jobType && formatJobTitle(data?.jobType)}
                </p>
                <hr />
                <div className="lg:my-4 my-2">
                  <p className=" Livvic-SemiBold text-lg">Description</p>
                  <p className=" text-justify text-[#555555] lg:my-4 my-2 max-lg:text-sm">
                    {" "}
                    {data?.[data?.jobType] &&
                      data?.[data?.jobType]?.jobDescription}
                  </p>
                </div>
                <hr />

                <div className="lg:my-4 my-2">
                  <p className=" Livvic-SemiBold text-lg text-primary">
                    What is your preferred schedule for childcare?
                  </p>
                  <p className="Livvic-Medium rounded-full px-4 py-2 border border-[#EEEEEE] w-fit text-justify leading-5 lg:my-4 my-2 max-lg:text-sm">
                    {data?.[data?.jobType] &&
                      data?.[data?.jobType]?.preferredSchedule}
                  </p>
                </div>
                <hr />

                {/* <div className="lg:my-4 my-2">
                                    <p className="Livvic-SemiBold text-lg text-primary">Hourly rate or weekly salary range</p>
                                    <p className="Livvic-Medium text-justify leading-5 lg:my-4 my-2 max-lg:text-sm">{data?.[data?.jobType] && findMatchingRate1(data?.[data?.jobType]?.hourlyRate)}</p>
                                    {data[data.jobType].hourlyRateSpecify &&
                                        <div className="w-full">
                                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">Specify: {data[data.jobType].hourlyRateSpecify}</p>
                                        </div>
                                    }
                                </div> */}
                {data?.[data?.jobType]?.specificDays && (
                  <>
                    <div className="lg:my-4 my-2">
                      <p className="Livvic-SemiBold text-lg text-primary">
                        Do you have specific days and times when you need
                        childcare?
                      </p>
                      <div className="flex flex-wrap justify-left gap-x-10 gap-y-5">
                        {data?.[data?.jobType]?.specificDays &&
                          days.map((day, index) => {
                            const dayData =
                              data?.[data?.jobType]?.specificDays[day];
                            return (
                              <div
                                key={index}
                                className={`pr-8 mt-2 ${
                                  index < days.length - 1
                                    ? "schdule-Border"
                                    : ""
                                }`}
                              >
                                <p className="Livvic-SemiBold text-[#555555] text-lg">
                                  {day}
                                </p>
                                {dayData && dayData.checked ? (
                                  <div className="flex gap-4">
                                    <p>
                                      <span className="text-[#666666]">
                                        {new Date(
                                          dayData.start
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: true,
                                        })}
                                      </span>
                                    </p>
                                    <p>
                                      <span className="text-[#666666]">
                                        {new Date(
                                          dayData.end
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: true,
                                        })}
                                      </span>
                                    </p>
                                  </div>
                                ) : (
                                  <p className="w-28 text-[#666666]">
                                    I don't work on {day}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
                <hr />
                {data?.jobType != "swimInstructor" && (
                  <>
                    <div className="lg:my-4 my-2">
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "nanny" &&
                          "What are your expectations from the caregiver?"}
                        {data?.jobType == "musicInstructor" &&
                          "What instrument do you want your child to learn?"}
                        {data?.jobType == "houseManager" &&
                          "What specific duties do you need help with?"}
                        {data?.jobType == "privateEducator" &&
                          "Which subject(s) does your child need help with?"}
                        {data?.jobType == "specializedCaregiver" &&
                          "Type of Specialized Care Needed"}
                        {data?.jobType == "sportsCoaches" &&
                          "Which sport do you want your child to learn or improve in?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:my-4 my-2">
                        {data?.jobType == "nanny" &&
                          data?.[data?.jobType]?.expectationsCaregiver &&
                          Object.entries(
                            data[data.jobType].expectationsCaregiver
                          ).map(([key, value], i) => (
                            <p
                              key={i}
                              className="Livvic-Medium text-justify leading-5 max-lg:text-sm"
                            >
                              {`${formatKey(key)}:  ${value}`}
                            </p>
                          ))}
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType === "sportsCoaches") &&
                          Array.isArray(data[data.jobType]?.typeOf) && (
                            <>
                              <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                                {data[data.jobType].typeOf.join(", ")}
                              </p>
                              {data[data.jobType].typeOfSpecify && (
                                <div className="w-full">
                                  <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                                    Specify: {data[data.jobType].typeOfSpecify}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        {(data?.jobType === "houseManager" ||
                          data?.jobType === "specializedCaregiver") &&
                          Array.isArray(data[data.jobType]?.specificDuties) && (
                            <>
                              <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                                {data[data.jobType].specificDuties.join(", ")}
                              </p>

                              {data[data.jobType].specificDutiesSpecify && (
                                <div className="w-full">
                                  <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                                    Specify:{" "}
                                    {data[data.jobType].specificDutiesSpecify}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        {data?.jobType == "privateEducator" &&
                          data?.[data?.jobType]?.subjects &&
                          Object.entries(data[data.jobType].subjects).map(
                            ([key, value], i) => (
                              <p
                                key={i}
                                className="Livvic-Medium text-justify leading-5 max-lg:text-sm capitalize"
                              >
                                {`${formatKey(key)}:  ${value}`}
                              </p>
                            )
                          )}
                      </div>
                    </div>
                    <hr />
                  </>
                )}
                <div className="lg:mt-4 mt-2">
                  <p className="Livvic-SemiBold text-lg text-primary">
                    {data?.jobType == "nanny" &&
                      "Do you have any specific requirements or preferences for your caregiver?"}
                    {(data?.jobType == "musicInstructor" ||
                      data?.jobType == "sportsCoaches" ||
                      data?.jobType == "swimInstructor") &&
                      "What is the current skill level of your child?"}
                    {data?.jobType == "houseManager" &&
                      "Do you require assistance with errands and grocery shopping?"}
                    {data?.jobType == "privateEducator" &&
                      "What is the grade level of your child?"}
                    {data?.jobType == "specializedCaregiver" &&
                      "Specific Care Requirements"}
                  </p>
                  <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                    {data?.[data?.jobType]?.specificRequirements &&
                      Object.entries(
                        data[data.jobType].specificRequirements
                      ).map(([key, values], i) => (
                        <p
                          key={`requirement-${i}`}
                          className="Livvic-Medium text-justify leading-5 max-lg:text-sm"
                        >
                          {`${formatKey(key)}: ${
                            Array.isArray(values) ? values.join(", ") : values
                          }`}
                        </p>
                      ))}
                    {(data?.jobType === "musicInstructor" ||
                      data?.jobType == "sportsCoaches" ||
                      data?.jobType == "swimInstructor") && (
                      <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                        {data[data.jobType].skillsLevel}
                      </p>
                    )}
                    {data?.jobType === "houseManager" && (
                      <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                        {data[data.jobType].requireAssistance}
                      </p>
                    )}
                    {data?.jobType === "privateEducator" && (
                      <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                        {data[data.jobType].gradeLevel}
                      </p>
                    )}
                    {data?.jobType === "specializedCaregiver" &&
                      Array.isArray(data[data.jobType]?.specificCare) && (
                        <>
                          <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                            {data[data.jobType].specificCare.join(", ")}
                          </p>

                          {data[data.jobType].specificCareSpecify && (
                            <div className="w-full">
                              <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                                Specify:{" "}
                                {data[data.jobType].specificCareSpecify}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                  </div>
                </div>

                {(data?.jobType == "musicInstructor" ||
                  data?.jobType == "houseManager" ||
                  data?.jobType == "privateEducator" ||
                  data?.jobType == "sportsCoaches" ||
                  data?.jobType == "swimInstructor") && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {(data?.jobType == "musicInstructor" ||
                          data?.jobType == "houseManager" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          "How often do you require?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {(data?.jobType == "musicInstructor" ||
                          data?.jobType == "houseManager" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") && (
                          <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm capitalize">
                            {data[data.jobType].require}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(data?.jobType == "musicInstructor" ||
                  data?.jobType == "sportsCoaches" ||
                  data?.jobType == "swimInstructor") && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {(data?.jobType == "musicInstructor" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          "How long do you want each lesson to be?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") && (
                          <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                            {data[data.jobType].sessionTime}
                          </p>
                        )}
                        {data[data.jobType].sessionSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].sessionSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(data?.jobType === "musicInstructor" ||
                  data?.jobType == "privateEducator" ||
                  data?.jobType == "sportsCoaches" ||
                  data?.jobType == "swimInstructor") && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          "Where do you prefer lessons?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") && (
                          <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm capitalize">
                            {data[data.jobType].mode}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(data?.jobType == "musicInstructor" ||
                  data?.jobType == "privateEducator" ||
                  data?.jobType == "sportsCoaches" ||
                  data?.jobType == "swimInstructor") && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          "What are your specific goals?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          Array.isArray(data[data.jobType]?.goal) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].goal.join(", ")}
                            </p>
                          )}
                        {data[data.jobType].goalSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].goalSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "houseManager" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "houseManager" &&
                          "Do you require cooking services? If so, for whom?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "houseManager" &&
                          Array.isArray(data[data.jobType]?.cookingSkills) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].cookingSkills.join(", ")}
                            </p>
                          )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "specializedCaregiver" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "specializedCaregiver" &&
                          "Duration of Care"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "specializedCaregiver" &&
                          Array.isArray(data[data.jobType]?.duration) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].duration.join(", ")}
                            </p>
                          )}
                        {data[data.jobType].durationSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].durationSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "specializedCaregiver" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "specializedCaregiver" &&
                          "Experience and Qualifications Required"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "specializedCaregiver" &&
                          Array.isArray(data[data.jobType]?.expAndQua) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].expAndQua.join(", ")}
                            </p>
                          )}
                        {data[data.jobType].expAndQuaSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].expAndQuaSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "specializedCaregiver" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "specializedCaregiver" &&
                          "Availability"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "specializedCaregiver" && (
                          <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                            {data[data.jobType]?.availability}
                          </p>
                        )}
                        {data[data.jobType].availabilitySpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].availabilitySpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "specializedCaregiver" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "specializedCaregiver" &&
                          "Additional Skills and Competencies"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "specializedCaregiver" &&
                          Array.isArray(data[data.jobType]?.addSkills) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].addSkills.join(", ")}
                            </p>
                          )}
                        {data[data.jobType].addSkillsSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {" "}
                              Specify: {data[data.jobType].addSkillsSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType == "specializedCaregiver" && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {data?.jobType == "specializedCaregiver" &&
                          "Personal Fit and Preferences"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {data?.jobType === "specializedCaregiver" &&
                          Array.isArray(data[data.jobType]?.personalFit) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].personalFit.join(", ")}
                            </p>
                          )}
                        {data[data.jobType].personalFitSpecify && (
                          <div className="w-full">
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              Specify: {data[data.jobType].personalFitSpecify}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {(data?.jobType === "musicInstructor" ||
                  data?.jobType == "privateEducator" ||
                  data?.jobType == "sportsCoaches" ||
                  data?.jobType == "swimInstructor") && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          "Do you have a preference any specific style?"}
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        {(data?.jobType === "musicInstructor" ||
                          data?.jobType == "privateEducator" ||
                          data?.jobType == "sportsCoaches" ||
                          data?.jobType == "swimInstructor") &&
                          Array.isArray(data[data.jobType]?.style) && (
                            <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                              {data[data.jobType].style.join(", ")}
                            </p>
                          )}
                      </div>
                    </div>
                  </>
                )}

                {data?.jobType && data[data.jobType]?.specialRequirements && (
                  <>
                    <hr className="lg:my-4 my-2" />
                    <div>
                      <p className="Livvic-SemiBold text-lg text-primary">
                        Special requirements
                      </p>
                      <div className="flex gap-x-4 gap-y-2 flex-wrap lg:mt-4 mt-2">
                        <p className="Livvic-Medium text-justify leading-5 max-lg:text-sm">
                          {data[data.jobType]?.specialRequirements}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-center gap-2 lg:my-8 my-4">
                {/* <button
                                    onClick={handleDeleteClick}
                                    className=" text-white bg-[#FF0000] border border-[#FF0119] lg:w-32 w-24 h-10 rounded-full font-normal text-base transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110"
                                >
                                    Delete Job
                                </button> */}
                <Button
                  btnText={"Delete Job"}
                  action={() => handleDeleteClick()}
                  className="bg-[#FF8484] text-white"
                />
                {/* <button onClick={() => navigate(-1)}
                                    className=" text-[#AEC4FF] bg-white border border-[#AEC4FF] lg:w-32 w-24 h-10 rounded-full font-normal text-base transition hover:opacity-60 duration-700 delay-150 ease-in-out"
                                >
                                    Go back
                                </button> */}
                <Button
                  btnText={"Go Back"}
                  action={() => navigate(-1)}
                  className="text-[#555555] border border-[#EEEEEE]"
                />
                {/* <button
                                    onClick={handleEditClick}
                                    className=" bg-[#AEC4FF] text-white lg:w-32 w-24 h-10 border-none rounded-full font-normal text-base transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110"
                                >
                                    Edit Job
                                </button> */}
                <Button
                  btnText={"Edit Job"}
                  action={() => handleEditClick()}
                  className="bg-[#AEC4FF]"
                />
              </div>
            </div>
            <Modal
              title={`Edit ${formatSentence(data?.jobType)} Job`}
              open={isModalVisible}
              onCancel={handleCancel}
              onOk={async () => {
                // Validate if all required fields are populated
                const { default: moment } = await import("moment");

                if (
                  !editableData?.jobDescription ||
                  !editableData?.preferredSchedule ||
                  !editableData?.hourlyRate
                ) {
                  fireToastMessage({
                    type: "error",
                    message:
                      "Job Description, Preferred Schedule, and Hourly Rate are required.",
                  });
                  return;
                }

                // Process checked days and times
                const checkedDays = Object.entries(daysState)
                  .filter(([day, data]) => data.checked) // Keep only those with checked: true
                  .reduce((acc, [day, data]) => {
                    // Convert start and end times to string (ISO format or any preferred format)
                    const start = moment(data.start).toISOString(); // Convert to ISO string
                    const end = moment(data.end).toISOString(); // Convert to ISO string

                    acc[day] = {
                      ...data,
                      start, // Replace the start time with a string
                      end, // Replace the end time with a string
                    };
                    return acc;
                  }, {});

                // Validate start and end times for selected days
                let allValid = true;
                let invalidDays = [];

                Object.entries(checkedDays).forEach(([day, { start, end }]) => {
                  const parsedStart = moment(start);
                  const parsedEnd = moment(end);

                  // Check if the moment objects are valid
                  if (!parsedStart.isValid() || !parsedEnd.isValid()) {
                    allValid = false;
                    invalidDays.push(day);
                  } else if (parsedStart.isSame(parsedEnd)) {
                    allValid = false;
                    invalidDays.push(day);
                  } else if (parsedEnd.isBefore(parsedStart)) {
                    allValid = false;
                    invalidDays.push(day);
                  }
                });

                if (!allValid) {
                  fireToastMessage({
                    type: "error",
                    message: `The following selected days have invalid start or end times: ${invalidDays.join(
                      ", "
                    )}`,
                  });
                  return;
                }

                // Final Data: Include only specificDays if there are valid entries
                const finalData = {
                  jobDescription: editableData?.jobDescription,
                  preferredSchedule: editableData?.preferredSchedule,
                  hourlyRate: editableData?.hourlyRate,
                };

                // Attach specificDays only if there is at least one selected day
                if (Object.keys(checkedDays).length > 0) {
                  finalData.specificDays = checkedDays;
                }
                try {
                  const { message } = await dispatch(
                    updatePostJobThunk({ id, body: finalData })
                  ).unwrap();
                  fireToastMessage({ message: message });
                  setIsModalVisible(false);
                } catch (err) {
                  fireToastMessage({ type: "error", message: err.message });
                }
              }}
              okText="Update"
              cancelText="Cancel"
            >
              {/* Example input fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="lg:text-lg text-xl Livvic-Bold Livvic">
                    Job Description
                  </p>
                  <Input.TextArea
                    className="w-full border rounded-md p-2 mt-1 !resize-none"
                    rows={4}
                    required
                    placeholder="Write job description..."
                    value={editableData?.jobDescription || ""}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        jobDescription: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <p className="lg:text-lg text-xl Livvic-Bold Livvic">
                    What is your preferred schedule for childcare?
                  </p>
                  <Radio.Group
                    options={prefer.map((option) => ({
                      label: option.name,
                      value: option.name,
                    }))}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        preferredSchedule: e.target.value,
                      }))
                    }
                    value={editableData?.preferredSchedule}
                  />
                </div>

                <div>
                  <p className="lg:text-lg text-xl Livvic-Bold Livvic">
                    What is your preferred hourly rate?
                  </p>
                  <Radio.Group
                    options={hourlyData.map((option) => ({
                      label: option.name,
                      value: option.name,
                    }))}
                    onChange={(e) =>
                      setEditableData((prev) => ({
                        ...prev,
                        hourlyRate: parseHourlyRate(e.target.value),
                      }))
                    }
                    value={findMatchingRate1(editableData?.hourlyRate)}
                  />
                </div>

                {/* Specific Days */}
                <p className="lg:text-lg text-xl Livvic-Bold Livvic leading-none">
                  Specific Days
                </p>
                <div className="flex flex-wrap">
                  {days.map((day) => (
                    <div className="flex mb-4" key={day}>
                      <div>
                        <Checkbox
                          checked={daysState[day]?.checked || false}
                          onChange={() => handleCheckboxChange(day)}
                          className="mr-4"
                        >
                          <span className="Livvic-SemiBold text-lg">{day}</span>
                        </Checkbox>

                        <div className="flex items-center gap-2 mt-2">
                          <TimePicker
                            value={
                              daysState[day]?.start
                                ? parseTime(daysState[day].start)
                                : null
                            }
                            placeholder="Start"
                            onChange={(time) =>
                              handleTimeChange(day, "start", time)
                            }
                            disabled={!daysState[day]?.checked}
                            format="h:mm A"
                            className="rounded-lg date-picker1"
                          />
                          <span className="Livvic-Medium text-base">to</span>
                          <TimePicker
                            value={
                              daysState[day]?.end
                                ? parseTime(daysState[day].end)
                                : null
                            }
                            placeholder="End"
                            onChange={(time) =>
                              handleTimeChange(day, "end", time)
                            }
                            disabled={!daysState[day]?.checked}
                            format="h:mm A"
                            className="rounded-lg date-picker1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Modal>
          </>
        )
      )}
    </>
  );
};

export default JobListingView;
