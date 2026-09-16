import { useRef, useState } from "react";
import HireStep4 from "@features/hire/components/step4";
import { useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import { registerThunk } from "@features/auth/store/authSlice";
import CustomButton from "@shared/ui/Button";
import { toCamelCase } from "@shared/lib/toCamelCase";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function SportCoach() {
  const [step, setStep] = useState(1);
  const hireStepFormRef = useRef(null);
  const v = useSelector((s) => s.additionalSer.value);
  const dispatch = useDispatch();
  const [formData, setFormData] = useState();
  const valuesArray = Object.entries(v); // Get an array of [key, value] pairs
  const val = useSelector((s) => s.form);
  const [cleanData, setCleanData] = useState();
  // Find the index of 'specializedCaregiver'
  const specializedIndex = valuesArray.findIndex(
    ([key]) => key === "sportsCoaches"
  );

  // Extract only the true values after 'specializedCaregiver'
  const trueValuesAfterSpecialized = valuesArray
    .slice(specializedIndex + 1) // Get the entries after 'specializedCaregiver'
    .filter(([, value]) => value === true) // Filter only those with a value of true
    .map(([key]) => key);

  const handleBack = () => {
    if (step > 1) {
      // Move to the previous step
      setStep((prevStep) => prevStep - 1);
    }
  };

  const navigate = useNavigate();
  const handleGoBack = () => {
    navigate("/joinNow"); // Navigate back in history
  };
  const Register = async () => {
    const beforeAddInfo = val.additionalInfo;
    const updatedAddInfo = [...beforeAddInfo];
    updatedAddInfo.push({
      key: "sportCoach",
      value: { ...formData, avail: cleanData },
    });
    const result = await dispatch(
      registerThunk({ ...val, additionalInfo: updatedAddInfo, type: "Nanny" })
    );

    if (result.payload.status === 200) {
      fireToastMessage({
        success: true,
        message: "Your account was created successfully",
      });
      navigate("/login");
      window.location.reload();
    } else {
      fireToastMessage({ type: "error", message: result.payload.message });
    }
  };
  const handleNext = () => {
    if (step == 1) {
      hireStepFormRef.current
        .validateFields()
        .then((values) => {
          const selectedOptions = values.option || [];
          const textareaValue = values[toCamelCase("Type here...")];

          const hasAtLeastOne =
            selectedOptions.length > 0 || !!textareaValue?.trim();

          if (hasAtLeastOne) {
            // ✅ Valid input — proceed
            let cleanData = cleanFormData1(values);
            setFormData({ ...formData, sportType: cleanData });
            hireStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1);
          } else {
            // ❌ Neither checkbox nor textarea was used
            fireToastMessage({
              type: "error",
              message:
                "Please select at least one option or write in the text area.",
            });
          }
        })
        .catch((errorInfo) => {
          const errorMsg =
            errorInfo?.errorFields?.[0]?.errors?.[0] ||
            "Please complete the required fields.";
          fireToastMessage({ type: "error", message: errorMsg });
        });
    } else if (step == 2) {
      hireStepFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            let cleanData = cleanFormData1(values, "pleaseSpecify");
            setFormData({ ...formData, cert: cleanData });
            hireStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1); // Move to the next step
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }

          // setStep((prevStep) => prevStep + 1);
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (step == 3) {
      hireStepFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData({ ...formData, preCoachingTeam: values });
            hireStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1); // Move to the next step
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }

          // setStep((prevStep) => prevStep + 1);
        })
        .catch((errorInfo) => {
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    }
    if (step == 4) {
      hireStepFormRef.current
        .validateFields()
        .then(async (values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setCleanData(values);
            if (trueValuesAfterSpecialized.length > 0) {
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "sportCoach",
                  value: { ...formData, avail: cleanData },
                })
              );
              if (v.musicInstructor) {
                return navigate("/musicJob");
              } else if (v.swimInstructor) {
                return navigate("/swimJob");
              } else if (v.houseManager) {
                return navigate("/houseManagerJob");
              }
            } else {
              Register();
            }
          } else {
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
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
  const step1Data = [
    {
      name: "Soccer",
    },
    {
      name: "Basketball",
    },
    {
      name: "Tennis",
    },
    {
      name: "Swimming",
    },
    {
      name: "Golf",
    },
  ];
  const step2Data = [
    {
      name: "Yes",
    },
    {
      name: "No",
    },
  ];
  const step3Data = [
    {
      name: "Teams",
    },
    {
      name: "Individuals",
    },
    {
      name: "Both",
    },
  ];
  const step4Data = [
    {
      name: "Weekdays",
    },
    {
      name: "Weekends",
    },
    {
      name: "Evenings",
    },
    {
      name: "Flexible",
    },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What sports do you coach, and what is your coaching level?"}
            data={step1Data}
            checkBox={true}
            // subHead1={
            //   "What sports do you coach, and what is your coaching level?"
            // }
            inputName={"Type here..."}
            textAreaHead={"Other Preferences"}
          />
        );
      case 2:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={
              "Do you have any professional coaching certifications or training?"
            }
            data={step2Data}
            inputName={"Type here..."}
            textAreaHead={"Please Specify"}
            // subHead1={
            //   "Do you have any professional coaching certifications or training?"
            // }
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"Do you prefer coaching teams or individuals?"}
            data={step3Data}
            checkBox={true}
            inputNot={true}
            // subHead1={}
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What days and times are you available to coach?"}
            data={step4Data}
            checkBox={true}
            // subHead1={"What days and times are you available to coach?"}
            inputNot={true}
          />
        );
    }
  };
  return (
    <>
      <SEOMetaData
        title="Sports Coach Application - Join as a Professional Sports Coach"
        description="Apply to become a sports coach. Share the sports you coach, your certifications, coaching preferences, and availability to connect with families seeking professional coaching services."
      />
      <div className="padd-res">
        <div className=" py-4 px-4">
          <div className="flex justify-center">
            <div className="flex flex-col justify-between min-h-[calc(100vh - 6rem)]">
              {renderStepContent()}

              <div className="text-center my-5 space-x-4">
                {step > 1 && (
                  //   <button
                  //     style={{ border: "1px solid #AEC4FF" }}
                  //     className="py-2 bg-white rounded-full my-0 mx-6 px-10 text-base font-normal mt-2"
                  //     onClick={handleBack}
                  //   >
                  //     Back
                  //   </button>
                  <CustomButton
                    btnText={"Back"}
                    action={() => handleBack()}
                    className="border border-[#EEEEEE] text-[#555555]"
                  />
                )}

                {step <= 9 && (
                  <CustomButton
                    btnText={"Continue"}
                    action={() => handleNext()}
                    className="bg-[#AEC4FF] text-primary"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
