import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import OnboardingDaySelector from "@features/onboarding/components/OnboardingDaySelector";
import { DatePicker } from "antd";
import dayjs from "dayjs";

const step2Data = [
    "Immediately", "Within 2 weeks", "Within a month", "Flexible"
]


function Step2({ formRef, daysState, setDaysState, initialValues }) {
    const [form] = Form.useForm();

    const updateDaysState = (updatedDaysState) => {
        setDaysState(updatedDaysState);
    };

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
                Availability
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Select your working days and times
                    </p>
                    <OnboardingDaySelector
                        daysState={daysState}
                        setDaysState={updateDaysState}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        When are you available to start?
                    </p>
                    <Form.Item
                        name="startAvailability"
                        rules={[{ required: true, message: "Please select a start date" }]}
                    >
                        <DatePicker
                            className="max-w-2xl rounded-xl border-gray-300 py-3 px-4"
                            format="MMMM D, YYYY"
                            disabledDate={(current) => current && current < dayjs().startOf("day")}
                            placeholder="Select a start date"
                        />
                    </Form.Item>

                </div>
            </Form>
        </div>
    );
}

export default Step2;