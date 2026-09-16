import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import SelectChildrenAge from "@features/nanny-share/post/SelectChildrenAge";

// remove "second" from step1Data since we no longer need those options
const step1Data = {
    first: [
        "Current family's home",
        "Other family's home",
        "Rotating between homes",
        "Neutral location"
    ],
    third: [
        "Very flexible",
        "Somewhat flexible",
        "Fixed"
    ]
};

function Step1({ formRef, selectedValue, setSelectedValue, numberOfChildren = null, childrenAges = [], initialValues }) {
    const [form] = Form.useForm();
    const updateSelectedValue = (updatedSelectedValue) => {
        setSelectedValue(updatedSelectedValue);
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
                Share Details
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        How many children need care? (required)
                    </p>
                    <SelectChildrenAge
                        form={form}
                        opt={Array.from({ length: 4 }, (_, i) => i + 1)}
                        selectedValue={selectedValue}
                        handleSelectChange={updateSelectedValue}
                        numberOfChildren={numberOfChildren}
                        childrenAges={Array.isArray(childrenAges) ? childrenAges?.join(", ") : childrenAges}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Where would care take place?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.first}
                        name={"whereCare"}
                        defaultCheckedValue={initialValues?.["whereCare"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        When would you like to start a nanny share?
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

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        How flexible is your schedule?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step1Data.third}
                        name={"flexibility"}
                        defaultCheckedValue={initialValues?.["flexibility"]}
                    />

                </div>
            </Form>
        </div>
    );
}

export default Step1;