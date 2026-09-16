import { useState, useRef, useEffect } from "react";
import CustomStepper from "@shared/ui/Stepper";
// import HireStep4 from "../../subComponents/Hire/step4"; // Import your form component
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { Form, Input } from "antd";
// import HireStep3 from "../../subComponents/Hire/step3";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { X } from "lucide-react";
// import HireStep2 from "../../subComponents/Hire/step2";
import { step7Data, step8Data, step9Data, step10Data, step11Data, step12Data, step13Data } from "@features/nanny-share/questionnaire/options";
import { resolveChildrenAges } from "@shared/lib/children";
import { parseHourlyRate } from "@shared/lib/rates";
import { useDispatch, useSelector } from "react-redux";
import { fetchWithTimeout } from "@shared/api/fetchWithTimeout";
import { postNannyShare } from "@features/nanny-share/store/nannyShareSlice";
import Button from "@shared/ui/Button";
import Step1 from "@features/nanny-share/post/step1";
import OpenText from "@features/nanny-share/post/OpenText";
import Step2 from "@features/nanny-share/post/step2";
import Step7 from "@features/nanny-share/post/step7";
import Step8 from "@features/nanny-share/post/step8";
import Step3 from "@features/nanny-share/post/step3";
import Step4 from "@features/nanny-share/post/step4";
import Step5 from "@features/nanny-share/post/step5";
import Step6 from "@features/nanny-share/post/step6";
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";
import { setNannyProfileCompleted } from "@features/auth/store/authSlice";

const afterSchoolCareOptions = [
  "Not Applicable",
  "Transportation",
  "Snacks/meal prep",
  "Homework help",
  "Activities/outdoor play",
];

