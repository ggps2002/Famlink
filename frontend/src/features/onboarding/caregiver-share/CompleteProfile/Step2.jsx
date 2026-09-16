import React, { useEffect } from "react";
import { Form, Input } from "antd";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step2Data = {
    first: [
        "Similar age",
        "Younger",
        "Older",
        "Flexible"
    ],
    second: [
        "Yes",
        "No"
    ]
};

function Step2({ formRef, initialValues }) {
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
                Child Details
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        What type of child would be the best fit?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step2Data.first}
                        name={"matchFit"}
                        defaultCheckedValue={initialValues?.["matchFit"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Do they attend school or daycare?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step2Data.second}
                        name={"schoolDaycare"}
                        defaultCheckedValue={initialValues?.["schoolDaycare"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        Are there any allergies or health considerations?
                    </p>
                    <Form.Item name="allergies" initialValue={initialValues?.["allergies"]}>
                        <Input.TextArea
                            rows={4}
                            placeholder="Please list any allergies or health details here..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                </div>
            </Form>
        </div>
    );
}

export default Step2;