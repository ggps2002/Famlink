import React, { useState, useEffect, useRef } from "react";
import Form from "antd/es/form/Form";
import OptionSelector from "@shared/ui/LanguageSelector";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import OnboardingDaySelector from "@features/onboarding/components/OnboardingDaySelector";
import Onboarding_salaryExp from "@features/onboarding/components/Onboarding_salaryExp";

const step2Data = [
  "Full-time",
  "Part-time",
  "Occasional",
  "Live-in",
  "Weekends only",
  "Nights only",
  "Flexible",
];

const step3Data = ["Immediate", "Start within 1 month", "Flexible start date"];

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const step4Data = [
  "Newborns (0-12 months)",

  "Toddlers (1-3 years)",

  "Preschoolers (3-5 years)",

  "School-age (5-12 years)",

  "Teenagers (12+ years)",
];

const step5Data = [
  "Less than 1 year",
  "1-3 years",
  "3-5 years",
  "Over 5 years",
];

function Onboarding_step1({ formRef, defaultVal, daysState, setDaysState }) {
  // This function will update the state when passed down to HireStep3
  const updateDaysState = (updatedDaysState) => {
    setDaysState(updatedDaysState);
  };

  const [form] = Form.useForm();
  // const allValues = step2Data.map((v) => (v.val ? v.val : toCamelCase(v.name)));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);

  // const onCheckboxGroupChange = (checkedValues) => {
  //   console.log(checkedValues);
  //   form.setFieldsValue({
  //     option: checkedValues,
  //   });
  //   setSelectedValues(checkedValues);
  // };

  // const handleSelectAllChange = () => {
  //   const currentValues = form.getFieldValue("option") || [];
  //   const updatedValues =
  //     currentValues.length === allValues.length ? [] : allValues;

  //   form.setFieldsValue({
  //     option: updatedValues,
  //   });
  //   setSelectedValues(updatedValues);
  // };

  return (
    <div className="mb-6">
      <p className="Livvic-Bold text-4xl text-primary px-3 text-center mb-6">
        Set Up Your Childcare Profile
      </p>

      <div className={`flex items-center flex-col justify-center`}>
        <div>
          <Form form={form} name="validateOnly" autoComplete="off">
            <div className="space-y-4">
              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Employment type <span className="text-red-500">*</span>
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step2Data}
                  name={"option"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Availability
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step3Data}
                  name={"availability"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Specific Availability
                </p>
                {/* <OnboardingOptionSelector
                  form={form}
                  options={step3Data}
                  name={"availability"}
                /> */}
                <OnboardingDaySelector
                  daysState={daysState}
                  setDaysState={updateDaysState}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Age groups <span className="text-red-500">*</span>
                </p>
                <OptionSelector
                  form={form}
                  options={step4Data}
                  name={"ageGroupsExp"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Experience
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step5Data}
                  name={"experience"}
                />
              </div>
            </div>
          </Form>
          <div className="mt-4">
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Salary Expectation
            </p>
            <Onboarding_salaryExp form={form} />
          </div>
          <div style={{ marginTop: "-40px" }}></div>
        </div>
      </div>
    </div>
  );
}

export default Onboarding_step1;
