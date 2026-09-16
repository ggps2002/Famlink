import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step6Data = [
  "Nap times",
  "Outdoor play",
  "Educational activities",
  "Structured meal times",
  "Storytime",
  "Arts & crafts",
  "Playdates/outings",
  "Not Applicable",
];

function Step6({ formRef, initialValues }) {
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
        Daily Routine / Activities
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              What is your daily routine or activities you’d like included?
              (optional)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step6Data}
              defaultCheckedValues={initialValues.dailyRoutine}
              name={"dailyRoutine"}
              multi={true}
            />
          </div>
        </div>
      </Form>
    </div>
  );
}

export default Step6;
