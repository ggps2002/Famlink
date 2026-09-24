import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import { DatePicker } from "antd";
import dayjs from "dayjs";

import { AGE_GROUPS } from "@shared/lib/profileOptions";
const step1Data = {
    first: [
        "Yes",
        "No"
    ],
    second: [
        "Yes",
        "No"
    ],
    third: [
        "1-2",
        "2-3",
        "3-4",
        "Flexible",
    ],
    fourth: AGE_GROUPS,
    fifth: [
        "One home",
        "Rotating homes",
        "Either"
    ]
};

function Step1({ formRef, initialValues }) {
    const [form] = Form.useForm();

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (formRef) {
            formRef.current = form;
        }
    }, [formRef, form]);

    useEffect(() => {
        if (initialValues && Object.keys(initialValues).length > 0) {
            form.setFieldsValue({
                ...initialValues,
                // convert stored string back to dayjs object for the DatePicker
                startAvailability: initialValues.startAvailability
                    ? dayjs(initialValues.startAvailability)
                    : null,
            });
        }
    }, [initialValues]);

    return (
        <div className="mb-6">
            <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-6">
                Share Compatibility
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Have you worked in a nanny share before?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.first}
                        name={"shareExperience"}
                        defaultCheckedValue={initialValues?.shareExperience}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Are you comfortable caring for children from multiple families?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.second}
                        name={"multiFamilyComfort"}
                        defaultCheckedValue={initialValues?.multiFamilyComfort}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        What number of children are you most comfortable caring for?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.third}
                        name={"childrenCapacity"}
                        defaultCheckedValue={initialValues?.childrenCapacity}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        What ages do you prefer to work with?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.fourth}
                        name={"preferredAges"}
                        multi={true}
                        defaultCheckedValues={initialValues?.preferredAges?.map((age) => age.label)}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Are you okay working in
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.fifth}
                        name={"workSetup"}
                        defaultCheckedValue={initialValues?.workSetup}
                    />

                </div>
            </Form>
        </div>
    );
}

export default Step1;