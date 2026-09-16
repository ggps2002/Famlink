import { useState, useRef, useEffect } from "react";
import { fireToastMessage } from "@shared/ui/toast";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import Button from "@shared/ui/Button";
import Screen1 from "@features/onboarding/family/Screen1";
import Screen2 from "@features/onboarding/family/Screen2";
import { registerThunk } from "@features/auth/store/authSlice";
import { buildRegistration, familyGoal } from "@features/onboarding/registration";
import { useDispatch } from "react-redux";

export const  FamilyOnboarding = () => {
    const { id } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const totalStep = 15;
    const [currentStep, setCurrentStep] = useState(0);
    // const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state
    const [sheetLoading, setSheetLoading] = useState(false);
    const [sheetUserData, setSheetUserData] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ modal state
    const [isTermsChecked, setIsTermsChecked] = useState(false);

    // Every screen on this page is rebuilt from the saved record — the location
    // in particular, which arrives as a JSON string in a sheet column. Parse it
    // once, here, and treat a record we can't read as no record at all: a
    // half-loaded one only fails later, deeper in, where it throws mid-render.
    const parseRecord = (record) => {
        try {
            const location = JSON.parse(record?.["Location"] || "");
            if (!location || typeof location !== "object") return null;
            return { ...record, parsedLocation: location };
        } catch {
            return null;
        }
    };

    // Without a usable record there is nothing to show. This used to leave a
    // blank page behind a toast, which is a dead end — and people now arrive
    // here from the "finish setting up your account" email, days after they
    // filled the form, by which time the record may be gone. Send them back to
    // the form so they can re-answer instead of staring at nothing.
    //
    // `replace` so the browser Back button doesn't bounce them straight into
    // the same broken page they were just rescued from.
    const bailToForm = (message) => {
        fireToastMessage({
            type: "error",
            message:
                message ||
                "We couldn't find your saved answers — please fill in the form again.",
        });
        navigate("/find-nanny-share", { replace: true });
    };

    useEffect(() => {
        const retrieveSheetRecord = async () => {
            if (!id) return bailToForm();

            const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
            if (!scriptUrl) {
                console.error("VITE_GOOGLE_SCRIPT_URL is not set.");
                return bailToForm();
            }

            try {
                setSheetLoading(true);

                const response = await fetch(
                    `${scriptUrl}?recordId=${encodeURIComponent(id)}`
                );
                const result = await response.json();
                const parsed =
                    result.status === "success" ? parseRecord(result.record) : null;

                if (parsed) {
                    setSheetUserData(parsed);
                } else {
                    bailToForm();
                }

            } catch (error) {
                console.error("Auto login error:", error);
                bailToForm();
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
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (currentStep == 1) {
            jobFormRef.current
                .validateFields()
                .then(async (values) => {
                    if (!values.email || !values.password) {
                        fireToastMessage({
                            type: "error",
                            message: "Please enter email and password",
                        });
                        return
                    }
                    setIsLoading(true);
                    try {


                        await Register(values.email, values.password)

                        setIsLoading(false);
                    } catch (errorInfo) {
                        fireToastMessage({
                            type: "error",
                            message:
                                errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
                        });
                    } finally {
                        setIsLoading(false);
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

    const Register = async (email, password) => {
        const { payload, missing } = buildRegistration({
            record: sheetUserData,
            sheetId: id,
            email,
            password,
            type: "Parents",
            goal: familyGoal(sheetUserData),
        });

        // The saved record is the only source for some of these — the screen
        // above collects an email, a password and a tickbox, and nothing else.
        // So a blank name used to travel to the server, come back as a Mongoose
        // validation error, and leave the member on a form with no field to
        // correct. Say what is missing instead of posting it.
        if (missing) {
            fireToastMessage({
                type: "error",
                message:
                    `We're missing your ${missing.join(" and ")}. ` +
                    "Please fill in the form again so we can finish setting up your account.",
            });
            return;
        }

        const result = await dispatch(registerThunk(payload))

        if (result.payload.status === 200) {
            fireToastMessage({
                success: true,
                message: 'Your account was created successfully'
            })
            navigate(`/login?recordId=${id}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`)
            window.location.reload()
        } else {
            fireToastMessage({ type: 'error', message: result.payload.message })
        }
    }

    const renderStepContent = () => {
        if (!sheetUserData) return null;
        switch (currentStep) {
            case 0:
                return <Screen1 formRef={jobFormRef} location={sheetUserData.parsedLocation} />;
            case 1:
                return (
                    <Screen2 formRef={jobFormRef} recordId={id} location={sheetUserData.parsedLocation} email={sheetUserData["Email"]} hasNanny={sheetUserData["Already have nanny"]} setIsTermsChecked={setIsTermsChecked} />
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
            {/* {showSuccessModal && (
                <FinalSuccessModal
                    recordId={id}
                    onClose={() => {
                        setShowSuccessModal(false);
                        navigate("/");
                    }}
                />
            )} */}

            <div className="lg:mx-10 mx-2 mb-10 px-4">
                <div className="pt-8 pb-4">
                    <div className="flex justify-end lg:mr-6">
                        <button onClick={() => navigate(-1)}>
                            <X className="text-2xl" />
                        </button>
                    </div>

                    <div className="px-4 rounded-3xl">
                        <div className="flex justify-center">
                            <div className="w-full">{renderStepContent()}</div>
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                        <div className="flex justify-center py-4 space-x-4">
                            {currentStep > 0 && currentStep != 1 && (
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

                            <div className="flex flex-col items-center">
                                {currentStep === 0 && <p className="Livvic-Bold text-primary text-lg mb-1">
                                    Create an account to connect
                                </p>}

                                <Button
                                    btnText={currentStep === 0 ? "Create Account" : "Continue"}
                                    action={() => HandleNext()}
                                    isLoading={isLoading}
                                    disabled={currentStep === 1 && !isTermsChecked}
                                    className="bg-[#AEC4FF]"
                                />
                            </div>
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
                Processing your responses…
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