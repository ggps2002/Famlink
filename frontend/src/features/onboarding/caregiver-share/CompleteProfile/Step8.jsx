import React, { useEffect, useState } from "react";
import { Form, Input, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

const certificationsData = [
    "CPR Certified",
    "First Aid Certified",
    "Other"
];

function Step8({ formRef, image, handleImageChange }) {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);

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
                Final Details
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-2 mt-4">
                        Anything else another family should know?
                    </p>
                    <Form.Item name="bio" rules={[{ required: true, message: "Please provide a short description" }]}>
                        <Input.TextArea
                            rows={4}
                            placeholder="Tell us about the family you work for, your experience, or anything else..."
                            className="w-full px-4 pt-4 pb-3 border border-gray-200 rounded-xl text-sm Livvic text-gray-700 focus:outline-none focus:border-primary resize-none transition-colors"
                        />
                    </Form.Item>

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Do you have any certifications? (select all)
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={certificationsData}
                        name={"certifications"}
                        multi={true}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Upload a photo (recommended)
                    </p>
                    <div className="flex items-center space-x-4">
                        <label className="cursor-pointer">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleImageChange} 
                            />
                            <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                                {image ? (
                                    <img src={image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <PlusOutlined className="text-xl mb-1" />
                                        <div className="text-xs Livvic-SemiBold">Upload</div>
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>

                </div>
            </Form>
        </div>
    );
}

export default Step8;
