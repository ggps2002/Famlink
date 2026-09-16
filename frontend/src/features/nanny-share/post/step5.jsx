import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step5Data = {
  first: [
    "Montessori",
    "Attachment parenting",
    "RIE",
    "Authoritative",
    "Permissive",
    "Strict",
    "Flexible",
  ],
  second: [
    "Screen time limits",
    "Dietary restrictions",
    "Behavior expectations",
    "Hygiene practices",
    "Chore responsibilities",
  ],
};

function Step5({ formRef, parentingRule=true, houseRulesOption, initialValues }) {
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
        {parentingRule ? "Parenting Style & House Rules" : "House Rules"}
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          {parentingRule && <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Do you have a specific parenting style or philosophy? (optional)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step5Data.first}
              name={"parentingStyle"}
              multi={true}
              specify={true}
              defaultCheckedValues={initialValues.parentingStyle}
              defaultSpecificValue={initialValues.parentingStyleSpecify}
              placeholder="Other (Specify)"
              openFieldName="specifyParentingStyle"
            />
          </div>}

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Do you have specific house rules or guidelines? (optional)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={houseRulesOption ?? step5Data.second}
              name={"houseRules"}
              multi={true}
              defaultCheckedValues={initialValues.houseRules}
              defaultSpecificValue={initialValues.houseRulesSpecify}
              specify={true}
              placeholder="Other (Specify)"
              openFieldName="specifyHouseRules"
            />
          </div>
        </div>
      </Form>
    </div>
  );
}

export default Step5;
