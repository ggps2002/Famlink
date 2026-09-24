import React, { useEffect } from "react";
import { Form } from "antd";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";

import { TRAVEL_DISTANCE } from "@shared/lib/profileOptions";
const step5Data = {
    pets: [
        "Yes",
        "No"
    ],
    otherPets: [
        "Yes",
        "No"
    ],
    distance: TRAVEL_DISTANCE
};

function Step7({ formRef, initialValues }) {
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
                Environment
            </p>

            <Form form={form} name="validateOnly" autoComplete="off">
                <div className="mx-auto max-w-3xl">

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Are there pets in the home?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step5Data.pets}
                        name={"hasPets"}
                        defaultCheckedValue={initialValues?.["hasPets"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary mb-4">
                        Are you okay with another household having pets?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step5Data.otherPets}
                        name={"okayWithPets"}
                        defaultCheckedValue={initialValues?.["okayWithPets"]}
                    />

                    <p className="text-lg Livvic-SemiBold text-primary my-4">
                        How close should the other family be?
                    </p>
                    <OnboardingOptionSelector
                        form={form}
                        options={step5Data.distance}
                        name={"matchDistance"}
                        defaultCheckedValue={initialValues?.["matchDistance"]}
                    />

                </div>
            </Form>
        </div>
    );
}

export default Step7;