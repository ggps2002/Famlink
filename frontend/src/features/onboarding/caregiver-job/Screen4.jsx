import { useState, useRef, useEffect } from "react";
import { fireToastMessage } from "@shared/ui/toast";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import Step1 from "@features/onboarding/caregiver-job/CompleteProfile/Step1";
import Step2 from "@features/onboarding/caregiver-job/CompleteProfile/Step2";
import Step3 from "@features/onboarding/caregiver-job/CompleteProfile/Step3";
import Step4 from "@features/onboarding/caregiver-job/CompleteProfile/Step4";
import Step5 from "@features/onboarding/caregiver-job/CompleteProfile/Step5";
import Step6 from "@features/onboarding/caregiver-job/CompleteProfile/Step6";
import CaregiverExperienceStep from "@features/onboarding/components/CaregiverExperienceStep";
import { useDispatch, useSelector } from "react-redux";
import { setNannyProfileCompleted } from "@features/auth/store/authSlice"
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice"
import CustomStepper from "@shared/ui/Stepper";


import { fetchOnboardingRecord } from "@features/onboarding/onboardingRecord";
export const Screen4 = ({ recordId } = {}) => {
  // Prefer an explicit recordId (the signed-in user's sheetId, passed from the
  // "Complete your profile" email link) and fall back to the route param.
  const { id: paramId } = useParams();
  const id = recordId || paramId;
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const totalStep = 6;
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  // const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetUserData, setSheetUserData] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state

  const [image, setImage] = useState(null); // Default image
  const [file, setFile] = useState(null);
  const val = useSelector((s) => s.form);

  const handleImageChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const imageUrl = URL.createObjectURL(selectedFile);
      setImage(imageUrl); // Preview the image
      setFile(selectedFile); // Store the file for upload
      // setFormValues({
      //   ...formValues, imageFile: selectedFile
      // })
      // const reader = new FileReader();
      // reader.onloadend = () => {
      //   // dispatch(
      //   //   updateForm({
      //   //     imageFile: reader.result, // base64 string
      //   //   })
      //   // );
      //   setFormValues({
      //     ...formValues, imageFile: reader.result
      //   })
      // };
      // reader.readAsDataURL(selectedFile);
    }
  };

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

  useEffect(() => {
    const retrieveSheetRecord = async () => {
      if (!id) return;

      // [Google Sheet — replaced by the onboarding-records API; kept for reference]
      // const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
      // if (!scriptUrl) {
      //   fireToastMessage({
      //     type: "error",
      //     message: "Google Script URL is missing.",
      //   });
      //   return;
      // }

      try {
        setSheetLoading(true);

        // [Google Sheet — replaced by the onboarding-records API; kept for reference]
        // const response = await fetch(
        //   `${scriptUrl}?recordId=${encodeURIComponent(id)}`
        // );
        // const result = await response.json();
        const result = await fetchOnboardingRecord(id);
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

  const jobFormRef = useRef(null);

  const HandleNext = async () => {
    if (currentStep == 0) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (!values.shareExperience || !values.multiFamilyComfort || !values.childrenCapacity || !values.preferredAges || !values.workSetup) {
            fireToastMessage({
              type: "error",
              message: "Please specify all the fields",
            });
            return
          }

          const AGE_LABEL_MAP = {
            "infants (0–1)": { min: 0, max: 1 },
            "toddlers (1–3)": { min: 1, max: 3 },
            "preschool (3–5)": { min: 3, max: 5 },
            "school-age (5+)": { min: 5, max: 100 },
          };

          function resolvePreferredAges(labels = []) {
            return labels.map((label) => {
              const range = AGE_LABEL_MAP[label.toLowerCase()] ?? {};
              return { label, ...range };
            });
          }
          setFormValues(prev => ({
            ...prev,
            ...values,
            preferredAges: resolvePreferredAges(values.preferredAges),  // ← transform here
          }));
          setCurrentStep((prev) => prev + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 1) {
      // Your experience — optional answers; keep whatever was chosen.
      const values = jobFormRef.current.getFieldsValue();
      setFormValues((prev) => ({ ...prev, ...values }));
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentStep == 2) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.startAvailability) {
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
              startAvailability: values.startAvailability
            });
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Please fill out all the fields",
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
        .then(async (values) => {
          if (values.responsibilities?.length && values.householdHelp?.length) {
            setFormValues({
              ...formValues,
              ...values
            })
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Please fill out all the fields",
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
        .then(async (values) => {
          if (values.hasTransport && values.backgroundCheck) {
            setFormValues({
              ...formValues,
              ...values
            })
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Please fill out all the fields",
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
          if (values.sharedRate && values.soloRate && values.rateType && values.budget) {
            const parsedBudget = typeof values.budget === "string"
              ? JSON.parse(values.budget)
              : values.budget;

            // Per-child rates are optional; save them only if any were given.
            const salaryExp = Object.fromEntries(
              Object.entries(values.salaryExp || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
            );
            setFormValues({
              ...formValues,
              ...values,
              budget: parsedBudget,
              salaryExp: Object.keys(salaryExp).length ? salaryExp : undefined,
            });
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
            message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 6) {
      jobFormRef.current
        .validateFields()
        .then(async (values) => {
          if (values.bio && values.certifications) {
            setIsLoading(true);
            const formData = buildFormData(values, formValues);
            formData.append("imageFile", file)
            try {
              await dispatch(nannyshareProfileThunk(
                formData
              ))

              fireToastMessage({
                success: true,
                message: "Profile created",
              });

              dispatch(setNannyProfileCompleted());
              navigate("/dashboard");
            } catch (errorInfo) {
              fireToastMessage({
                type: "error",
                message:
                  errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
              });
            } finally {
              setIsLoading(false);
            }
          } else {
            fireToastMessage({
              type: "error",
              message:
                "Please fill out bio, roles",
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
    }
  };

  const buildFormData = (values, formValues) => {
    const formData = new FormData();

    const appendData = (data) => {
      Object.entries(data).forEach(([key, value]) => {
        // ❌ skip null/undefined
        if (value === undefined || value === null) return;

        // ✅ FILE (only once)
        if (key === "imageFile") {
          formData.append("image", value);
          return;
        }

        // ✅ ARRAY
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
          return;
        }

        // ✅ OBJECT
        if (typeof value === "object") {
          formData.append(key, JSON.stringify(value));
          return;
        }

        // ✅ NORMAL VALUE
        formData.append(key, value);
      });
    };

    appendData(values);
    appendData(formValues);

    return formData;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <Step1 formRef={jobFormRef} initialValues={formValues}/>;
      case 1:
        return <CaregiverExperienceStep formRef={jobFormRef} initialValues={formValues} askExperience={false} />;
      case 2:
        return (
          <Step2 formRef={jobFormRef} daysState={daysState}
            setDaysState={setDaysState} initialValues={formValues}/>
        );
      case 3:
        return (
          <Step3 formRef={jobFormRef} initialValues={formValues}/>
        );
      case 4:
        return (
          <Step4 formRef={jobFormRef} initialValues={formValues}/>
        );
      case 5:
        return (
          <Step5 formRef={jobFormRef} initialValues={formValues}/>
        );
      case 6:
        return (
          <Step6 formRef={jobFormRef} image={image} handleImageChange={handleImageChange} initialValues={formValues}/>
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
      {/* Stepper Component */}
      <div className="lg:px-10 px-2">
        <CustomStepper
          totalSteps={totalStep}
          currentStep={currentStep}
        />
      </div>
      {/* ✅ Final success modal */}
      {/* {showSuccessModal && (
                <FinalSuccessModal
                    recordId={id}
                    onClose={() => {
                        setShowSuccessModal(false);
                        navigate("/");
                    }}
                />
            )} */}

      <div className="lg:mx-10 mx-2 px-4">
        <div className=" pb-4">
          <div className="flex justify-end lg:mr-6">
            <button onClick={() => navigate(-1)}>
              <X className="text-2xl" />
            </button>
          </div>

          <div className="px-4 pb-4 rounded-3xl">
            <div className="flex">
              <div className="flex flex-col w-full">{renderStepContent()}</div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
            <div className="flex justify-center py-4 space-x-4">
              {currentStep > 0 && (
                <CustomButton
                  action={() => {
                    if (currentStep > 0) {
                      setCurrentStep((prev) => prev - 1);
                    }
                  }}
                  btnText={"Back"}
                  className="border border-[#FFFFFF] text-[#555555]"
                />
              )}

              <CustomButton
                btnText={totalStep === currentStep ? "Submit Responses" : "Continue"}
                action={() => HandleNext()}
                isLoading={isLoading}
                loadingBtnText={"Saving Responses"}
                className="bg-[#AEC4FF]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// const FinalSuccessModal = ({ onClose, recordId }) => {
//     const navigate = useNavigate();

//     return (
//         <div
//             className="fixed inset-0 z-[999] flex items-center justify-center"
//             style={{
//                 backdropFilter: "blur(8px)",
//                 backgroundColor: "rgba(0,0,0,0.35)",
//             }}
//         >
//             <div
//                 className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4"
//                 style={{
//                     animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
//                 }}
//             >
//                 {/* Success Icon */}
//                 <div
//                     className="flex items-center justify-center rounded-full mb-5"
//                     style={{
//                         width: 68,
//                         height: 68,
//                         background: "#FFADE1",
//                         animation:
//                             "scaleIn 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
//                     }}
//                 >
//                     <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
//                         <path
//                             d="M7 16.5L13 22.5L25 10"
//                             stroke="white"
//                             strokeWidth="3"
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             style={{
//                                 strokeDasharray: 30,
//                                 strokeDashoffset: 0,
//                                 animation: "drawCheck 0.4s 0.3s ease both",
//                             }}
//                         />
//                     </svg>
//                 </div>

//                 <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">
//                     You’re all set! 🎉
//                 </h2>

//                 <p className="text-gray-600 text-sm mb-6 leading-relaxed">
//                     Thanks for sharing those details. We’ll use this information to
//                     manually match you into a nanny share and email you with an update
//                     within 24 hours.
//                 </p>

//                 <button
//                     type="button"
//                     onClick={() =>
//                         navigate(`/hire?recordId=${recordId || ""}`)
//                     }
//                     className="w-full block text-center bg-[#FFADE1] hover:bg-[#f99dd5] transition-colors rounded-full py-3 text-base Livvic-Bold text-black"
//                 >
//                     Set up my FamLink profile now
//                 </button>

//                 <p className="text-xs text-gray-500 mt-3 mb-4 leading-relaxed max-w-[280px]">
//                     Save and update your info, and view your nanny-share matches in one
//                     place.
//                 </p>

//                 <button
//                     type="button"
//                     onClick={onClose}
//                     className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
//                 >
//                     Close for now
//                 </button>
//             </div>

//             <style>{`
//         @keyframes popIn {
//           0%   { opacity: 0; transform: scale(0.85); }
//           100% { opacity: 1; transform: scale(1); }
//         }
//         @keyframes scaleIn {
//           0%   { transform: scale(0); }
//           100% { transform: scale(1); }
//         }
//         @keyframes drawCheck {
//           from { stroke-dashoffset: 30; }
//           to   { stroke-dashoffset: 0; }
//         }
//       `}</style>
//         </div>
//     );
// };

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
            stroke="#AEC4FF"
            strokeWidth="6"
            strokeOpacity="0.25"
          />
          <path
            d="M32 6 a26 26 0 0 1 26 26"
            stroke="#AEC4FF"
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
            className="block rounded-full bg-[#AEC4FF]"
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