import React, { useEffect } from "react";
import { Form, Input } from "antd";

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
                Daily Routine
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        What does a typical day look like?
                    </p>
                    <Form.Item name="typicalDay" initialValue={initialValues?.["typicalDay"]}>
                        <Input.TextArea
                            rows={4}
                            placeholder="Describe a typical day..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        Are there any important routines or preferences?
                    </p>
                    <Form.Item name="routinesPreferences" initialValue={initialValues?.["routinesPreferences"]}>
                        <Input.TextArea
                            rows={4}
                            placeholder="Nap times, dietary preferences, screen time rules..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                </div>
            </Form>
        </div>
    );
}

export default Step3;