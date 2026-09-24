import { useState, useRef, useEffect } from "react";
import { fireToastMessage } from "@shared/ui/toast";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import Step1 from "@features/onboarding/caregiver-share/CompleteProfile/Step1";
import Step2 from "@features/onboarding/caregiver-share/CompleteProfile/Step2";
import Step3 from "@features/onboarding/caregiver-share/CompleteProfile/Step3";
import Step4 from "@features/onboarding/caregiver-share/CompleteProfile/Step4";
import Step5 from "@features/onboarding/caregiver-share/CompleteProfile/Step5";
import Step6 from "@features/onboarding/caregiver-share/CompleteProfile/Step6";
import Step7 from "@features/onboarding/caregiver-share/CompleteProfile/Step7";
import FamilyStep7 from "@features/nanny-share/post/step7";
// The caregiver steps both flows share: the job flow's schedule, help, trust
// and profile screens ask exactly what the profile page shows for a caregiver.
import ScheduleStep from "@features/onboarding/caregiver-job/CompleteProfile/Step2";
import HelpStep from "@features/onboarding/caregiver-job/CompleteProfile/Step3";
import TrustStep from "@features/onboarding/caregiver-job/CompleteProfile/Step4";
import ProfileStep from "@features/onboarding/caregiver-job/CompleteProfile/Step6";
import CaregiverExperienceStep from "@features/onboarding/components/CaregiverExperienceStep";
import { emptyWeek, validateSchedule } from "@features/onboarding/schedule";
import { useDispatch, useSelector } from "react-redux";
import { setNannyProfileCompleted } from "@features/auth/store/authSlice";
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { parseHourlyRate } from "@shared/lib/rates";
import CustomStepper from "@shared/ui/Stepper";
import { resolveChildrenAges } from "@shared/lib/children";

