import { useState } from "react";
import { Form, Input, Select } from "antd";
import { NavLink, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { api } from "@shared/api/client";
import { fireToastMessage } from "@shared/ui/toast";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

// Landing page for the "Share My Feedback" button in the feedback email.
// Posts to the existing public POST /feedback endpoint, which stores the note
// and notifies the admins.
const CATEGORIES = [
  "General feedback",
  "Something is broken",
  "Feature request",
  "Nanny share matching",
  "Billing / subscription",
  "Other",
];

export default function FeedbackPage() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const user = useSelector((state) => state.auth?.user);
  // Prefill from the logged-in session, or from ?email= on the emailed link.
  const defaultEmail = user?.email || searchParams.get("email") || "";

  const handleSubmit = async (values) => {
    setIsLoading(true);
    try {
      const { data } = await api.post("/feedback", {
        email: values.email,
        category: values.category,
        message: values.message,
      });
      form.resetFields();
      setSent(true);
      fireToastMessage({ message: data.message });
    } catch (error) {
      fireToastMessage({
        type: "error",
        message:
          error.response?.data?.message || "We couldn't send your feedback.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Share Feedback"
        description="Tell the FamLink team what's working and what isn't"
      />
      <div className="px-4 py-12 flex justify-center">
        <div className="width-form">
          <p className="onboarding-head text-center mb-4">
            Share your feedback
          </p>

          {sent ? (
            <div className="text-center">
              <p className="font-normal text-base text-gray-700">
                Thank you — your feedback is with the FamLink team, and Ari reads
                every one.
              </p>
              <p className="mt-6 font-normal text-base already-acc">
                <NavLink to="/">
                  <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                    Back to FamLink
                  </span>
                </NavLink>
              </p>
            </div>
          ) : (
            <>
              <p className="text-center text-gray-600 mb-8 font-normal text-base">
                Good or bad — honest feedback is what helps us build something
                that actually works for families.
              </p>

              <Form
                name="feedbackForm"
                layout="vertical"
                form={form}
                onFinish={handleSubmit}
                initialValues={{
                  email: defaultEmail,
                  category: CATEGORIES[0],
                }}
              >
                <div className="relative w-full mb-6">
                  <Form.Item
                    style={{ margin: 0, padding: 0 }}
                    name="email"
                    rules={[
                      { required: true, message: "" },
                      { type: "email", message: "Enter a valid email" },
                    ]}
                  >
                    <Input
                      type="email"
                      placeholder="Your email"
                      className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </Form.Item>
                  <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                    Your email
                  </label>
                </div>

                <div className="relative w-full mb-6">
                  <Form.Item
                    style={{ margin: 0, padding: 0 }}
                    name="category"
                    rules={[{ required: true, message: "" }]}
                  >
                    <Select
                      bordered={false}
                      className="peer w-full pt-6 pb-2 px-2 border border-[#EEEEEE] rounded-[10px]"
                      style={{ height: "64px" }}
                    >
                      {CATEGORIES.map((c) => (
                        <Select.Option key={c} value={c}>
                          <span className="Livvic-SemiBold text-sm text-primary">
                            {c}
                          </span>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                    Topic
                  </label>
                </div>

                <div className="relative w-full">
                  <Form.Item
                    style={{ margin: 0, padding: 0 }}
                    name="message"
                    rules={[{ required: true, message: "" }]}
                  >
                    <Input.TextArea
                      rows={6}
                      placeholder="What's on your mind?"
                      className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-8 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary no-resize"
                    />
                  </Form.Item>
                  <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                    Your feedback
                  </label>
                </div>

                <div className="my-8 text-center">
                  <CustomButton
                    isLoading={isLoading}
                    loadingBtnText="Sending..."
                    htmlType={"submit"}
                    btnText={"Send feedback"}
                    className="bg-[#AEC4FF]"
                  />
                </div>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
