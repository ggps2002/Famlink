import { useRef, useState } from "react";
import HireStep4 from "@features/hire/components/step4";
import { useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import { registerThunk } from "@features/auth/store/authSlice";
import Button from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function Swim() {
  const [step, setStep] = useState(1);
  const hireStepFormRef = useRef(null);
  const [formData, setFormData] = useState();
  const [cleanData, setCleanData] = useState();
  const dispatch = useDispatch();
  const v = useSelector((s) => s.additionalSer.value);
  const val = useSelector((s) => s.form);
  const valuesArray = Object.entries(v); // Get an array of [key, value] pairs

  // Find the index of 'specializedCaregiver'
  const specializedIndex = valuesArray.findIndex(
    ([key]) => key === "swimInstructor"
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
  const Register = async () => {
    const beforeAddInfo = val.additionalInfo;
    const updatedAddInfo = [...beforeAddInfo];
    updatedAddInfo.push({
      key: "swimInstructor",
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
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData({ ...formData, cert: values });
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
    if (step == 2) {
      hireStepFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData({ ...formData, ageGroup: values });
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
    if (step == 3) {
      hireStepFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData({ ...formData, level: values });
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
                  key: "swimInstructor",
                  value: { ...formData, avail: cleanData },
                })
              );
              if (v.houseManager) {
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
      name: "Yes",
    },
    {
      name: "No",
    },
  ];
  const step2Data = [
    {
      name: "Toddlers",
    },
    {
      name: "Children",
    },
    {
      name: "Teens",
    },
    {
      name: "Adults",
    },
  ];
  const step3Data = [
    {
      name: "Beginner",
    },
    {
      name: "Intermediate",
    },
    {
      name: "Advanced",
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
      name: "Mornings",
    },
    {
      name: "Afternoons",
    },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step1Data}
            inputNot={true}
            head={
              "Are you certified in swim instruction and life-saving techniques?"
            }
          />
        );
      case 2:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step2Data}
            checkBox={true}
            inputNot={true}
            head={"What age groups do you specialize in teaching?"}
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step3Data}
            checkBox={true}
            inputNot={true}
            head={"Which swim levels do you teach?"}
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step4Data}
            checkBox={true}
            head={"What is your availability for swim lessons?"}
            inputNot={true}
          />
        );
    }
  };
  const navigate = useNavigate();
  const handleGoBack = () => {
    navigate("/joinNow"); // Navigate back in history
  };
  return (
    <>
      <SEOMetaData
        title="Join as a Swim Coach | Create Your Profile"
        description="Sign up as a professional swim coach. Complete your profile, specify your coaching experience, availability, and session type to connect with swimmers and families looking for qualified swim instructors."
      />

      <div className="padd-res">
        <div className="rounded-3xl py-4 px-4">
          <div className="flex justify-end">
            <button onClick={handleGoBack}>
              <CloseOutlined style={{ fontSize: "24px" }} />
            </button>
          </div>
          <div className="flex justify-center">
            <div className="flex flex-col justify-between">
              {renderStepContent()}

              <div className="my-5 flex gap-4 justify-center">
                {step > 1 && (
                  // <button
                  //   style={{ border: "1px solid #AEC4FF" }}
                  //   className="py-2 bg-white rounded-full my-0 mx-6 px-10 text-base font-normal mt-2"
                  //   onClick={handleBack}
                  // >
                  //   Back
                  // </button>
                  <Button
                    btnText={"Back"}
                    action={() => handleBack()}
                    className="border border-[#EEEEEE]"
                  />
                )}
                {step < 10 && (
                  // <button
                  //   style={{ background: "#85D1F1" }}
                  //   className="py-2 rounded-full my-0 mx-auto px-6 text-base font-normal transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-700 "
                  //   onClick={handleNext}
                  // >
                  //   Continue
                  // </button>
                  <Button
                    btnText={"Continue"}
                    action={() => handleNext()}
                    className="bg-blue-300"
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
