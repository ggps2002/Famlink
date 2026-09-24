import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import { deparseHourlyRate } from "@shared/lib/rates";

import { PETS } from "@shared/lib/profileOptions";
/* A family answers one budget question: what THEY pay per hour.
 *
 * The label is their own share; the value is left as the full combined string
 * the questionnaire has always written, because that string is a wire format —
 * `parseHourlyRate` reads it back into `hourlyBudget`, `deparseHourlyRate`
 * rebuilds it to preselect an existing answer, and the browse rate filter
 * queries the `minShare`/`maxShare` it produces. Changing what we ask for does
 * not require changing what every stored profile means.
 *
 * Only the label changed, and deliberately: a family is not quoting a caregiver
 * rate, and showing them the combined figure invited them to read it as a
 * second price they were offering. */
const step7Data = {
  first: [
    { label: "$5 - $7.50 per hour", value: "$10 - $15 per hour (Each family pays $5 - $7.50)" },
    { label: "$7.50 - $10 per hour", value: "$15 - $20 per hour (Each family pays $7.50 - $10)" },
    { label: "$10 - $12.50 per hour", value: "$20 - $25 per hour (Each family pays $10 - $12.50)" },
    { label: "$12.50 - $15 per hour", value: "$25 - $30 per hour (Each family pays $12.50 - $15)" },
    { label: "$15 - $17.50 per hour", value: "$30 - $35 per hour (Each family pays $15 - $17.50)" },
    { label: "$17.50 - $20 per hour", value: "$35 - $40 per hour (Each family pays $17.50 - $20)" },
    { label: "$20+ per hour", value: "$40+ per hour (Each family pays $20+)" },
  ],

  second: PETS,
};

function Step7({ formRef, petsInfo = true, initialValues }) {
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
        {petsInfo ? "Budget & Pets" : "Budget (hourly split)"}
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-4xl">
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-1">
              What is your hourly budget for a nanny share? (required)
            </p>
            <p className="text-sm Livvic-Medium text-[#666666] mb-4">
              This is your family's share — in a nanny share the caregiver's rate is
              split between both families.
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step7Data.first}
              name={"hourlyRateSplit"}
              defaultCheckedValue={
                initialValues.hourlyBudget
                  ? deparseHourlyRate(initialValues.hourlyBudget)
                  : ""
              }
              rules={[{ required: true, message: "Please select an hourly budget." }]}
            />
          </div>

          {petsInfo && <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Do you have pets? (required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step7Data.second}
              name={"pets"}
              defaultCheckedValue={initialValues.pets}
              defaultSpecificValue={initialValues.petsSpecify}
              specify={true}
              placeholder="Other (Specify)"
              openFieldName="specifyPets"
            />
          </div>}
        </div>
      </Form>
    </div>
  );
}

export default Step7;
