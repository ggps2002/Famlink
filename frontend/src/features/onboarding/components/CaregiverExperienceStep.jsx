import { useEffect } from "react";
import { Form } from "antd";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import { AGE_GROUPS, CARE_EXPERIENCE, LANGUAGES } from "@shared/lib/profileOptions";

/* "Your experience" — the caregiver answers the profile page shows under
 * Experience and Languages that the questionnaires never used to ask:
 * years of experience, the age groups they've cared for, and the languages
 * they speak.
 *
 * The choices come from @shared/lib/profileOptions, like every other profile
 * question, so an answer given here reads back and edits there unchanged. The job flow already asks
 * years of experience on its first screen, so it passes askExperience={false}. */

export default function CaregiverExperienceStep({ formRef, initialValues = {}, askExperience = true }) {
  const [form] = Form.useForm();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [formRef, form]);

  return (
    <div className="mb-6">
      <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-6">Your experience</p>

      <Form form={form} name="validateOnly" autoComplete="off">
        <div className="mx-auto max-w-3xl">
          {askExperience && (
            <>
              <p className="text-lg Livvic-SemiBold text-primary mb-4">
                How many years of childcare experience do you have?
              </p>
              <OnboardingOptionSelector
                form={form}
                options={CARE_EXPERIENCE}
                name="careExperience"
                defaultCheckedValue={initialValues.careExperience}
              />
            </>
          )}

          <p className="text-lg Livvic-SemiBold text-primary my-4">Which age groups have you cared for?</p>
          <OnboardingOptionSelector
            form={form}
            options={AGE_GROUPS}
            name="ageGroupsExp"
            multi
            selectAll={false}
            defaultCheckedValues={initialValues.ageGroupsExp}
          />

          <p className="text-lg Livvic-SemiBold text-primary my-4">Which languages do you speak?</p>
          <OnboardingOptionSelector
            form={form}
            options={LANGUAGES}
            name="languages"
            multi
            selectAll={false}
            defaultCheckedValues={initialValues.languages}
          />
        </div>
      </Form>
    </div>
  );
}