export const Screen4 = () => {
    const { id } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedValue, setSelectedValue] = useState(null);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const totalStep = 11;
    const [currentStep, setCurrentStep] = useState(0);
    const [formValues, setFormValues] = useState({});

    const [image, setImage] = useState(null);
    const [file, setFile] = useState(null);
    const [daysState, setDaysState] = useState(emptyWeek);

    const handleImageChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            const imageUrl = URL.createObjectURL(selectedFile);
            setImage(imageUrl);
            setFile(selectedFile);
        }
    };

    const familyFormRef = useRef(null);

    // ✅ Save current fields before going back so initialValues works on return
    const goBack = () => {
        if (currentStep <= 0) return;
        const currentValues = familyFormRef.current?.getFieldsValue?.() || {};
        setFormValues(prev => ({ ...prev, ...currentValues }));
        setCurrentStep(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const HandleNext = async () => {
        if (currentStep < totalStep) {
            familyFormRef.current
                .validateFields()
                .then((values) => {

                    // Step 0 — Where care, start availability, flexibility
                    if (currentStep === 0) {
                        if (!values.whereCare || !values.startAvailability || !values.flexibility) {
                            fireToastMessage({ type: "error", message: "Please specify all the fields" });
                            return;
                        }
                        const childrenAges = resolveChildrenAges(values);

                        if (childrenAges.length === 0) {
                            fireToastMessage({
                                type: "error",
                                message: "Please provide all the child's ages",
                            });
                            return;
                        }
                        setFormValues(prev => ({
                            ...prev,
                            whereCare: values.whereCare,
                            numberOfChildren: childrenAges.length,
                            childrenAges,
                            startAvailability: values.startAvailability,
                            flexibility: values.flexibility,
                        }));
                    }

                    // Step 1 — Match fit, school/daycare
                    else if (currentStep === 1) {
                        if (!values.matchFit || !values.schoolDaycare) {
                            fireToastMessage({ type: "error", message: "Please specify all the fields" });
                            return;
                        }
                        setFormValues(prev => ({
                            ...prev,
                            matchFit: values.matchFit,
                            schoolDaycare: values.schoolDaycare,
                            ...(values.allergies && { allergies: values.allergies })
                        }));
                    }

                    // Step 2 — Step3 fields (add your specific fields here)
                    else if (currentStep === 2) {
                        setFormValues(prev => ({
                            ...prev,
                            ...values, // replace with explicit keys if you know them
                        }));
                    }

                    // Step 3 — Step4 fields
                    else if (currentStep === 3) {
                        setFormValues(prev => ({
                            ...prev,
                            ...values, // replace with explicit keys if you know them
                        }));
                    }

                    // Step 4 — Hourly rate (Step5)
                    else if (currentStep === 4) {
                        if (!values.hourlyRateSplit && !values.specifyHourlyRateSplit) {
                            fireToastMessage({ type: "error", message: "Please specify budget details" });
                            return;
                        }
                        const cleanData = cleanFormData1(values);
                        setFormValues(prev => ({
                            ...prev,
                            hourlyBudget: parseHourlyRate(cleanData.hourlyRateSplit),
                            hourlyBudgetSpecify: cleanData.specifyHourlyRateSplit,
                        }));
                    }

                    // Step 5 — Communication preference (FamilyStep7)
                    else if (currentStep === 5) {
                        if (!values.communicationPreference) {
                            fireToastMessage({ type: "error", message: "Please specify your communication preference" });
                            return;
                        }
                        setFormValues(prev => ({
                            ...prev,
                            communicationPreference: values.communicationPreference,
                            ...(values.matchMattersMost && {
                                matchMattersMost: values.matchMattersMost
                            })
                        }));
                    }

                    // Step 6 — Pets, distance, match (Step7)
                    else if (currentStep === 6) {
                        if (!values.hasPets || !values.okayWithPets || !values.matchDistance) {
                            fireToastMessage({ type: "error", message: "Please specify all the fields" });
                            return;
                        }
                        setFormValues(prev => ({
                            ...prev,
                            hasPets: values.hasPets,
                            okayWithPets: values.okayWithPets,
                            matchDistance: values.matchDistance,
                        }));
                    }

                    // Step 7 — Your experience (all optional)
                    else if (currentStep === 7) {
                        setFormValues(prev => ({ ...prev, ...values }));
                    }

                    // Step 8 — Weekly schedule (start date was asked on step 0)
                    else if (currentStep === 8) {
                        const { error, specificDays } = validateSchedule(daysState);
                        if (error) {
                            fireToastMessage({ type: "error", message: error });
                            return;
                        }
                        setFormValues(prev => ({ ...prev, specificDays }));
                    }

                    // Step 9 — Help with the children / around the house
                    else if (currentStep === 9) {
                        if (!values.responsibilities?.length || !values.householdHelp?.length) {
                            fireToastMessage({ type: "error", message: "Please specify all the fields" });
                            return;
                        }
                        setFormValues(prev => ({ ...prev, ...values }));
                    }

                    // Step 10 — Transportation and background check
                    else if (currentStep === 10) {
                        if (!values.hasTransport || !values.backgroundCheck) {
                            fireToastMessage({ type: "error", message: "Please specify all the fields" });
                            return;
                        }
                        setFormValues(prev => ({ ...prev, ...values }));
                    }

                    setCurrentStep(prev => prev + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                })
                .catch((errorInfo) => {
                    fireToastMessage({
                        type: "error",
                        message: errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
                    });
                });

        } else if (currentStep === totalStep) {
            // Step 11 — Bio, certifications, skills + image submit
            familyFormRef.current
                .validateFields()
                .then(async (values) => {
                    if (!values.bio) {
                        fireToastMessage({ type: "error", message: "Please fill out the bio field" });
                        return;
                    }
                    setIsLoading(true);
                    const formData = buildFormData(values, formValues);
                    if (file) formData.append("imageFile", file);
                    try {
                        await dispatch(nannyshareProfileThunk(formData));
                        fireToastMessage({ success: true, message: "Profile created" });
                        dispatch(setNannyProfileCompleted());
                        navigate("/dashboard");
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

    const buildFormData = (values, formValues) => {
        const formData = new FormData();
        const appendData = (data) => {
            Object.entries(data).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                if (key === "imageFile") { formData.append("image", value); return; }
                if (Array.isArray(value)) { formData.append(key, JSON.stringify(value)); return; }
                if (typeof value === "object") { formData.append(key, JSON.stringify(value)); return; }
                formData.append(key, value);
            });
        };
        appendData(values);
        appendData(formValues);
        return formData;
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: return <Step1 formRef={familyFormRef} initialValues={formValues} />;
            case 1: return <Step2 formRef={familyFormRef} initialValues={formValues} />;
            case 2: return <Step3 formRef={familyFormRef} initialValues={formValues} selectedValue={selectedValue}
                setSelectedValue={setSelectedValue}
                numberOfChildren={formValues?.numberOfChildren}
                childrenAges={
                    formValues?.childrenAges?.length
                    && formValues.childrenAges.map((age) => age.label).join(", ")
                }
                init />;
            case 3: return <Step4 formRef={familyFormRef} initialValues={formValues} />;
            case 4: return <FamilyStep7 petsInfo={false} formRef={familyFormRef} initialValues={formValues} />;
            case 5: return <Step6 formRef={familyFormRef} initialValues={formValues} />;
            case 6: return <Step7 formRef={familyFormRef} initialValues={formValues} />;
            case 7: return <CaregiverExperienceStep formRef={familyFormRef} initialValues={formValues} />;
            case 8: return <ScheduleStep formRef={familyFormRef} daysState={daysState} setDaysState={setDaysState} initialValues={formValues} askStart={false} />;
            case 9: return <HelpStep formRef={familyFormRef} initialValues={formValues} />;
            case 10: return <TrustStep formRef={familyFormRef} initialValues={formValues} />;
            case 11: return <ProfileStep formRef={familyFormRef} image={image} handleImageChange={handleImageChange} initialValues={formValues} />;
            default: return null;
        }
    };

    return (
        <div className="lg:px-5 Quicksand">
            {/* {isLoading && <LoadingModal />} */}
            {/* Stepper Component */}
            <div className="lg:px-10 px-2">
                <CustomStepper
                    totalSteps={totalStep}
                    currentStep={currentStep}
                />
            </div>
            <div className="lg:mx-10 mx-2 px-4">
                <div className="pb-4 pt-8">
                    <div className="px-4 pb-4 rounded-3xl">
                        <div className="flex">
                            <div className="flex flex-col w-full">{renderStepContent()}</div>
                        </div>
                    </div>
                    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50">
                        <div className="flex justify-center py-4 space-x-4">
                            {currentStep > 0 && (
                                <CustomButton
                                    action={goBack}  // ✅ use goBack instead of just setCurrentStep
                                    btnText={"Back"}
                                    className="border border-[#FFFFFF] text-[#555555]"
                                />
                            )}
                            <CustomButton
                                btnText={totalStep === currentStep ? "Submit Responses" : "Continue"}
                                action={HandleNext}
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