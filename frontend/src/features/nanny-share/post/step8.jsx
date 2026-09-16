import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step8Data = {
  first: [
    "Group chat",
    "Shared calendar",
    "Email updates",
    "Phone calls",
    "Regular in-person meetings",
  ],

  second: [
    "Family members",
    "Backup nanny service",
    "Friends or neighbors",
    "Local daycare",
    "No backup options",
  ],
  third: ["Very involved", "Moderately involved", "Minimal involvement"],
};

function Step8({ formRef, involvement=true, backUp=true, initialValues }) {
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
        Communication & Backup
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              How do you prefer to communicate with another family? (required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step8Data.first}
              name={"prefferedCommunication"}
              defaultCheckedValue={initialValues.communicationPreference}
              defaultSpecificValue={initialValues.communicationSpecify}
              specify={true}
              placeholder="Other (Specify)"
              openFieldName="specifyPrefferedCommunication"
            />
          </div>

          {backUp && <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Do you have backup care if the nanny is unavailable? (optional)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step8Data.second}
              name={"backupAvailable"}
              defaultCheckedValue={initialValues.backupCare}
              defaultSpecificValue={initialValues.backupCareSpecify}
              specify={true}
              placeholder="Other (Specify)"
              openFieldName="specifyBackupAvailable"
            />
          </div>}

          {involvement && <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              How involved do you want to be in daily activities and decisions?
              (required)
            </p>
            <OnboardingOptionSelector
              form={form}
              defaultCheckedValue={initialValues.involvementLevel}
              options={step8Data.third}
              name={"involvement"}
            />
          </div>}
        </div>
      </Form>
    </div>
  );
}

export default Step8;
