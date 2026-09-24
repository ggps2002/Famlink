import React, { useEffect } from "react";
import Form from "antd/es/form/Form";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import OpenText from "@features/nanny-share/post/OpenText";
import Avatar from "react-avatar";
import { CameraIcon } from "lucide-react";
import { InputDa } from "@shared/ui/Input";
import Input from "antd/es/input/Input";

import { CERTIFICATIONS } from "@shared/lib/profileOptions";
const step4Data = {
    first: CERTIFICATIONS,
};

function Step4({ formRef, handleImageChange, image, initialValues }) {
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
                Profile
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Write a short bio
                    </p>
                    <Form.Item
                        style={{ padding: 0, margin: 0 }}
                        name={"bio"}
                        rules={[{ required: true, message: "" }]}
                        initialValues={initialValues.bio}
                    >
                        <Input.TextArea
                            rows={4} // controls height (increase rows for taller box)
                            placeholder={"Leave a note about yourself"}
                            className="w-full max-w-2xl py-4 rounded-xl border-2 border-gray-200 focus:border-blue-400 shadow-sm mb-4"
                        />
                    </Form.Item>

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Do you have any certifications?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step4Data.first}
                        name={"certifications"}
                        defaultCheckedValues={initialValues?.certifications}
                        multi={true}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Add any additional certifications or training (optional)
                    </p>
                    <InputDa
                        type={"text"}
                        name={"customCertifications"}
                        req={true}
                        defaultValue={initialValues?.customCertifications}
                    />
                    {/* <OnboardingOptionSelector
                        form={form}
                        options={step4Data.second}
                        name={"householdTasks"}
                    /> */}

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        List any special skills (optional)
                    </p>
                    <InputDa type={"text"} name={"skills"} req={true}   defaultValue={initialValues?.skills}/>
                    {/* <OnboardingOptionSelector
                        form={form}
                        options={step4Data.second}
                        name={"householdTasks"}
                    /> */}

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        Profile Image
                    </p>
                    <div className="relative w-24 mx-auto mt-6">
                        {/* Profile Picture */}
                        {image ? (
                            <img
                                src={image}
                                alt="Profile"
                                className="rounded-full w-32 h-32 object-cover"
                            />
                        ) : (
                            <Avatar
                                className="rounded-full text-black"
                                size="96"
                                color={"#AEC4FF"}
                                name={"Image"
                                    ?.split(" ") // Split by space
                                    .slice(0, 2) // Take first 1–2 words
                                    .join(" ")}
                            />
                        )}

                        <label className="right-0 bottom-0 absolute flex justify-center items-center bg-gray-200 rounded-full w-8 h-8 cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={handleImageChange}
                            />
                            <CameraIcon alt="cameraIcons" size={16} />
                        </label>
                    </div>

                </div>
            </Form>
        </div>
    );
}

export default Step4;