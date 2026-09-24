import { useState, useRef, useEffect } from "react";
import { fireToastMessage } from "@shared/ui/toast";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import Screen1 from "@features/onboarding/caregiver-job/Screen1";
import Screen2 from "@features/onboarding/caregiver-job/Screen2";
import Screen3 from "@features/onboarding/caregiver-job/Screen3";
import { registerThunk } from "@features/auth/store/authSlice";
import { buildRegistration } from "@features/onboarding/registration";
import { useDispatch } from "react-redux";
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";
import { InputDa } from "@shared/ui/Input";
import { ALLOWED_ZIPCODES, resolveZip } from "@shared/lib/serviceArea";
import { sendWaitlistConfirmation } from "@features/waitlist/waitlistEmail";
import { buildDetails, submitWaitlistEntry, WAITLIST_SOURCE } from "@features/waitlist/waitlistSubmit";
import { Form } from "antd";
import { fetchOnboardingRecord, saveOnboardingRecord } from "@features/onboarding/onboardingRecord"; // assuming antd is used based on validateFields usage

export const JobQuestionnaire = () => {
    const { id } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [modalState, setModalState] = useState("idle");
    const totalStep = 15;
    const [currentStep, setCurrentStep] = useState(0);
    const [formValues, setFormValues] = useState({});
    const [sheetLoading, setSheetLoading] = useState(false);
    const [sheetUserData, setSheetUserData] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [waitlistLocation, setWaitlistLocation] = useState(null);
    const [waitlistValues, setWaitlistValues] = useState({});
    const [isTermsChecked, setIsTermsChecked] = useState(false);

    useEffect(() => {
        const retrieveSheetRecord = async () => {
            if (!id) return;
            // [Google Sheet — replaced by the onboarding-records API; kept for reference]
            // const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
            // if (!scriptUrl) {
            //     fireToastMessage({ type: "error", message: "Google Script URL is missing." });
            //     return;
            // }
            try {
                setSheetLoading(true);
                // [Google Sheet — replaced by the onboarding-records API; kept for reference]
                // const response = await fetch(`${scriptUrl}?recordId=${encodeURIComponent(id)}`);
                // const result = await response.json();
                const result = await fetchOnboardingRecord(id);
                if (result.status === "success" && result.record) {
                    setSheetUserData(result.record);
                } else {
                    fireToastMessage({ type: "error", message: result.message || "Could not load saved data" });
                }
            } catch (error) {
                console.error("Auto login error:", error);
                fireToastMessage({ type: "error", message: "Failed to log in from record." });
            } finally {
                setSheetLoading(false);
            }
        };
        retrieveSheetRecord();
    }, [id]);

    const jobFormRef = useRef(null);

    const HandleNext = async () => {
        if (currentStep === 0) {
            jobFormRef.current
                .validateFields()
                .then(async (values) => {
                    if (!values.location || !values.experience || !values.nannyShareType || !values.distance) {
                        fireToastMessage({ type: "error", message: "Please specify all the fields" });
                        return;
                    }

                    // ── ZIP CODE CHECK ──
                    // Google omits postal_code from city / neighborhood picks, so this
                    // may fall back to a geocode lookup on the coordinates.
                    const zip = await resolveZip(values.location);
                    if (!zip || !ALLOWED_ZIPCODES.has(zip)) {
                        setWaitlistLocation(values.location);
                        setWaitlistValues(values); // ← add this
                        setModalState("waitlist");
                        return;
                    }

                    setFormValues((prev) => ({ ...prev, ...values }));
                    setCurrentStep((prev) => prev + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                })
                .catch((errorInfo) => {
                    fireToastMessage({
                        type: "error",
                        message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
                    });
                });
        } else if (currentStep === 1) {
            jobFormRef.current
                .validateFields()
                .then(() => {
                    setCurrentStep((prev) => prev + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                })
                .catch((errorInfo) => {
                    fireToastMessage({
                        type: "error",
                        message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
                    });
                });
        } else if (currentStep === 2) {
            jobFormRef.current
                .validateFields()
                .then(async (values) => {
                    if (!values.email || !values.password) {
                        fireToastMessage({ type: "error", message: "Please enter email and password" });
                        return;
                    }
                    if (!id) {
                        console.error("No record ID found in URL");
                        return;
                    }
                    const payload = {
                        action: "update",
                        Id: id,
                        Location: JSON.stringify(formValues.location),
                        Email: values.email,
                        Distance: formValues.distance,
                        Experience: formValues.experience,
                        Type: formValues.nannyShareType,
                    };
                    // [Google Sheet — replaced by the onboarding-records API; kept for reference]
                    // const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
                    // if (!scriptUrl) {
                    //     console.warn("VITE_GOOGLE_SCRIPT_URL is not set. Data:", payload);
                    //     await new Promise((r) => setTimeout(r, 1400));
                    //     return;
                    // }
                    // const formData = new URLSearchParams(payload).toString();
                    setIsLoading(true);
                    try {
                        // [Google Sheet — replaced by the onboarding-records API; kept for reference]
                        // await fetch(scriptUrl, {
                        //     method: "POST",
                        //     headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        //     body: formData,
                        // });
                        await saveOnboardingRecord(payload);
                        await Register(values.email, values.password);
                        setIsLoading(false);
                    } catch (errorInfo) {
                        fireToastMessage({
                            type: "error",
                            message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
                        });
                    } finally {
                        setIsLoading(false);
                    }
                })
                .catch((errorInfo) => {
                    fireToastMessage({
                        type: "error",
                        message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
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
            type: "Nanny",
            goal: "Looking for nanny share job",
            location: { ...formValues.location, distance: formValues.distance },
        });

        // See the note in FamilyOnboarding: the name can only come from the
        // saved record, so an empty one has to be reported here rather than
        // posted and rejected.
        if (missing) {
            fireToastMessage({
                type: "error",
                message:
                    `We're missing your ${missing.join(" and ")}. ` +
                    "Please fill in the form again so we can finish setting up your account.",
            });
            return;
        }

        const result = await dispatch(registerThunk(payload));
        if (result.payload.status === 200) {
            fireToastMessage({ success: true, message: "Your account was created successfully" });
            navigate(`/login?recordId=${id}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
            window.location.reload();
        } else {
            fireToastMessage({ type: "error", message: result.payload.message });
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: return <Screen1 formRef={jobFormRef} />;
            case 1: return <Screen2 formRef={jobFormRef} distance={formValues.distance} location={formValues.location} />;
            case 2: return <Screen3 formRef={jobFormRef} recordId={id} location={formValues.location} distance={formValues.distance} careType={formValues.nannyShareType} careExperience={formValues.experience} setIsTermsChecked={setIsTermsChecked} />;
            default: return null;
        }
    };

    if (id && sheetLoading) return <SheetLoadingModal />;

    return (
        <div className="lg:px-5 Quicksand">
            {isLoading && <LoadingModal />}

            {/* ── Waitlist Modal ── */}
            {modalState === "waitlist" && (
                <WaitlistModal
                    name={sheetUserData?.["Name"]}
                    location={waitlistLocation}
                    experience={waitlistValues.experience}
                    distance={waitlistValues.distance}
                    nannyShareType={waitlistValues.nannyShareType}
                    onClose={() => setModalState("idle")}
                    onSuccess={() => setModalState("waitlist-success")}
                />
            )}

            {/* ── Waitlist Success Modal ── */}
            {modalState === "waitlist-success" && (
                <WaitlistSuccessModal onClose={() => { setModalState("idle"); navigate("/"); }} />
            )}

            <div className="lg:mx-10 mx-2 px-4">
                <div className="lg:pt-8 pb-4">
                    <div className="px-4 pt-4 pb-20 rounded-3xl">
                        <div className="flex justify-center">
                            <div className="flex flex-col w-full">{renderStepContent()}</div>
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                        <div className="flex justify-center py-4 space-x-4">
                            {currentStep > 0 && currentStep !== 1 && (
                                <CustomButton
                                    action={() => { if (currentStep > 0) setCurrentStep((prev) => prev - 1); }}
                                    btnText={"Back"}
                                    className="border border-[#FFFFFF] text-[#555555]"
                                />
                            )}
                            <div className="flex flex-col items-center">
                                {currentStep === 1 && (
                                    <p className="Livvic-Bold text-primary text-lg mb-1">Create an account to connect</p>
                                )}
                                <CustomButton
                                    btnText={currentStep === 0 ? "See Matches Near You" : currentStep === 1 ? "Create Account" : "Continue"}
                                    action={() => HandleNext()}
                                    isLoading={isLoading}
                                    disabled={currentStep === 2 && !isTermsChecked}
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

/* ─────────────────────────────────────────
   Waitlist Modal  (with email input)
───────────────────────────────────────── */
const WaitlistModal = ({ onClose, name, location, experience, distance, nannyShareType, onSuccess }) => {
    const [form] = Form.useForm();
    const [submitState, setSubmitState] = useState("idle"); // idle | loading

    const handleJoinWaitlist = async () => {
        let values;
        try {
            values = await form.validateFields();
        } catch {
            // antd field-level validation — the message is already on the field
            return;
        }

        setSubmitState("loading");

        // Built once and sent to both the sheet and our own waitlist record, so
        // the two can't drift apart. It used to go only to the sheet, which is
        // why caregivers showed up in the admin waitlist with no answers at all
        // while families showed theirs.
        const details = buildDetails([
            ["Experience", experience],
            ["Distance", distance],
            ["Share type", nannyShareType],
        ]);

        try {
            await submitWaitlistEntry({
                source: WAITLIST_SOURCE.CAREGIVER_JOB,
                name,
                email: values.email,
                location,
                details,
            });
        } catch (err) {
            console.error("Waitlist submission error:", err);
            fireToastMessage({
                type: "error",
                message: "Couldn't add you to the waitlist. Please try again.",
            });
            setSubmitState("idle");
            return;
        }

        // userType too: without it the row lands as "unknown" and the console
        // can't tell a waiting caregiver from a waiting family.
        await sendWaitlistConfirmation({
            email: values.email,
            name,
            location,
            userType: "Nanny",
            details,
        });

        setSubmitState("idle");
        onSuccess();
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center backdrop-blur-md bg-black/35">
            <div
                className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4"
                style={{ animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
            >
                {/* Icon */}
                <div
                    className="flex items-center justify-center rounded-full mb-5 bg-blue-50"
                    style={{
                        width: 72, height: 72,
                        animation: "scaleIn 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
                    }}
                >
                    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                        <path d="M10 5 H28 L19 18 L28 31 H10 L19 18 Z" fill="#AEC4FF" fillOpacity="0.18" stroke="#AEC4FF" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M12 7.5 H26 L19 16 Z" fill="#AEC4FF" fillOpacity="0.7" />
                        <path d="M14 28.5 H24 L19 22 Z" fill="#AEC4FF" />
                        <line x1="19" y1="17" x2="19" y2="21" stroke="#AEC4FF" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 2" />
                        <rect x="9" y="4" width="20" height="2.5" rx="1.25" fill="#AEC4FF" />
                        <rect x="9" y="31.5" width="20" height="2.5" rx="1.25" fill="#AEC4FF" />
                        <circle cx="30" cy="8" r="1.2" fill="#AEC4FF" fillOpacity="0.6" />
                        <circle cx="33" cy="13" r="0.8" fill="#AEC4FF" fillOpacity="0.4" />
                        <circle cx="8" cy="30" r="1" fill="#AEC4FF" fillOpacity="0.5" />
                    </svg>
                </div>

                {/* Badge */}
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 bg-blue-50 border border-blue-100">
                    <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#AEC4FF]" />
                    <span className="text-xs Livvic-SemiBold text-[#AEC4FF]">Coming soon to your area</span>
                </div>

                <h2 className="text-2xl Livvic-SemiBold text-primary mb-2 leading-snug">
                    Good things take time ⏳
                </h2>
                <p className="text-gray-500 text-base mb-6 leading-relaxed">
                    We're not quite in your area yet — but we're growing fast.{" "}
                    <span className="Livvic-SemiBold text-gray-700">Join the waitlist</span> and we'll reach out{" "}
                    <span className="Livvic-SemiBold text-gray-700">the moment we're available near you.</span>
                </p>

                {/* Email input via antd Form */}
                <div className="w-full mb-5 text-left">
                    <Form form={form} layout="vertical">
                        <InputDa
                            type="email"
                            name="email"
                            emailVer={true}
                            form={form}
                            placeholder="Enter your email"
                            labelText="Your email"
                        />
                    </Form>
                </div>

                {/* CTA */}
                <CustomButton
                    type="button"
                    onClick={handleJoinWaitlist}
                    disabled={submitState === "loading"}
                    className="w-full flex items-center justify-center gap-2 text-center bg-[#AEC4FF] disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3 px-0"
                >
                    {submitState === "loading" ? (
                        <>
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="animate-spin shrink-0">
                                <circle cx="9" cy="9" r="7" stroke="rgba(0,0,0,0.2)" strokeWidth="2.5" />
                                <path d="M9 2 a7 7 0 0 1 7 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                            Joining waitlist…
                        </>
                    ) : (
                        "Join Waitlist"
                    )}
                </CustomButton>

                <CustomButton
                    type="button"
                    onClick={onClose}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-0 py-0 rounded-none Livvic"
                >
                    Maybe later
                </CustomButton>
            </div>

            <style>{`
                @keyframes popIn  { 0%{opacity:0;transform:scale(0.85)} 100%{opacity:1;transform:scale(1)} }
                @keyframes scaleIn{ 0%{transform:scale(0)}              100%{transform:scale(1)}             }
            `}</style>
        </div>
    );
};

/* ─────────────────────────────────────────
   Waitlist Success Modal
───────────────────────────────────────── */
const WaitlistSuccessModal = ({ onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
        <div
            className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4"
            style={{ animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
            {/* Check circle */}
            <div
                className="flex items-center justify-center rounded-full mb-5 bg-gradient-to-br from-[#AEC4FF] to-[#7499ff] shadow-[0_8px_24px_rgba(174,196,255,0.45)]"
                style={{
                    width: 72, height: 72,
                    animation: "scaleIn 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
            >
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <path
                        d="M8 17.5L14 23.5L26 11"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="32"
                        strokeDashoffset="0"
                        style={{ animation: "drawCheck 0.45s 0.35s ease both" }}
                    />
                </svg>
            </div>

            {/* Confetti dots */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full pointer-events-none" aria-hidden="true">
                {[
                    { left: "20%", top: "0px", color: "#AEC4FF", size: 7, delay: "0.3s" },
                    { left: "35%", top: "-8px", color: "#AEC4FF", size: 5, delay: "0.4s" },
                    { left: "50%", top: "-4px", color: "#AEC4FF", size: 6, delay: "0.25s" },
                    { left: "65%", top: "-10px", color: "#AEC4FF", size: 5, delay: "0.45s" },
                    { left: "78%", top: "0px", color: "#AEC4FF", size: 7, delay: "0.35s" },
                ].map((dot, i) => (
                    <span
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            left: dot.left, top: dot.top,
                            width: dot.size, height: dot.size,
                            background: dot.color,
                            animation: `confettiFall 0.6s ${dot.delay} cubic-bezier(0.22,1,0.36,1) both`,
                        }}
                    />
                ))}
            </div>

            {/* Badge */}
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 bg-blue-50 border border-blue-100">
                <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#AEC4FF]" />
                <span className="text-xs Livvic-SemiBold text-[#AEC4FF]">Coming soon to your area</span>
            </div>

            <h2 className="text-3xl Livvic-Bold text-primary mb-2 leading-snug">
                Famlink is <br />
                <span className="text-[#7499ff] Livvic-Bold">expanding near you</span>
            </h2>

            <p className="text-gray-500 text-base Livvic-Medium mb-6 leading-relaxed">
                We're actively expanding into new areas and{" "}
                <span className="text-[#7499ff] Livvic-Medium">you've been added to the waitlist.</span>{" "}
                We'll reach out as soon as Famlink becomes available near you.
            </p>

            <CustomButton
                type="button"
                onClick={onClose}
                className="w-full text-center bg-[#AEC4FF] hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black px-0"
            >
                Back to Homepage
            </CustomButton>
        </div>

        <style>{`
            @keyframes popIn       { 0%{opacity:0;transform:scale(0.85)} 100%{opacity:1;transform:scale(1)}  }
            @keyframes scaleIn     { 0%{transform:scale(0)}              100%{transform:scale(1)}              }
            @keyframes drawCheck   { from{stroke-dashoffset:32}          to{stroke-dashoffset:0}               }
            @keyframes confettiFall{
                0%  {opacity:0;transform:translateY(-12px) scale(0)}
                60% {opacity:1;transform:translateY(4px) scale(1.2)}
                100%{opacity:.7;transform:translateY(0px) scale(1)}
            }
        `}</style>
    </div>
);

/* ─────────────────────────────────────────
   Loading Modal  (unchanged)
───────────────────────────────────────── */
const LoadingModal = () => (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }}>
        <div className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4" style={{ animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div className="mb-5" style={{ width: 64, height: 64 }}>
                <svg viewBox="0 0 64 64" fill="none" style={{ animation: "spin 1s linear infinite", width: 64, height: 64 }}>
                    <circle cx="32" cy="32" r="26" stroke="#FFADE1" strokeWidth="6" strokeOpacity="0.25" />
                    <path d="M32 6 a26 26 0 0 1 26 26" stroke="#FFADE1" strokeWidth="6" strokeLinecap="round" />
                </svg>
            </div>
            <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">Processing your responses…</h2>
            <p className="text-gray-400 text-sm leading-relaxed">We're processing your responses. Just a moment!</p>
            <div className="flex gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                    <span key={i} className="block rounded-full bg-[#FFADE1]" style={{ width: 8, height: 8, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
            </div>
        </div>
        <style>{`
            @keyframes popIn { 0%{opacity:0;transform:scale(0.85)} 100%{opacity:1;transform:scale(1)} }
            @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            @keyframes bounce{ 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }
        `}</style>
    </div>
);

/* ─────────────────────────────────────────
   Sheet Loading Modal  (unchanged)
───────────────────────────────────────── */
const SheetLoadingModal = () => (
    <div className="fixed inset-0 z-[999] flex items-center justify-center" style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }}>
        <div className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4" style={{ animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div className="mb-5" style={{ width: 64, height: 64 }}>
                <svg viewBox="0 0 64 64" fill="none" style={{ animation: "spin 1s linear infinite", width: 64, height: 64 }}>
                    <circle cx="32" cy="32" r="26" stroke="#AEC4FF" strokeWidth="6" strokeOpacity="0.25" />
                    <path d="M32 6 a26 26 0 0 1 26 26" stroke="#AEC4FF" strokeWidth="6" strokeLinecap="round" />
                </svg>
            </div>
            <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">Please Wait…</h2>
            <p className="text-gray-400 text-sm leading-relaxed">We're processing your responses. Just a moment!</p>
            <div className="flex gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                    <span key={i} className="block rounded-full bg-[#AEC4FF]" style={{ width: 8, height: 8, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
            </div>
        </div>
        <style>{`
            @keyframes popIn { 0%{opacity:0;transform:scale(0.85)} 100%{opacity:1;transform:scale(1)} }
            @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            @keyframes bounce{ 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }
        `}</style>
    </div>
);