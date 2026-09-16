import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import SelectChildrenAge from "@features/nanny-share/post/SelectChildrenAge";
import Input from "antd/es/input/Input";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step3Data = [
  "Food allergies",
  "Environmental allergies",
  "Asthma",
  "Medication needs",
  "None",
];

function Step3({ formRef, selectedValue, setSelectedValue, numberOfChildren=null, childrenAges=[] , initialValues}) {
  const updateSelectedValue = (updatedSelectedValue) => {
    setSelectedValue(updatedSelectedValue);
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
  return (
    <div className="mb-6">
      <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-5">
        Children’s Details
      </p>
      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="space-y-4 mx-auto max-w-3xl">
          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              How many children need care? (required)
            </p>
            <SelectChildrenAge
              form={form}
              opt={Array.from({ length: 4 }, (_, i) => i + 1)}
              selectedValue={selectedValue}
              handleSelectChange={updateSelectedValue}
              numberOfChildren={numberOfChildren}
              childrenAges={Array.isArray(childrenAges) ? childrenAges?.join(", ") : childrenAges}
            />
            {/* <HireStep2
            opt={Array.from({ length: 4 }, (_, i) => i + 1)}
            formRef={jobFormRef}
            selectedValue={selectedValue}
            handleSelectChange={handleSelectChange}
           /> */}
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Which school(s) do they attend? (optional)
            </p>
            <div className="my-4 w-full">
              <Form.Item
                style={{ padding: 0, margin: 0 }}
                name="schoolAttended"
                rules={[{ required: false, message: "" }]}
                 initialValue={initialValues?.childrenSchools}
              >
                <Input.TextArea
                  rows={4} // controls height (increase rows for taller box)
                  placeholder="Enter the name of the school(s)"
                  className="w-full max-w-2xl py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 shadow-sm"
                />
              </Form.Item>
            </div>
          </div>

          <div>
            <p className="text-lg Livvic-SemiBold text-primary mb-4">
              Any allergies or health considerations? (required)
            </p>
            <OnboardingOptionSelector
              form={form}
              options={step3Data}
              defaultCheckedValues={initialValues["allergiesHealth"]}
              multi={true}
              defaultSpecificValue={initialValues["allergiesHealthSpecify"]}
              name={"healthConsideration"}
              specify={true}
              placeholder="Other (Specify)"
              openFieldName="specifyHealthConsideration"
            />
          </div>
        </div>
      </Form>
    </div>
  );
}

export default Step3;
