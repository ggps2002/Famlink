import { useRef, useState } from "react";
import HireStep4 from "@features/hire/components/step4";
import { useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import { useDispatch, useSelector } from "react-redux";
import { registerThunk } from "@features/auth/store/authSlice";
import Button from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function HouseManager() {
  const [step, setStep] = useState(1);
  const hireStepFormRef = useRef(null);
  const [formData, setFormData] = useState();
  const dispatch = useDispatch();
  const val = useSelector((s) => s.form);
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
  const [cleanData, setCleanData] = useState();
  const Register = async () => {
    const beforeAddInfo = val.additionalInfo;
    const updatedAddInfo = [...beforeAddInfo];
    updatedAddInfo.push({
      key: "houseManager",
      value: { ...formData, specialReq: cleanData },
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
            setFormData({ ...formData, experience: cleanData });
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

            setFormData({ ...formData, performHouseKeeping: values });
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

            setFormData({ ...formData, expMangeHouseholdBudget: values });
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
    } else if (step == 4) {
      hireStepFormRef.current
        .validateFields()
        .then(async (values) => {
          if (values.option?.length > 0) {
            // If form is valid, submit it and move to the next step

            setCleanData(values);
            hireStepFormRef.current.resetFields();
            Register();
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
  };

  const step1Data = [
    {
      name: "Staff Management",
    },
    {
      name: "Event Planning",
    },
    {
      name: "Budgeting",
    },
  ];
  const step2Data = [
    {
      name: "Full housekeeping",
    },
    {
      name: "Light duties only",
    },
    {
      name: "No housekeeping",
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
      name: "Full-time",
    },
    {
      name: "Part-time",
    },
    {
      name: "Live-in",
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
            head={"What type of house management experience do you have?"}
            data={step1Data}
            checkBox={true}
            subHead1={"What type of house management experience do you have?"}
            inputName={"Type here..."}
            textAreaHead={"Other Preferences"}
          />
        );
      case 2:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"Are you willing to perform housekeeping duties?"}
            data={step2Data}
            checkBox={true}
            inputNot={true}
            subHead1={"Are you willing to perform housekeeping duties?"}
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={
              "Do you have experience managing household budgets or finances?"
            }
            data={step3Data}
            inputNot={true}
            subHead1={
              "Do you have experience managing household budgets or finances?"
            }
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What is your availability for house management roles?"}
            data={step4Data}
            checkBox={true}
            subHead1={"What is your availability for house management roles?"}
            inputNot={true}
          />
        );
    }
  };
  return (
    <>
      <SEOMetaData
        title="Join as a House Manager | Create Your Profile"
        description="Sign up as a professional house manager. Complete your profile by specifying your experience in house management, housekeeping duties, budget management, and availability to connect with families seeking qualified house managers."
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
