import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import Input from "antd/es/input/Input";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";

const step1Data = {
  // Single-sourced: the same two the filters, the edit forms and the caregiver
  // questionnaire offer. See SHARE_SCHEDULES in shared/lib/scheduleFormat.js.
  type: SHARE_SCHEDULES,
  hasNanny: [
    "Yes – we already have a nanny",
    "No – we are looking for a nanny",
  ],
  location: [
    "Near our home / in our neighborhood",
    "Nearby neighborhoods within ~10–15 minutes",
    "Anywhere in City that’s reasonably close",
    "Near my workplace",
  ],
};

function Step1({ opt, selectedValue, handleSelectChange, formRef, type="", hasNanny="" }) {
  const [form] = Form.useForm();


  // 👇 WATCH the selected value
  const selectedLocation = Form.useWatch("shareLocation", form) || [];

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
      <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-6">
        Basic Info
      </p>

      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="mx-auto max-w-3xl">

          <p className="text-lg Livvic-SemiBold text-primary mb-4">
            What type of nanny share are you looking for?
          </p>
          {/* No "Other (Specify)". A share is full-time or part-time; the free
              text box is where "Summer/Seasonal" and the rest came from, and
              every value it produced had to be guessed at on the way out. */}
          <OnboardingOptionSelector
            form={form}
            options={step1Data.type}
            name={"option"}
            defaultCheckedValue={type}
          />

          <p className="text-lg Livvic-SemiBold text-primary mb-4">
            Do you already have a nanny?
          </p>
          <OnboardingOptionSelector
            form={form}
            options={step1Data.hasNanny}
            name={"hasNanny"}
            hasNanny={hasNanny}
          />

          <p className="text-lg Livvic-SemiBold text-primary my-4">
            Where are you open to having the nanny share take place?
          </p>
          <OnboardingOptionSelector
            form={form}
            options={step1Data.location}
            name={"shareLocation"}
            multi={true}
          />

          {/* ✅ CONDITIONAL RENDER */}
          {selectedLocation.includes("near my workplace") && (
            <div>
              <p className="text-lg Livvic-SemiBold text-primary my-4">
                What is your work location or nearest major intersection?
              </p>

              <div className="mb-6 mx-auto max-w-3xl">
                <Form.Item
                  name={"specifyNearbyWorkplace"}
                  rules={[{ required: false }]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Your work location (optional)"
                    className="w-full max-w-2xl py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 shadow-sm"
                  />
                </Form.Item>
              </div>
            </div>
          )}

        </div>
      </Form>
    </div>
  );
}

export default Step1;