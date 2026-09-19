import { useState, useRef, useEffect } from "react";
import CustomStepper from "@shared/ui/Stepper";
import HireStep4 from "@shared/ui/questionnaire/step4";
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { Form, Input } from "antd";
import HireStep3 from "@shared/ui/questionnaire/step3";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import HireStep2 from "@shared/ui/questionnaire/step2";
import { step2Data, step3Data, step4Data, step5Data, step6Data, step7Data, step8Data, step9Data, step10Data, step11Data, step12Data, step13Data } from "@features/nanny-share/questionnaire/options";
import { parseHourlyRate } from "@shared/lib/rates";
import { useDispatch, useSelector } from "react-redux";
import { fetchWithTimeout } from "@shared/api/fetchWithTimeout";
import { nannyshareProfileThunk, postNannyShare } from "@features/nanny-share/store/nannyShareSlice";
import Button from "@shared/ui/Button";
import Step1 from "@features/nanny-share/post/step1";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import OpenText from "@features/nanny-share/post/OpenText";
import Step2 from "@features/nanny-share/post/step2";
import Step7 from "@features/nanny-share/post/step7";
import Step8 from "@features/nanny-share/post/step8";
import { setNannyProfileCompleted } from "@features/auth/store/authSlice";
import { normalizeShareSchedule } from "@shared/lib/scheduleFormat";

