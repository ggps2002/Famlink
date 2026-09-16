import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step4Data = {
  first: [
    "Transportation",
    "Educational activities",
    "Outdoor play",
    "Storytime / reading",
    "Meal/snack prep for kids",
    "Homework help",
    "Nap/bedtime support",
    "Not Applicable",
  ],
  second: [
    "Light housekeeping",
    "Grocery shopping",
    "Errands",
    "Meal preparation for family",
    "Not Applicable",
  ],
};

function Step4({ formRef, options, householdAddOns=true, initialValues }) {
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
  return (
    <div className="mb-6">
      <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-5">
        Responsibilities
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Child-related responsibilities (check all that apply)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={options ?? step4Data.first}
              name={"responsibilities"}
              defaultCheckedValues={initialValues["childResponsibilities"]}
              multi={true}
              selectAll={false}
            />
          </div>

          {householdAddOns && <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Household add-ons (optional)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step4Data.second}
              name={"householdActivities"}
              defaultCheckedValues={initialValues["householdAddOns"]}
              multi={true}
              selectAll={false}
            />
          </div>}
        </div>
      </Form>
    </div>
  );
}

export default Step4;
