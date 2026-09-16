import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import FamilyExperienceForm from "@features/hire/components/familyExpForm";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import Form from "antd/es/form/Form";

const stepData = ["Yes", "No"];

function Onboarding_step2({ formRef, defaultVal }) {
  const [form] = Form.useForm();
  const { familyExp } = useSelector((s) => s.familyExp);

  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [formRef, form]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return (
    <div>
      <div>
        <p className="mb-10 px-3 text-center Livvic-Bold text-primary text-4xl">
          Share your past family experience
          <br /> and stand out
        </p>
        <Form form={form} name="validateOnly" autoComplete="off">
          <div className="my-6">
            <p className="Livvic-SemiBold text-lg mb-4">
              Are you willing to undergo background checks
            </p>
            <OnboardingOptionSelector
              form={form}
              options={stepData}
              name={"backgroundCheck"}
            />
          </div>
        </Form>
        <FamilyExperienceForm form={form} />
      </div>
    </div>
  )
}

export default Onboarding_step2;
