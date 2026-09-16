import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import NannyNoStep2 from "@features/hire/components/NannyShareNo/step2";
import HireStep4 from "@features/hire/components/step4";

const step5Data = ["Children only", "Children and parents", "Neither"];

const step8Data = [
  "Yes, I have a childcare certification",
  "Yes, I have first aid and CPR certifications.",
  "No formal training, but I have hands-on experience.",
];

const step9Data = [
  "Yes, I can use my own car for transportation.",
  "Yes, but I prefer to use the family's car.",
  "No, I prefer not to handle transportation",
];

const step10Data = [
  "Yes, I am comfortable caring for sick children.",
  "No, I prefer not to care for sick children.",
];

const step11Data = ["Yes", "No"];

const step15Data = ["English", "Spanish", "French", "Mandarin", "Bilingual"];

const step16Data = [
  "Pets in the home",
  "Smoker/non-smoker household",
  "Number of children",
  "Age of children",
  "Special needs care",
];

const step17Data = ["Own vehicle", "Public transportation", "Walking/Biking"];

const data1 = [
  {
    name: "Set Clear Rules and Expectations",
    subText:
      "I believe in setting clear rules and consistently enforcing them to maintain discipline.",
  },
  {
    name: "Logical Consequences",
    subText:
      "I apply consequences that are logically related to the behavior to teach responsibility.",
  },
  {
    name: "Time-Out Method",
    subText:
      "I use time-out as a method to help children reflect on their behavior and learn from it.",
  },
  {
    name: "Redirecting",
    subText:
      "I redirect the child's attention to more appropriate behaviors or activities as a way to manage misbehavior.",
  },
  {
    name: "Discussion and Problem Solving",
    subText:
      "I encourage discussing the issue to understand the child's perspective and jointly develop a solution.",
  },
  {
    name: "Flexible Approach for Every Child",
    subText:
      "I am flexible and adapt my methods to each child's individual needs and circumstances.",
  },
];

function Onboarding_step3({ formRef, defaultVal }) {
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
      <p className="Livvic-Bold text-4xl text-primary px-3 text-center mb-6">
        Your Skills & Responsibilities
      </p>

      <div className={`flex items-center flex-col justify-center`}>
        <div>
          <Form form={form} name="validateOnly" autoComplete="off">
            <div className="space-y-4">
              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Will you cook for
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step5Data}
                  name={"cookFor"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Are you willing to help with housekeeping for
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step5Data}
                  name={"helpWithHousekeeping"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Do you have any formal training or certifications in childcare
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step8Data}
                  name={"certification"}
                  specify={true}
                  multi={true}
                  openFieldName={"specifyCertification"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  What is your approach to discipline and child behavior
                  management
                </p>
                {/* <NannyNoStep2
                  formRef={formRef}
                  noHeading={true}
                  data={data1}
                  defaultValue={"Positive Reinforcement"}
                  defaultSubValue={
                    "I use positive reinforcement to encourage good behavior by recognizing and rewarding it."
                  }
                  inputText={true}
                  inputName={"Type here..."}
                  textAreaHead={"Please Specify"}
                  // subHead={
                  //   "What is your approach to discipline and child behavior management?"
                  // }
                /> */}
                <HireStep4
                  formRef={formRef}
                  data={data1}
                  checkBox={true}
                  inputName={"Type here..."}
                  textAreaHead={"Other Preferences"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4 mt-14">
                  Are you willing to use your personal car to transport the
                  children if needed?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step9Data}
                  name={"usePerTransport"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Are you comfortable watching children when they are sick?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step10Data}
                  name={"watchChildWhenTheyAreSick"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Can you provide references from previous childcare positions?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step11Data}
                  name={"references"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  What languages do you speak fluently?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step15Data}
                  name={"language"}
                  multi={true}
                  specify={true}
                  openFieldName={"specifyLanguage"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  Do you have any restrictions or preferences regarding your
                  work environment?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step16Data}
                  name={"resOrPreAboutWorkEnv"}
                  multi={true}
                  specify={true}
                  openFieldName={"specifyResOrPreAboutWorkEnv"}
                />
              </div>

              <div>
                <p className="text-lg Livvic-SemiBold text-primary mb-4">
                  What is your preferred method of transportation to and from
                  work?
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={step17Data}
                  name={"preferredMetOfTran"}
                />
              </div>
            </div>
            <div style={{ marginTop: "-40px" }}></div>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default Onboarding_step3;