export const PostANannyShare = ({ login = true, recordId }) => {
  const [searchParams] = useSearchParams();
  // Prefer an explicit recordId (e.g. the signed-in user's sheetId, passed when
  // this flow is rendered from the "Complete your profile" email link) and fall
  // back to the ?recordId= query param used by the pre-signup questionnaire.
  const id = recordId || searchParams.get("recordId");
  const stepRef = useRef(null);
  const dispatch = useDispatch();
  const [selectedValue, setSelectedValue] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { additionalInfo } = useSelector((s) => s.form);
  const [form] = Form.useForm();
  const totalStep = 15;
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state
  const [sheetUserData, setSheetUserData] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    const retrieveSheetRecord = async () => {
      if (!id) return;

      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
      if (!scriptUrl) {
        fireToastMessage({
          type: "error",
          message: "Google Script URL is missing.",
        });
        return;
      }

      try {
        setSheetLoading(true);

        const response = await fetch(
          `${scriptUrl}?recordId=${encodeURIComponent(id)}`
        );
        const result = await response.json();
        if (result.status === "success" && result.record) {
          setSheetUserData(result.record);
        } else {
          fireToastMessage({
            type: "error",
            message: result.message || "Could not load saved data",
          });
        }

      } catch (error) {
        console.error("Auto login error:", error);
        fireToastMessage({
          type: "error",
          message: "Failed to log in from record.",
        });
      }
      finally {
        setSheetLoading(false);
      }
    };

    retrieveSheetRecord();
  }, [id]);

  const [textAreaValue, setTextAreaValue] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
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

  const [daysState, setDaysState] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { checked: false, start: null, end: null };
      return acc;
    }, {}),
  );

  const jobFormRef = useRef(null);

  const handleChange = (e) => {
    setTextAreaValue(e.target.value);
  };

  const HandleNext = async () => {
    if (currentStep == 0) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option && values.hasNanny && values.shareLocation) {
            const hasNannyBoolean =
              values.hasNanny.split(" ")[0].toLowerCase() === "yes" ? true :
                values.hasNanny.split(" ")[0].toLowerCase() === "no" ? false : null;
            const route = values.option;
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "nannyShareType",
                value: route,
              }),
            );
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "hasNanny",
                value: hasNannyBoolean,
              }),
            );
            dispatch(
              addOrUpdateAdditionalInfo({
                key: "shareLocation",
                value: values.shareLocation,
              }),
            );
            if (values.specifyNearbyWorkplace) {
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "specifyNearbyWorkplace",
                  value: values.specifyNearbyWorkplace,
                }),
              );
            }
            const navigateTo = (path) => navigate(path, { state: { sheetUserData } });

            // Two questionnaires, because a full-time week and a part-time one
            // ask different follow-ups. The four that used to branch off here —
            // pickup/drop-off, after-school, summer/seasonal, weekend — were
            // services the product does not run; every one of them is a
            // part-time week, so they answer the part-time questionnaire now.
            const isFullTime = normalizeShareSchedule(route) === "Full-time";
            const screen = isFullTime ? "fulltime-care" : "parttime-care";
            navigateTo(id
              ? `/dashboard/post-a-nannyShare/${screen}?recordId=${encodeURIComponent(id)}`
              : `/dashboard/post-a-nannyShare/${screen}`
            );
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Select a share type and fill in all the details",
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
          if (values.describeCare) {
            setFormValues({
              ...formValues,
              careDescription: values.describeCare,
            });
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message: "Please specify the care before proceeding",
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
          if (values.flexible && values.hosting) {
            const selectedDays = Object.entries(daysState).filter(
              ([day, { checked }]) => checked,
            );

            if (selectedDays.length === 0) {
              fireToastMessage({
                type: "error",
                message: "Atleast select one day and time.",
              });
              return;
            }

            let allValid = true;
            let invalidDays = [];

            selectedDays.forEach(([day, { start, end }]) => {
              if (!start || !end) {
                allValid = false;
                invalidDays.push(day);
              } else if (start.isSame(end)) {
                allValid = false;
                invalidDays.push(day);
              } else if (end.isBefore(start)) {
                allValid = false;
                invalidDays.push(day);
              }
            });

            if (!allValid) {
              fireToastMessage({
                type: "error",
                message: `The following selected days have invalid start or end times: ${invalidDays.join(
                  ", ",
                )}`,
              });
              return;
            }

            const checkedDays = Object.entries(daysState)
              .filter(([day, data]) => data.checked)
              .reduce((acc, [day, data]) => {
                const start = data.start.toISOString();
                const end = data.end.toISOString();

                acc[day] = {
                  ...data,
                  start,
                  end,
                };
                return acc;
              }, {});

            setFormValues({
              ...formValues,
              specificDays: checkedDays,
              flexibility: values.flexible,
              hostingPreference: values.hosting,
            });
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
    } else if (currentStep == 3) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.hourlyRateSplit || values.specifyHourlyRateSplit) {
            const cleanData = cleanFormData1(values);

            let updatedValues = {
              ...formValues,
              hourlyBudget: parseHourlyRate(cleanData.hourlyRateSplit),
              hourlyBudgetSpecify: cleanData.specifyHourlyRateSplit,
            };
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message: "Select or specify an hourly rate to proceed",
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
    } else if (currentStep == 4) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (
            values.prefferedCommunication ||
            values.specifyPrefferedCommunication
          ) {
            let updatedValues = {
              ...formValues,
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
            fireToastMessage({
              type: "error",
              message: "Please fill out all the fields",
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
    } else if (currentStep == 5) {
      jobFormRef.current
        .validateFields()
        .then(async (values) => {
          const normalizedInfo = Object.values(additionalInfo).reduce(
            (acc, item) => {
              if (item?.key && item?.value) {
                acc[item.key] = item.value;
              }
              return acc;
            },
            {},
          );

          let updatedValues = { ...formValues, ...normalizedInfo };

          if (values.additionalInfo) {
            updatedValues.openNotes = values.additionalInfo;
            setFormValues(updatedValues);
          }

          try {
            setIsLoading(true);

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
              dispatch(setNannyProfileCompleted());
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
            fireToastMessage({
              type: "error",
              message: err.message || "Something went wrong",
            });
          }

          jobFormRef.current.resetFields();
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch((errorInfo) => {
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
        return <Step1 formRef={jobFormRef} type={sheetUserData?.["Care needed"]} hasNanny={sheetUserData?.["Already have nanny"]} />;
      case 1:
        return (
          <OpenText
            title={"Please describe the type of care you’re looking for"}
            formRef={jobFormRef}
            openFieldName={"describeCare"}
            placeholder={"Describe..."}
          />
        );
      case 2:
        return (
          <Step2
            formRef={jobFormRef}
            daysState={daysState}
            setDaysState={setDaysState}
          />
        );
      case 3:
        return <Step7 formRef={jobFormRef} petsInfo={false} />;
      case 4:
        return <Step8 formRef={jobFormRef} involvement={false} />;
      case 5:
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
      default:
        return null;
    }
  };

  if (id && sheetLoading) {
    return <SheetLoadingModal />
  }

  return (
    <div className="lg:px-5 Quicksand">
      {isLoading && <LoadingModal />}
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

              <Button
                btnText={totalStep === currentStep ? login ? "Post a Job" : "Submit Responses" : "Continue"}
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

const SheetLoadingModal = () => (
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
        Please Wait…
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