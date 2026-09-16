import React, { useEffect } from "react";
import { Form, Input } from "antd";

function Step4({ formRef, initialValues }) {
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
                Expectations
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        What would you expect from a nanny share setup?
                    </p>
                    <p className="text-sm Livvic text-gray-500 mb-2">
                        Consider responsibilities, structure, handling sick days, vacation coordination, etc.
                    </p>
                    <Form.Item name="expectations" rules={[{ required: true, message: "Please share your expectations" }]}  initialValue={initialValues?.["expectations"]}>
                        <Input.TextArea
                            rows={6}
                            placeholder="I expect..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                </div>
            </Form>
        </div>
    );
}

export default Step4;