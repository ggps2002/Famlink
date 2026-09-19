import { useState, useEffect } from "react";
import { InputRadio, InputTextArea } from "@shared/ui/Input";
import { Form } from "antd";
import { toCamelCase } from "@shared/lib/toCamelCase";

export default function MultiFormContainer({ formData, head, formRef, addInput }) {
    const [form] = Form.useForm();
    const [formValues, setFormValues] = useState({}); // Start with an empty state

    // Set initial values for the form when the component mounts
    useEffect(() => {
        const initialFormValues = formData.reduce((acc, v) => {
            const headingKey = toCamelCase(v.heading);
            acc[headingKey] = null; // Initialize each field with null or any default value
            return acc;
        }, {});
        setFormValues(initialFormValues); // Set state with the initial values
        form.setFieldsValue(initialFormValues); // Also set initial form field values
    }, [formData, form]);

    const onRadioChange = (radioValue, heading) => {
        const updatedValues = {
            ...formValues,
            [heading]: radioValue, // Use the heading as the key and the selected radio value as the value
        };
        setFormValues(updatedValues); // Update the formValues state with the new selection

        // Set the form field value
        form.setFieldsValue({
            [heading]: radioValue,
        });
    };
    useEffect(() => {
        if (formRef) {
            formRef.current = form;
        }
    }, [formRef, form]);
    return (
        <Form form={form} initialValues={formValues}> {/* Provide initialValues */}
            <p className=' px-3 onboarding-head text-center width-form mb-3'>
                {head}
            </p>

            {formData.map((v, i) => (
                <div className="flex justify-center my-5" key={i}>
                    <div>
                        <p className="Livvic-SemiBold text-primary text-lg mb-1 input-text">{v.heading}</p>
                        {v.data.map((j, h) => {
                            const headingKey = toCamelCase(v.heading);
                            return (
                                <Form.Item key={h} name={headingKey}>
                                    <InputRadio
                                        onRadioChange={(radioValue) => onRadioChange(radioValue, headingKey)}
                                        name={j.name}
                                        value={formValues[headingKey]} // Ensure this accesses the correct heading
                                        val={j.name} // Pass the name directly for comparison
                                    />
                                </Form.Item>
                            );
                        })}
                    </div>
                </div>
            ))}
            {
                addInput &&
                <div className="flex justify-center" style={{ marginTop: "-20px" }}>
                    <div>
                        <p className='Livvic-SemiBold text-primary text-lg'>
                            {addInput.name}
                        </p>
                        <div className="flex justify-center">
                            <InputTextArea name={toCamelCase(addInput.name)} placeholder={addInput.placeholder} />
                        </div>

                    </div>

                </div>
            }
        </Form>
    );
}
