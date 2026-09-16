import { useRef, useState } from "react";
import HireStep4 from "@features/hire/components/step4";
import { Form } from "antd";
import { useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { addOrUpdateAdditionalInfo } from "@shared/store/formValueSlice";
import { cleanFormData1 } from "@shared/lib/toCamelCase";
import { registerThunk } from "@features/auth/store/authSlice";
import Button from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function Tutor() {
  const [step, setStep] = useState(1);
  const hireStepFormRef = useRef(null);
  const [form] = Form.useForm();
  const [formData, setFormData] = useState();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [cleanData, setCleanData] = useState();
  const v = useSelector((s) => s.additionalSer.value);
  const val = useSelector((s) => s.form);
  // Count the number of true values

  let trueCount = Object.entries(v).reduce((count, [key, value]) => {
    if (key !== "nanny" && key !== "babysitter" && value === true) {
      return count + 1;
    }
    return count;
  }, 0);
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
      key: "tutorPrivateEducator",
      value: { ...formData, remOrPerson: cleanData },
    });
    const result = await dispatch(
      registerThunk({ ...val, additionalInfo: updatedAddInfo, type: "Nanny" })
    ).unwrap();

    if (result.status === 200) {
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
          if (values.qualSubject?.length > 0) {
            // If form is valid, submit it and move to the next step

            let cleanData = cleanFormData1(values);
            cleanData = cleanFormData1(cleanData, "pleaseSpecifyLanguage");
            setFormData((prev) => ({
              ...prev,
              qualSubject: { option: values.qualSubject }, // only step 1 values
            }));
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
          if (values.eduLevel?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData((prev) => ({
              ...prev,
              eduLevel: { option: values.eduLevel }, // only step 2 values
            }));
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
          if (values.teachStyle?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData((prev) => ({
              ...prev,
              teachStyle: { option: values.teachStyle },
            }));

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
        .then((values) => {
          if (values.ava?.length > 0) {
            // If form is valid, submit it and move to the next step

            setFormData((prev) => ({
              ...prev,
              ava: { option: values.ava },
            }));
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
    if (step == 5) {
      hireStepFormRef.current
        .validateFields()
        .then(async (values) => {
          if (values.remOrPerson?.length > 0) {
            // If form is valid, submit it and move to the next step

            setCleanData(values);

            if (trueCount > 1) {
              dispatch(
                addOrUpdateAdditionalInfo({
                  key: "tutorPrivateEducator",
                  value: {
                    ...formData,
                    remOrPerson: { option: values.remOrPerson },
                  },
                })
              );
              if (v.specializedCaregiver) {
                return navigate("/specialCaregiverJob");
              } else if (v.sportsCoaches) {
                return navigate("/sportCoachJob");
              } else if (v.musicInstructor) {
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
      name: "Mathematics",
    },
    {
      name: "Science",
    },
    {
      name: "English",
    },
    {
      name: "History",
    },
    {
      name: "Language",
      textArea: "Please Specify Language",
      val: "languageSpecify",
    },
    {
      name: "Computer Science",
    },
  ];
  const step2Data = [
    {
      name: "Elementary",
    },
    {
      name: "Middle School",
    },
    {
      name: "High School",
    },
    {
      name: "College",
    },
  ];
  const step3Data = [
    {
      name: "Lecture-based",
    },
    {
      name: "Interactive",
    },
    {
      name: "One-on-one",
    },
    {
      name: "Group Tutoring",
    },
    {
      name: "Blended Learning",
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
  const step5Data = [
    {
      name: "Remote Only",
    },
    {
      name: "In-Person Only",
    },
    {
      name: "Both",
    },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What subjects are you qualified to teach?"}
            data={step1Data}
            checkBox={true}
            subHead1={"What subjects are you qualified to teach?"}
            inputName={"Pleace specify..."}
            textAreaHead={"Other Preferences"}
            name={"qualSubject"}
          />
        );
      case 2:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"At what educational levels do you have experience teaching?"}
            data={step2Data}
            checkBox={true}
            inputNot={true}
            subHead1={
              "At what educational levels do you have experience teaching?"
            }
            name={"eduLevel"}
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What is your teaching style?"}
            data={step3Data}
            checkBox={true}
            subHead1={"What is your teaching style?"}
            inputNot={true}
            name={"teachStyle"}
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={"What is your availability for tutoring sessions?"}
            data={step4Data}
            checkBox={true}
            subHead1={"What is your availability for tutoring sessions?"}
            inputNot={true}
            name={"ava"}
          />
        );
      case 5:
        return (
          <HireStep4
            formRef={hireStepFormRef}
            head={
              "Are you able to offer remote learning sessions, or do you only teach in person?"
            }
            data={step5Data}
            checkBox={true}
            subHead1={
              "Are you able to offer remote learning sessions, or do you only teach in person?"
            }
            inputNot={true}
            name={"remOrPerson"}
          />
        );
    }
  };
  const handleGoBack = () => {
    navigate("/joinNow"); // Navigate back in history
  };
  return (
    <>
      <SEOMetaData
        title="Join as a Tutor or Private Educator | Create Your Profile"
        description="Sign up as a tutor, private educator, or subject specialist. Complete your profile, indicate your teaching subjects, educational levels, style, and availability to connect with students and families seeking qualified tutors."
      />

      <div className="padd-res min-h-[calc(100vh-6rem)]">
        <div className="py-4 px-4">
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
