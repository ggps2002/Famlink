import { useState, useRef } from "react";
import CustomStepper from "@shared/ui/Stepper";
import App from "@features/jobs/post/postAJob";
import HireStep4 from "@shared/ui/questionnaire/step4"; // Import your form component
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1, toCamelCase } from "@shared/lib/toCamelCase";
import MultiFormContainerCheck from "@shared/ui/questionnaire/MultipleChoice/MultipleChoiceCheck";
import { Form, Input } from "antd";
import HireStep3 from "@shared/ui/questionnaire/step3";
import { useJobSubmitter } from "@features/jobs/hooks/useJobSubmitter";
import { parseHourlyRate } from "@shared/lib/rates";
import Button from "@shared/ui/Button";

export const PrivateEducatorJob = () => {
  const stepRef = useRef(null);
  const [form] = Form.useForm();
  const { submitJob } = useJobSubmitter();
  const totalStep = 13;
  const [currentStep, setCurrentStep] = useState(1);
  const [showApp, setShowApp] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [textAreaValue, setTextAreaValue] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  );
  const [specialReq, setSpecialReq] = useState(null);

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Initialize the state in the parent component
  const [daysState, setDaysState] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { checked: false, start: null, end: null };
      return acc;
    }, {}),
  );

  // This function will update the state when passed down to HireStep3
  const updateDaysState = (updatedDaysState) => {
    setDaysState(updatedDaysState);
  };

  const jobFormRef = useRef(null);

  const step0Data = [
    { name: "Full-time" },
    { name: "Part-time" },
    { name: "Occasional" },
    { name: "Flexible" },
  ];

  const step1Data = [
    {
      heading: "Math",
      data: [
        { name: "Basic" },
        { name: "Algebra" },
        { name: "Geometry" },
        { name: "Calculus" },
      ],
    },
    {
      heading: "Sciences",
      data: [{ name: "Biology" }, { name: "Chemistry" }, { name: "Physics" }],
    },
    {
      heading: "Language Arts",
      data: [{ name: "Reading" }, { name: "Writing" }, { name: "Literature" }],
    },
    {
      heading: "Social Studies",
      data: [{ name: "History" }, { name: "Geography" }, { name: "Civics" }],
    },
    {
      heading: "Foreign Languages",
      data: [
        { name: "Spanish" },
        { name: "French" },
        { name: "Mandarin" },
        { name: "German" },
      ],
    },
    {
      heading: "Computer Science",
      data: [
        { name: "Coding" },
        { name: "Software Tools" },
        { name: "Web Design" },
      ],
    },
    {
      heading: "Test Preparation",
      data: [{ name: "SAT" }, { name: "ACT" }, { name: "AP Exams" }],
    },
    {
      heading: "Specialized Courses",
      data: [{ name: "Robotics" }, { name: "Environmental Science" }],
    },
  ];

  const step2Data = [
    { name: "Pre-School" },
    { name: "Elementary" },
    { name: "Middle School" },
    { name: "High School" },
  ];

  const step3Data = [
    { name: "Daily" },
    { name: "Weekly" },
    { name: "Bi-weekly" },
    { name: "Occasional" },
  ];

  const step4Data = [
    { name: "30 minutes" },
    { name: "1 hour" },
    { name: "2 hours" },
    { name: "Half-day (approximately 4 hours)" },
    { name: "Full-day (approximately 8 hours)" },
  ];

  const step5Data = [{ name: "In-person" }, { name: "Online" }];

  const step6Data = [
    { name: "$15 - $20 per hour" },
    { name: "$10 - $15 per hour" },
    { name: "$20 - $25 per hour" },
    { name: "$25 - $30 per hour" },
    { name: "$30 - $35 per hour" },
    { name: "$35+ per hour" },
  ];

  const step7Data = [
    { name: "Homework Help" },
    { name: "Subject-Specific Tutoring (e.g., Math, Science)" },
    { name: "Comprehensive Homeschooling" },
    { name: "Exam Preparation (e.g., SAT, ACT)" },
    { name: "Skill Enhancement (e.g., Writing, Problem-solving)" },
    { name: "Special Education Services" },
    { name: "Educational Play and Learning Activities" },
    { name: "Full Curriculum Teaching" },
  ];

  const step8Data = [
    { name: "Structured" },
    { name: "Flexible" },
    { name: "Hands-on" },
  ];

  const handleChange = (e) => {
    setTextAreaValue(e.target.value);
  };
  const HandleNext = async () => {
    if (currentStep == 1) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = {
              ...formValues,
              preferredSchedule: cleanData.option,
            }; // Merge with previous values
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
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
          // Get the keys of the form values to dynamically check all arrays
          const requiredFields = Object.keys(values);

          // Check if all required arrays have at least one value
          const hasErrors = requiredFields.some((field) => {
            const fieldValue = values[field];
            return Array.isArray(fieldValue) && fieldValue.length === 0; // Only check if the field is an array and is empty
          });

          if (hasErrors) {
            // Show an error message if any of the arrays are empty
            fireToastMessage({
              type: "error",
              message: "Each field must have at least one value.",
            });
          } else {
            Object.keys(values).forEach((key) => {
              if (values[key] === undefined || values[key] == "") {
                // Optional field, so we can ignore if undefined
                delete values[key]; // Optionally remove it if you don't want it in the final submission
              }
            });
            let updatedValues = { ...formValues, subjects: values }; // Merge with previous values
            setFormValues(updatedValues);
            // console.log(values)
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        })
        .catch((error) => {
          console.error("Form submission error:", error);
          fireToastMessage({
            type: "error",
            message: "Form submission failed. Please try again.",
          });
        });
    } else if (currentStep == 3) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = { ...formValues, gradeLevel: cleanData.option }; // Merge with previous values
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
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
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = { ...formValues, require: cleanData.option }; // Merge with previous values
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 5) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = {
              ...formValues,
              sessionTime: cleanData.option,
              ...(cleanData.otherPreferences && {
                sessionSpecify: cleanData.otherPreferences,
              }),
            };
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 6) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = { ...formValues, mode: cleanData.option }; // Merge with previous values
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 7) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (values.option) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = {
              ...formValues,
              hourlyRate: parseHourlyRate(cleanData.option),
              ...(cleanData.specify && {
                hourlyRateSpecify: cleanData.specify,
              }), // Correct conditional property assignment
            };
            // Merge with previous values
            setFormValues(updatedValues);
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 8) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          if (Array.isArray(values.option) && values.option?.length > 0) {
            // If form is valid, submit it and move to the next step
            let updatedValues = {
              ...formValues,
              goal: values.option,
              ...(values.otherPreferences && {
                goalSpecify: values.otherPreferences,
              }),
            };
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 9) {
      jobFormRef.current
        .validateFields()
        .then((values) => {
          // Check if the preferredLocation (or whatever your field is) has been set
          if (Array.isArray(values.option) && values.option?.length > 0) {
            // If form is valid, submit it and move to the next step
            let updatedValues = { ...formValues, style: values.option }; // Merge with previous values
            setFormValues(updatedValues);
            jobFormRef.current.resetFields();
            stepRef.current?.next();
            setCurrentStep((prev) => prev + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            // Show an error message if no option is selected
            fireToastMessage({
              type: "error",
              message: "Select at least one option",
            });
          }
        })
        .catch((errorInfo) => {
          // Handle validation failure
          fireToastMessage({
            type: "error",
            message:
              errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
          });
        });
    } else if (currentStep == 10) {
      const selectedDays = Object.entries(daysState).filter(
        ([day, { checked }]) => checked,
      );

      // if (selectedDays.length === 0) {
      //   fireToastMessage({
      //     type: 'error',
      //     message: 'At least one day must be selected.'
      //   })
      //   return
      // }

      let allValid = true; // Flag to check if all selected days have valid start and end times
      let invalidDays = [];

      // Loop through selected days to ensure each has a valid start and end time
      selectedDays.forEach(([day, { start, end }]) => {
        if (!start || !end) {
          allValid = false;
          invalidDays.push(day); // Collect days with missing start or end times
        } else if (start.isSame(end)) {
          allValid = false;
          invalidDays.push(day); // Collect days where start and end are the same
        } else if (end.isBefore(start)) {
          // Error if end time is before start time
          allValid = false;
          invalidDays.push(day); // Collect days where end is before start
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
        .filter(([day, data]) => data.checked) // Keep only those with checked: true
        .reduce((acc, [day, data]) => {
          // Convert start and end times to string (ISO format or any preferred format)
          const start = data.start.toISOString(); // Assuming start is a date object
          const end = data.end.toISOString(); // Assuming end is a date object

          acc[day] = {
            ...data,
            start, // Replace the start time with a string
            end, // Replace the end time with a string
          };
          return acc;
        }, {});

      if (selectedDays.length != 0) {
        let updatedValues = { ...formValues, specificDays: checkedDays };
        setFormValues(updatedValues);
      }
      stepRef.current?.next();
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentStep == 11) {
      if (specialReq?.length > 0) {
        const { specialRequirements, ...updatedFormValues } = formValues; // Remove specialRequirements
        setFormValues({
          ...updatedFormValues,
          specialRequirements: specialReq, // Add if specialReq exists
        });
      } else {
        const { specialRequirements, ...updatedFormValues } = formValues; // Remove specialRequirements
        setFormValues(updatedFormValues);
      }
      stepRef.current?.next();
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentStep == 12) {
      if (textAreaValue.length > 0) {
        await submitJob({
          jobType: "privateEducator",
          formValues,
          textAreaValue,
        });

        //stepRef.current?.next()
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        fireToastMessage({
          type: "error",
          message: "Please write the job description",
        });
      }
    }
  };
  if (showApp) {
    return <App />; // If showApp is true, render App component
  }
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            head={"What is your preferred schedule for childcare?"}
            data={step0Data}
            inputNot={true}
          />
        );
      case 2:
        return (
          <MultiFormContainerCheck
            formRef={jobFormRef || {}}
            addInput={{
              name: "Other Preferences",
              placeholder: "Type here...",
            }}
            head={"Which subject(s) does your child need help with?"}
            formData={step1Data}
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            head={"What is the grade level of your child?"}
            data={step2Data}
            inputNot={true}
          />
        );
      case 4:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            head={"How often do you require tutoring sessions?"}
            data={step3Data}
            inputNot={true}
          />
        );

      case 5:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            textAreaHead={"Other Preferences"}
            inputName={"Type here..."}
            head={"How long do you want each tutoring session to be?"}
            data={step4Data}
          />
        );

      case 6:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            inputNot={true}
            head={"Do you prefer in-person or online tutoring sessions?"}
            data={step5Data}
          />
        );
      case 7:
        return (
          <HireStep4
            formRef={jobFormRef || {}}
            head={"(Select an hourly rate or weekly salary range.)"}
            data={step6Data}
          />
        );
      case 8:
        return (
          <HireStep4
            checkBox={true}
            formRef={jobFormRef || {}}
            textAreaHead={"Other Preferences"}
            inputName={"Type here..."}
            head={"What are your specific goals for tutoring?"}
            data={step7Data}
          />
        );
      case 9:
        return (
          <HireStep4
            checkBox={true}
            formRef={jobFormRef || {}}
            inputNot={true}
            head={"Do you have a preference for the tutor's teaching style?"}
            data={step8Data}
          />
        );
      case 10:
        return (
          <HireStep3
            daysState={daysState}
            setDaysState={updateDaysState}
            head={
              "What days and times are you available for tutoring sessions?"
            }
          />
        );
      case 11:
        return (
          <div>
            <Form
              className="flex justify-center"
              form={form}
              name="validateOnly"
              autoComplete="off"
            >
              <div>
                <p className="mt-10 onboarding-head mb-6">
                  Do you have any special requirements or{" "}
                  <br className="max-lg:hidden" />
                  preferences for the tutor?
                </p>
                <Form.Item
                  name="specialRequirements"
                  rules={[
                    {
                      required: true,
                      message: "",
                    },
                  ]}
                >
                  <Input.TextArea
                    defaultValue={specialReq}
                    value={specialReq} // Controlled value
                    onChange={(e) => setSpecialReq(e.target.value)} // Handle input changes
                    placeholder={"Type here..."}
                    className="py-4 border-none !min-h-56 rounded-3xl no-resize"
                  />
                </Form.Item>
              </div>
            </Form>
          </div>
        );
      case 12:
        return (
          <div>
            <Form
              className="flex justify-center"
              form={form}
              name="validateOnly"
              autoComplete="off"
            >
              <div>
                <p className="mt-10 onboarding-head text-center mb-6">
                  Job Description
                </p>
                <Form.Item
                  name="jobDescription"
                  rules={[
                    {
                      required: true,
                      message: "",
                    },
                  ]}
                >
                  <div className="relative w-full">
                    <Form.Item
                      style={{ margin: 0, padding: 0 }}
                      name="jobDescription" // ✅ always use explicit `name`
                      rules={[
                        {
                          required: true,
                          message: "",
                        },
                      ]}
                    >
                      <Input.TextArea
                        defaultValue={textAreaValue}
                        value={textAreaValue} // Controlled value
                        onChange={handleChange} // Handle input changes
                        placeholder="Write your job description.."
                        rows={6}
                        className={`border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-8 pb-2 placeholder-transparent  no-resize w-[40vw] !min-h-56`}
                      />
                    </Form.Item>
                    <label
                      htmlFor={name}
                      className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10"
                    >
                      Job Description
                    </label>
                  </div>
                </Form.Item>
              </div>
            </Form>
          </div>
        );
    }
  };
  return (
    <div className="lg:px-5 Quicksand">
      {/* Stepper Component */}
      <div className="lg:px-10 px-2">
        <CustomStepper
          stepCount={totalStep}
          currentStep={currentStep}
          onChange={setCurrentStep}
          ref={stepRef}
        />
      </div>

      <div className="lg:mx-10 mx-2 my-10 px-4 ">
        <div className="pb-16 pt-8">
          <div className="flex flex-col items-center">
            {renderStepContent()}

            <div className="mt-4 flex gap-2">
              <Button
                action={() => {
                  if (currentStep > 1) {
                    stepRef.current?.prev();
                  } else {
                    setShowApp(true);
                  }
                }}
                btnText={"Back"}
                className="border border-[#FFFFFF] text-[#555555]"
              />
              <Button
                btnText={
                  totalStep - 1 == currentStep ? "Post a Job" : "Continue"
                }
                action={() => HandleNext()}
                className="bg-[#AEC4FF] text-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
