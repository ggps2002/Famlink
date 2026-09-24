import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

import { CHILD_HELP, HOUSEHOLD_TASKS, NOT_APPLICABLE } from "@shared/lib/profileOptions";
const step3Data = {
    first: CHILD_HELP,
    second: [...HOUSEHOLD_TASKS, NOT_APPLICABLE],
};

function Step3({ formRef, initialValues }) {
    const [form] = Form.useForm();

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
                Role & Expectations 
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        What would your role typically include?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step3Data.first}
                        name={"responsibilities"}
                        multi={true}
                        defaultCheckedValues={initialValues?.responsibilities}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Which household tasks are you open to helping with?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step3Data.second}
                        name={"householdHelp"}
                        multi={true}
                        selectAll={false}
                        defaultCheckedValues={
                            Array.isArray(initialValues?.householdHelp) ? initialValues.householdHelp : undefined
                        }
                    />

                </div>
            </Form>
        </div>
    );
}

export default Step3;