import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step3Data = {
    first: [
        "Childcare",
        "Meal/snack prep",
        "Educational activities",
        "Outdoor play",
        "Transportation",
        "Homework help",
        "Nap/bedtime routines"
    ],
    second: [
        "Yes — both child-related and family-related",
        "Child-related tasks only",
        "No — childcare only"
    ],
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
                        Are you open to helping with household tasks?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step3Data.second}
                        name={"householdHelp"}
                        defaultCheckedValue={initialValues?.householdHelp}
                    />

                </div>
            </Form>
        </div>
    );
}

export default Step3;