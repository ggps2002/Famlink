import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingDaySelector from "@features/onboarding/components/OnboardingDaySelector";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import StartEndDatePicker from "@features/nanny-share/post/StartEndDatePicker";
import dayjs from "dayjs";
import { DatePicker } from "antd";

import { FLEXIBILITY, URGENCY } from "@shared/lib/profileOptions";
const step2Data = {
  first: FLEXIBILITY,
  second: [
    "My home",
    "Other family’s home",
    "Rotating between homes",
    "Neutral location (e.g., school pickup spot)",
  ],
  third: ["Within the next month", "In 1–3 months", "In 3+ months / flexible"],
  fourth: URGENCY,
};

function Step2({
  daysState,
  setDaysState,
  formRef,
  initialValues,
  hostingOption,
  seasonal = false,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) {
  const updateDaysState = (updatedDaysState) => {
    setDaysState(updatedDaysState);
  };

  const [form] = Form.useForm();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      form.setFieldsValue({
        ...initialValues,
        // convert stored string back to dayjs object for the DatePicker
        nannyshareStart: initialValues.nannyshareStart
          ? dayjs(initialValues.nannyshareStart)
          : null,
      });
    }
  }, [initialValues]);
  return (
    <div className="mb-6">
      <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-5">
        Schedule & Hosting
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          {seasonal && (
            <div>
              <p className="text-lg Livvic-SemiBold text-primary mb-4">
                What dates do you need care? (start & end date)
              </p>
              <StartEndDatePicker
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
              />
            </div>
          )}
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              What days and times do you need care?(required)
            </p>
            <OnboardingDaySelector
              daysState={daysState}
              setDaysState={updateDaysState}
            />
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              How flexible are you with scheduling?(required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step2Data.first}
              defaultCheckedValue={initialValues["flexibility"]}
              name={"flexible"}
            />
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              When do you want to start the nanny share?(required)
            </p>
            <Form.Item
              name="nannyshareStart"
              rules={[{ required: true, message: "Please select a start date" }]}
            >
              <DatePicker
                className="max-w-2xl rounded-xl border-gray-300 py-3 px-4"
                format="MMMM D, YYYY"
                disabledDate={(current) => current && current < dayjs().startOf("day")}
                placeholder="Select a start date"
              />
            </Form.Item>
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              How urgent is your childcare search?(required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step2Data.fourth}
              name={"urgency"}
              defaultCheckedValue={initialValues["urgency"]}
            />
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Hosting preference(required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={hostingOption ?? step2Data.second}
              name={"hosting"}
              defaultCheckedValue={initialValues["hostingPreference"]}
            />
          </div>
        </div>
      </Form>
    </div>
  );
}

export default Step2;
