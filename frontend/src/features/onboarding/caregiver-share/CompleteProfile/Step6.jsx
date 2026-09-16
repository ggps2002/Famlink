import React, { useEffect } from "react";
import { Form, Input } from "antd";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const step6Data = [
    "Text",
    "Phone calls",
    "In-person",
    "Flexible"
];

function Step6({ formRef, initialValues }) {
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
                Communication
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        How do you typically communicate?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step6Data}
                        name={"communicationPreference"}
                        defaultCheckedValue={initialValues?.["communicationPreference"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        What matters most when matching with another family?
                    </p>
                    <Form.Item name="matchMattersMost" rules={[{ required: true, message: "Please specify what matters most" }]}  initialValue={initialValues?.["matchMattersMost"]}>
                        <Input.TextArea
                            rows={4}
                            placeholder="Shared values, similar parenting style, strict scheduling, etc..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                </div>
            </Form>
        </div>
    );
}

export default Step6;