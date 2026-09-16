import { useState, useRef } from "react";
import CustomStepper from "@shared/ui/Stepper";
import App from "@features/jobs/post/postAJob";
import HireStep4 from "@features/hire/components/step4"; // Import your form component
import { fireToastMessage } from "@shared/ui/toast";
import { cleanFormData1, toCamelCase } from "@shared/lib/toCamelCase";
import MultiFormContainerCheck from "@features/hire/components/MultipleChoice/MultipleChoiceCheck";
import MultiFormContainer from "@features/hire/components/MultipleChoice/multipleChoice";
import { Form, Input } from "antd";
import HireStep3 from "@features/hire/components/step3";
import { useJobSubmitter } from "@features/jobs/hooks/useJobSubmitter";
import { parseHourlyRate } from "@shared/lib/rates";
import { useDispatch } from "react-redux";
import { postPostJob } from "@features/jobs/store/postJobSlice";
import Button from "@shared/ui/Button";

export const NannyJob = () => {
  const stepRef = useRef(null);
  const { submitJob } = useJobSubmitter();
  const [form] = Form.useForm();
  const totalStep = 7;
  const [currentStep, setCurrentStep] = useState(1);
  const [showApp, setShowApp] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [textAreaValue, setTextAreaValue] = useState(
    "We’re looking for a kind, reliable nanny to help with school pickup, homework, and playtime for our 6-year-old. Hours are 2:30–6:30 PM, Mon/Wed/Fri. Must love dogs and have own transportation. Let me know the child’s age, schedule, or any special needs if you want it customized!",
  );

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

  const nannyJobFormRef = useRef(null);

  const step1Data = [
    { name: "Full-time" },
    { name: "Part-time" },
    { name: "Occasional" },
    { name: "Flexible" },
  ];

  const step2Data = [
    { name: "$10 - $15 per hour" },
    { name: "$15 - $20 per hour" },
    { name: "$20 - $25 per hour" },
    { name: "$25 - $30 per hour" },
    { name: "$30 - $35 per hour" },
    { name: "$35+ per hour" },
  ];

  const step3Data = [
    {
      heading: "Language Skills",
      input: "Specify Language",
      subHeading: "Non-English speaking is acceptable",
      data: [{ name: "English" }, { name: "Bilingual" }],
    },
    {
      heading: "Certifications",
      data: [
        { name: "CPR/First Aid Certified" },
        { name: "Early Childhood Education" },
        { name: "Special Needs Training" },
      ],
    },

    {
      heading: "Driving Ability",
      data: [
        { name: "Must have a valid driver's license" },
        { name: "Owns a car" },
        { name: "Using caregiver's car" },
        { name: "Using family's car" },
      ],
    },
    {
      heading: "Availability",
      data: [{ name: "Weekdays" }, { name: "Weekends" }, { name: "Evenings" }],
    },
    {
      heading: "Other Skills",
      data: [
        { name: "Pet care" },
        { name: "Homework assistance" },
        { name: "Swimming supervision" },
      ],
    },
  ];

  const step4Data = [
    {
      heading: "House Management Cleaning",
      data: [
        { name: "Child-related only" },
        { name: "Child-related and general household tasks" },
        { name: "None" },
      ],
    },
    {
      heading: "Cooking",
      data: [
        { name: "For children only" },
        { name: "For children and parents" },
        { name: "None" },
      ],
    },

    {
      heading: "Errands and Grocery Shopping",
      data: [
        { name: "Child-related only" },
        { name: "Child-related and household tasks" },
        { name: "None" },
      ],
    },
    {
      heading: "Transportation",
      data: [
        { name: "Transporting children only" },
        { name: "Transporting children and running household errands" },
        { name: "None" },
      ],
    },
    {
      heading: "Educational Activities",
      data: [
        {
          name: "Planning and supervising educational activities for children",
        },
        { name: "Tutoring or homework assistance" },
        { name: "None" },
      ],
    },
  ];

  const handleChange = (e) => {
    setTextAreaValue(e.target.value);
  };
  const HandleNext = async () => {
    if (currentStep == 1) {
      nannyJobFormRef.current
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
            nannyJobFormRef.current.resetFields();
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
    } else if (currentStep == 3) {
      nannyJobFormRef.current
        .validateFields()
        .then((values) => {
          // console.log(values)
          if (values.option || values.specify) {
            // If form is valid, submit it and move to the next step

            const cleanData = cleanFormData1(values);

            let updatedValues = {
              ...formValues,
              hourlyRate: parseHourlyRate(
                cleanData.option ?? cleanData.specify,
              ),
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
    } else if (currentStep === 4) {
      nannyJobFormRef.current
        .validateFields()
        .then((values) => {
          // Get the keys of the form values to dynamically check all arrays
          const requiredFields = Object.keys(values);

          // Check if all required arrays have at least one value
          const hasErrors = requiredFields.some((field) => {
            if (field === "languageSkills") {
              const specificLanguage = values["specifyLanguage"];
              if (
                specificLanguage && // make sure it's not empty/null
                !values["languageSkills"].includes(specificLanguage)
              ) {
                values["languageSkills"].push(specificLanguage);
              }
            }

            Object.keys(values).forEach((key) => {
              if (Array.isArray(values[key]) && values[key].length === 0) {
                if (key === "languageSkills") {
                  values[key] = ["Not specified"];
                } else {
                  values[key] = "off";
                }
              }
            });

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
            let updatedValues = { ...formValues, specificRequirements: values }; // Merge with previous values
            setFormValues(updatedValues);
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
    } else if (currentStep === 5) {
      nannyJobFormRef.current
        .validateFields()
        .then((values) => {
          // Dynamically extract required fields from formData

          const requiredFields = step4Data.map((field) =>
            toCamelCase(field.heading),
          );
          // console.log(requiredFields)
          let allRequiredFieldsValid = true;

          requiredFields.forEach((field) => {
            if (
              values[field] === null ||
              values[field] === undefined ||
              values[field].length === 0
            ) {
              allRequiredFieldsValid = false;
            }
          });
          if (!allRequiredFieldsValid) {
            fireToastMessage({
              type: "error",
              message: "Please fill out all required fields.",
            });
            return; // Exit if required fields are invalid
          }

          // Optional fields can be ignored if they're undefined, but if they exist, ensure they're not null
          Object.keys(values).forEach((key) => {
            if (values[key] === undefined || values[key] == "") {
              // Optional field, so we can ignore if undefined
              delete values[key]; // Optionally remove it if you don't want it in the final submission
            }
          });
          let updatedValues = { ...formValues, expectationsCaregiver: values }; // Merge with previous values
          setFormValues(updatedValues);
          stepRef.current?.next();
          setCurrentStep((prev) => prev + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
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
      if (textAreaValue.length > 0) {
        await submitJob({
          jobType: "nanny",
          formValues,
          textAreaValue,
        });
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
            formRef={nannyJobFormRef || {}}
            head={"What is your preferred schedule for childcare?"}
            data={step1Data}
            inputNot={true}
          />
        );
      case 2:
        return (
          <HireStep3
            daysState={daysState}
            setDaysState={updateDaysState}
            head={
              "Do you have specific days and times when you need childcare?"
            }
          />
        );
      case 3:
        return (
          <HireStep4
            formRef={nannyJobFormRef || {}}
            inputName={"Specify"}
            subHead2={"(Select an hourly rate or weekly salary range.)"}
            head={"What is your budget for this position?"}
            data={step2Data}
          />
        );
      case 4:
        return (
          <MultiFormContainerCheck
            formRef={nannyJobFormRef || {}}
            head={
              "Do you have any specific requirements or preferences for your caregiver?"
            }
            addInput={{
              name: "Other Preferences",
              placeholder: "Type here...",
            }}
            formData={step3Data}
          />
        );
      case 5:
        return (
          <MultiFormContainer
            formRef={nannyJobFormRef || {}}
            head={"What are your expectations from the caregiver?"}
            addInput={{
              name: "Other Preferences",
              placeholder: "Type here...",
            }}
            formData={step4Data}
          />
        );
      case 6:
        return (
          <div>
            <p className="px-3 width-form text-center onboarding-head">
              Write job description
            </p>
            <Form
              className="flex justify-center mt-6 w-3/4 mx-auto"
              form={form}
              name="validateOnly"
              autoComplete="off"
            >
              {/* <div>
                <Form.Item
                  name="jobDescription"
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
                    placeholder={"Write job description.."}
                    className="py-4 border-none !min-h-56 rounded-3xl input-width no-resize"
                  />
                </Form.Item>
              </div> */}
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
                    className={`peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-8 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary no-resize`}
                  />
                </Form.Item>
                <label
                  htmlFor={name}
                  className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10"
                >
                  Job Description
                </label>
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

      <div className="lg:mx-10 mx-2 my-10 px-4">
        <div className="pb-16 pt-8">
          <div className="flex flex-col items-center justify-between">
            {renderStepContent()}

            <div className="mt-6 flex gap-2">
              {/* <button
                className="mx-auto text-[#AEC4FF] bg-white border border-[#AEC4FF] lg:w-48 w-24 lg:py-2 py-1 rounded-full font-normal text-base transition hover:opacity-60 duration-700 delay-150 ease-in-out"
                onClick={() => {
                  if (currentStep > 1) {
                    stepRef.current?.prev();
                  } else {
                    setShowApp(true);
                  }
                }}
              >
                Back
              </button> */}
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
