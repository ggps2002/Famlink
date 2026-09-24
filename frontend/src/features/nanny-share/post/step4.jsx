import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

import { CHILD_HELP, NOT_APPLICABLE, HOUSEHOLD_TASKS } from "@shared/lib/profileOptions";
const step4Data = {
  first: [...CHILD_HELP, NOT_APPLICABLE],
  second: [...HOUSEHOLD_TASKS, NOT_APPLICABLE],
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
