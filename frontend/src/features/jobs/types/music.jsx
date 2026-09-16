import { useRef, useState } from "react";
import HireStep4 from "@features/hire/components/step4";

import { useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import { registerThunk } from "@features/auth/store/authSlice";
import Button from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function Music() {
  const [step, setStep] = useState(1);
  const hireStepFormRef = useRef(null);
  const [formData, setFormData] = useState();
  const v = useSelector((s) => s.additionalSer.value);
  const val = useSelector((s) => s.form);
  const valuesArray = Object.entries(v); // Get an array of [key, value] pairs
  const dispatch = useDispatch();
  // Find the index of 'specializedCaregiver'
  const specializedIndex = valuesArray.findIndex(
    ([key]) => key === "musicInstructor"
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
  const [cleanData, setCleanData] = useState();

  const navigate = useNavigate();
  const handleGoBack = () => {
    navigate("/joinNow"); // Navigate back in history
  };

  const Register = async () => {
    const beforeAddInfo = val.additionalInfo;
    const updatedAddInfo = [...beforeAddInfo];
    updatedAddInfo.push({
      key: "musicInstructor",
      value: { ...formData, specificTeachingMethod: cleanData },
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

            let cleanData = cleanFormData1(values);
            setFormData({ ...formData, musicalInstruments: cleanData });
            hireStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1); // Move to the next step
          } else {
            // Show an error message if no option is selected
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
    } else if (step == 2) {
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

            setFormData({ ...formData, perPreparation: values });
            hireStepFormRef.current.resetFields();
            setStep((prevStep) => prevStep + 1); // Move to the next step
          } else {
            // Show an error message if no option is selected
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
    if (step == 4) {
      hireStepFormRef.current
        .validateFields()
        .then(async (values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setCleanData(cleanFormData1(values));

            hireStepFormRef.current.resetFields();
            if (trueValuesAfterSpecialized.length > 0) {
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "musicInstructor",
                  value: { ...formData, specificTeachingMethod: cleanData },
                })
              );
              if (v.swimInstructor) {
                return navigate("/swimJob");
              } else if (v.houseManager) {
                return navigate("/houseManagerJob");
              }
            } else {
              Register();
            }
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
  };
  const step1Data = [
    {
      name: "Piano",
    },
    {
      name: "Guitar",
    },
    {
      name: "Violin",
    },
    {
      name: "Drums",
    },
    {
      name: "Voice",
    },
  ];
  const step2Data = [
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
  const step3Data = [
    {
      name: "Yes",
    },
    {
      name: "No",
    },
  ];
  const step4Data = [
    {
      name: "Suzuki",
    },
    {
      name: "Kodály",
    },
    {
      name: "Traditional",
    },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step1Data}
            checkBox={true}
            head={"Which musical instruments do you teach?"}
            inputName={"Type here..."}
            textAreaHead={"Other Preferences"}
          />
        );
      case 2:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step2Data}
            checkBox={true}
            inputNot={true}
            head={"At what levels do you teach?"}
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step3Data}
            inputNot={true}
            head={
              "Do you incorporate performance preparation in your lessons?"
            }
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            data={step4Data}
            checkBox={true}
            head={"Do you use a specific music teaching method?"}
            inputName={"Type here..."}
            textAreaHead={"Other Preferences"}
          />
        );
    }
  };
  return (
    <>
      <SEOMetaData
        title="Join as a Music Instructor | Create Your Profile"
        description="Sign up as a music instructor. Complete your profile by specifying the instruments you teach, teaching levels, performance preparation, and preferred music teaching methods to connect with students seeking qualified music instructors."
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