export const PartTime = ({ login = true }) => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("recordId");
  const { state } = useLocation();
  const stepRef = useRef(null);
  const dispatch = useDispatch();
  const [selectedValue, setSelectedValue] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { additionalInfo } = useSelector((s) => s.form);
  const totalStep = 7;
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state
  const [sheetUserData, setSheetUserData] = useState(state?.sheetUserData ?? null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [textAreaValue, setTextAreaValue] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
  );

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Initialize the state in the parent component
  const [daysState, setDaysState] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { checked: false, start: null, end: null };
      return acc;
    }, {})
  );

  // This function will update the state when passed down to HireStep3
  const updateDaysState = (updatedDaysState) => {
    setDaysState(updatedDaysState);
  };

  const jobFormRef = useRef(null);

  const handleChange = (e) => {
    setTextAreaValue(e.target.value);
  };

  const HandleNext = async () => {
    if (currentStep == 0) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.flexible && values.hosting && values.nannyshareStart && values.urgency) {
            const selectedDays = Object.entries(daysState).filter(
              ([day, { checked }]) => checked
            );

            if (selectedDays.length === 0) {
              fireToastMessage({
                type: "error",
                message: "Atleast select one day and time.",
              });
              return;
            }
            let allValid = true; // Flag to check if all selected days have valid start and end times
            let invalidDays = [];

            // Loop through selected days to ensure each has a valid start and end time
            selectedDays.forEach(([day, { start, end }]) => {
              if (!start || !end) {
                allValid = false;
                invalidDays.push(day); // Collect days with missing start or end times
              } else if (start.isSame(end)) {
                allValid = false;
                invalidDays.push(day); // Collect days where start and end are the same
              } else if (end.isBefore(start)) {
                // Error if end time is before start time
                allValid = false;
                invalidDays.push(day); // Collect days where end is before start
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
            const checkedDays = Object.entries(daysState)
              .filter(([day, data]) => data.checked) // Keep only those with checked: true
              .reduce((acc, [day, data]) => {
                // Convert start and end times to string (ISO format or any preferred format)
                const start = data.start.toISOString(); // Assuming start is a date object
                const end = data.end.toISOString(); // Assuming end is a date object

                acc[day] = {
                  ...data,
                  start, // Replace the start time with a string
                  end, // Replace the end time with a string
                };
                return acc;
              }, {});

            setFormValues({
              ...formValues,
              specificDays: checkedDays,
              flexibility: values.flexible,
              hostingPreference: values.hosting,
              nannyshareStart: values.nannyshareStart,
              urgency: values.urgency
            });

            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Please provide flexibility, hosting info and select atleast one day and time.",
            });
          }
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 1) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.healthConsideration || values.specifyHealthConsideration) {

            const childrenAges = resolveChildrenAges(values);

            if (childrenAges.length === 0) {
              fireToastMessage({
                type: "error",
                message: "Please provide all the child's ages",
              });
              return;
            }

            setFormValues((prev) => ({
              ...prev,
              numberOfChildren: childrenAges.length,
              childrenAges,
              childrenSchools: values.schoolAttended || "",
              allergiesHealth: values.healthConsideration
                ? values.healthConsideration
                : [],
              allergiesHealthSpecify: values.specifyHealthConsideration || "",
            }));

            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });

          } else {
            fireToastMessage({
              type: "error",
              message: "No health considerations provided",
            });
          }
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 2) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.responsibilities && values.responsibilities.length > 0) {
            const hasNA = values.responsibilities.includes("not applicable");
            if (hasNA && values.responsibilities.length > 1) {
              fireToastMessage({
                type: "error",
                message:
                  "If 'Not Applicable' is selected, remove other selected responsibilities.",
              });
              return; // stop execution
            }
            if (
              values.householdActivities &&
              values.householdActivities.length > 0
            ) {
              const hasNA =
                values.householdActivities.includes("not applicable");
              if (hasNA && values.householdActivities.length > 1) {
                fireToastMessage({
                  type: "error",
                  message:
                    "If 'Not Applicable' is selected, remove other selected Houshold add ons.",
                });
                return; // stop execution
              }
            }
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              childResponsibilities: values.responsibilities,
              ...(values.householdActivities &&
                values.householdActivities.length > 0 && {
                householdAddOns: values.householdActivities,
              }),
            }));
            // Move to next step
            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message: "Please provide the responsibilities",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 3) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.dailyRoutine) {
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              dailyRoutine: values.dailyRoutine,
            }));
          }
          jobFormRef.current.resetFields();
          setCurrentStep((prev) => prev + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 4) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          // Move to next step
          if (values.houseRules) {
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              houseRules: values.houseRules,
            }));
          }

          if (values.parentingStyle) {
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              parentingStyle: values.parentingStyle,
            }));
          }

          if (values.specifyParentingStyle) {
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              parentingStyleSpecify: values.specifyParentingStyle,
            }));
          }

          if (values.specifyHouseRules) {
            // Save to formValues
            setFormValues((prev) => ({
              ...prev,
              houseRulesSpecify: values.specifyHouseRules,
            }));
          }
          jobFormRef.current.resetFields();
          setCurrentStep((prev) => prev + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 5) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (
            values.hourlyRateSplit &&
            (values.pets || values.specifyPets)
          ) {
            const cleanData = cleanFormData1(values);
            const hourlyBudgetParsed = parseHourlyRate(cleanData.hourlyRateSplit);

            if (!hourlyBudgetParsed.min || !hourlyBudgetParsed.minShare) {
              fireToastMessage({
                type: "error",
                message: "Please select a valid hourly budget from the dropdown to proceed.",
              });
              return;
            }

            let updatedValues = {
              ...formValues,
              pets: cleanData.pets,
              petsSpecify: cleanData.specifyPets,
              hourlyBudget: hourlyBudgetParsed,
              hourlyBudgetSpecify: "",
            };
            setFormValues(updatedValues);
            // Move to next step
            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Select an hourly rate and provide pet information to proceed",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 6) {
      jobFormRef.current
        .validateFields()
        .then(async (values) => {
          if (
            values.prefferedCommunication ||
            values.specifyPrefferedCommunication
          ) {
            // If form is valid, submit it and move to the next step

            let updatedValues = {
              ...formValues,
              // Store single value, or empty string if not provided
              communicationPreference: values.prefferedCommunication || "",
              communicationSpecify: values.specifyPrefferedCommunication || "",

              backupCare: values.backupAvailable || "",
              backupCareSpecify: values.specifyBackupAvailable || "",

              involvementLevel: values.involvement || "",
            };

            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Please fill out all the required fields",
            });
          }
        })
        .catch((errorInfo) => {
          // console.group("Form validation failed");
          // console.log("Full errorInfo:", errorInfo); // whole object
          // console.log("Error fields:", errorInfo.errorFields);
          // console.log("Out-of-date fields:", errorInfo.outOfDate);
          // console.groupEnd();

          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 7) {
      jobFormRef.current
        .validateFields()
        .then(async (values) => {
          const normalizedInfo = Object.values(additionalInfo).reduce(
            (acc, item) => {
              if (item?.key && item.value !== undefined && item.value !== null) {  // ← fixed: allows false/0
                acc[item.key] = item.value;
              }
              return acc;
            },
            {}
          );

          let updatedValues = { ...formValues, ...normalizedInfo };

          if (values.additionalInfo) {
            updatedValues.openNotes = values.additionalInfo;
            setFormValues(updatedValues);
          }

          setIsLoading(true);
          try {
            if (login) {
              const { data } = await dispatch(
                nannyshareProfileThunk({
                  ...updatedValues,
                }),
              ).unwrap();

              fireToastMessage({
                success: true,
                message: data.message,
              });

              setIsLoading(false);
              dispatch(setNannyProfileCompleted())
              navigate("/dashboard");
            } else {
              if (!id) {
                console.error("No record ID found in URL");
                setIsLoading(false);
                return;
              }

              const flattenObject = (obj, parentKey = "", result = {}) => {
                for (const key in obj) {
                  const value = obj[key];
                  const newKey = parentKey ? `${parentKey}_${key}` : key;

                  if (
                    value !== null &&
                    typeof value === "object" &&
                    !Array.isArray(value) &&
                    !(value instanceof Date)
                  ) {
                    flattenObject(value, newKey, result);
                  } else if (Array.isArray(value)) {
                    result[newKey] = value.join(", ");
                  } else {
                    result[newKey] = value ?? "";
                  }
                }
                return result;
              };

              const flattenValues = flattenObject(updatedValues)

              const payload = {
                action: "update",
                Id: id,
                Details: JSON.stringify(updatedValues),
                ...flattenValues
              };

              const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

              if (!scriptUrl) {
                console.warn(
                  "VITE_GOOGLE_SCRIPT_URL is not set. Data:",
                  payload,
                );
                await new Promise((r) => setTimeout(r, 1400));
                setIsLoading(false);
                return;
              }

              const formData = new URLSearchParams(payload).toString();

              const response = await fetchWithTimeout(scriptUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
              });

              await response.text();

              setIsLoading(false);

              // ✅ show final success popup
              setShowSuccessModal(true);
            }
          } catch (err) {
            setIsLoading(false);
            fireToastMessage({ type: "error", message: err.message });
          }
          jobFormRef.current.resetFields();
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch((errorInfo) => {
          // console.group("Form validation failed");
          // console.log("Full errorInfo:", errorInfo); // whole object
          // console.log("Error fields:", errorInfo.errorFields);
          // console.log("Out-of-date fields:", errorInfo.outOfDate);
          // console.groupEnd();

          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    }
  };
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          // <HireStep2
          //   opt={Array.from({ length: 4 }, (_, i) => i + 1)}
          //   formRef={jobFormRef}
          //   selectedValue={selectedValue}
          //   handleSelectChange={setSelectedValue}
          // />
          <Step2
            formRef={jobFormRef}
            daysState={daysState}
            setDaysState={setDaysState}
            initialValues={formValues}
          />
        );
      case 1:
        return (
          // <HireStep3
          //   daysState={daysState}
          //   setDaysState={updateDaysState}
          //   head={"What is your desired schedule for nanny care?"}
          // />
          <Step3
            formRef={jobFormRef}
            selectedValue={selectedValue}
            setSelectedValue={setSelectedValue}
            numberOfChildren={formValues?.numberOfChildren || sheetUserData["Number of children"]}
            childrenAges={
              formValues?.childrenAges?.length
                ? formValues.childrenAges.map((age) => age.label).join(", ")
                : sheetUserData["Child age(s)"]
            }
            initialValues={formValues}
          />
        );

      case 2:
        return (
          // <HireStep4
          //   formRef={jobFormRef || {}}
          //   inputName={"Specify"}
          //   head={"How flexible are you with scheduling and arrangements?"}
          //   data={step2Data}
          // />
          <Step4
            formRef={jobFormRef}
            initialValues={formValues}
          // options={afterSchoolCareOptions}
          // householdAddOns={false}
          />
        );

      case 3:
        return <Step6 formRef={jobFormRef} initialValues={formValues} />;

      case 4:
        return (
          // <HireStep4
          //   formRef={jobFormRef || {}}
          //   inputName={"Specify"}
          //   head={"Do you have a specific parenting style or philosophy?"}
          //   data={step3Data}
          // />
          <Step5 formRef={jobFormRef} initialValues={formValues} />
        );
      case 5:
        return (
          // <HireStep4
          //   checkBox={true}
          //   formRef={jobFormRef || {}}
          //   inputName={"Specify"}
          //   head={"What responsibilities would you like the nanny to handle?"}
          //   data={step4Data}
          // />
          <Step7 formRef={jobFormRef} initialValues={formValues} />
        );
      case 6:
        return (
          // <HireStep4
          //   formRef={jobFormRef || {}}
          //   inputName={"Specify"}
          //   head={"What is your hourly budget for a nanny share?"}
          //   subHead2={
          //     "This is the total hourly rate for the nanny. If split between two families, you will each pay half of the selected amount."
          //   }
          //   data={step5Data}
          // />
          <Step8 formRef={jobFormRef} involvement={false} initialValues={formValues} />
        );
      case 7:
        return (
          <OpenText
            title={
              "Anything else another family should know? (optional free-text)"
            }
            formRef={jobFormRef}
            openFieldName={"additionalInfo"}
            placeholder={"Specify..."}
            required={false}
          />
        );
    }
  };

  return (
    <div className="lg:px-5 Quicksand">
      {isLoading && <LoadingModal />}
      {/* Stepper Component */}
      <div className="lg:px-10 px-2">
        <CustomStepper
          totalSteps={totalStep}
          currentStep={currentStep}
        />
      </div>


      {/* ✅ Final success modal */}
      {showSuccessModal && (
        <FinalSuccessModal
          recordId={id}
          onClose={() => {
            setShowSuccessModal(false);
            navigate("/");
          }}
        />
      )}

      <div className="lg:mx-10 mx-2 my-10 px-4">
        <div className="pt-8 pb-4">
          <div className="flex justify-end lg:mr-6">
            <button onClick={() => navigate(-1)}>
              <X className="text-2xl" />
            </button>
          </div>
          <div className="px-4 py-4 rounded-3xl">
            <div className="flex justify-center">
              <div className="flex flex-col w-full">{renderStepContent()}</div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
            <div className="flex justify-center py-4 space-x-4">
              {currentStep > 0 && (
                // <button
                //     className="mx-auto text-[#AEC4FF] bg-white border border-[#AEC4FF] lg:w-48 w-24 lg:py-2 py-1 rounded-full font-normal text-base transition hover:opacity-60 duration-700 delay-150 ease-in-out"
                //     onClick={() => {
                //         if (currentStep > 0) {
                //             stepRef.current?.prev();
                //         }
                //     }}
                // >
                //     Back
                // </button>
                <Button
                  action={() => {
                    if (currentStep > 0) {
                      setCurrentStep((prev) => prev - 1);
                    }
                  }}
                  btnText={"Back"}
                  className="border border-[#FFFFFF] text-[#555555]"
                />
              )}

              {/* <button
                                className="mx-auto bg-[#AEC4FF] text-white lg:w-48 w-24 lg:py-2 py-1 border-none rounded-full font-normal text-base transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110 disabled:opacity-70 disabled:cursor-not-allowed"
                                onClick={HandleNext}
                                disabled={isLoading} // Disable while loading
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8h4z" />
                                        </svg>
                                        Post a Job
                                    </span>
                                ) : (
                                    (totalStep - 1) === currentStep ? 'Post a Job' : 'Continue'
                                )}
                            </button> */}
              <Button
                btnText={
                  totalStep === currentStep ? login ? "Post a Job" : "Submit Responses" : "Continue"
                }
                action={() => HandleNext()}
                isLoading={isLoading}
                loadingBtnText={login ? "Post a Job" : "Saving Responses"}
                className="bg-[#AEC4FF]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinalSuccessModal = ({ onClose, recordId }) => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.35)",
      }}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4"
        style={{
          animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Success Icon */}
        <div
          className="flex items-center justify-center rounded-full mb-5"
          style={{
            width: 68,
            height: 68,
            background: "#FFADE1",
            animation:
              "scaleIn 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M7 16.5L13 22.5L25 10"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 0,
                animation: "drawCheck 0.4s 0.3s ease both",
              }}
            />
          </svg>
        </div>

        <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">
          You’re all set! 🎉
        </h2>

        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Thanks for sharing those details. We’ll use this information to
          manually match you into a nanny share and email you with an update
          within 24 hours.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate(`/hire?recordId=${recordId || ""}`)
          }
          className="w-full block text-center bg-[#FFADE1] hover:bg-[#f99dd5] transition-colors rounded-full py-3 text-base Livvic-Bold text-black"
        >
          Set up my FamLink profile now
        </button>

        <p className="text-xs text-gray-500 mt-3 mb-4 leading-relaxed max-w-[280px]">
          Save and update your info, and view your nanny-share matches in one
          place.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Close for now
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes scaleIn {
          0%   { transform: scale(0); }
          100% { transform: scale(1); }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

const LoadingModal = () => (
  <div
    className="fixed inset-0 z-[999] flex items-center justify-center"
    style={{
      backdropFilter: "blur(8px)",
      backgroundColor: "rgba(0,0,0,0.35)",
    }}
  >
    <div
      className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4"
      style={{
        animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <div className="mb-5" style={{ width: 64, height: 64 }}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          style={{
            animation: "spin 1s linear infinite",
            width: 64,
            height: 64,
          }}
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            stroke="#FFADE1"
            strokeWidth="6"
            strokeOpacity="0.25"
          />
          <path
            d="M32 6 a26 26 0 0 1 26 26"
            stroke="#FFADE1"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">
        Processing your responses…
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        We're processing your responses. Just a moment!
      </p>

      <div className="flex gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-[#FFADE1]"
            style={{
              width: 8,
              height: 8,
              animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>

    <style>{`
      @keyframes popIn {
        0%   { opacity: 0; transform: scale(0.85); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40%            { transform: translateY(-6px); opacity: 1; }
      }
    `}</style>
  </div>
);