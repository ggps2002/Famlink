import { useState } from "react";
import { Form, Input } from "antd";
import { NavLink, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { api } from "@shared/api/client";
import { fireToastMessage } from "@shared/ui/toast";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

// Public support page. Reached from the "Contact Support" button in the account
// deactivation email and the "Contact Us" footer link — both need to work for a
// user who can't log in, so this page requires no session. Submissions go to the
// existing public POST /feedback endpoint (category "Support"), which notifies
// the admins.
export default function Contact() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const user = useSelector((state) => state.auth?.user);
  const defaultEmail = user?.email || searchParams.get("email") || "";

  const handleSubmit = async (values) => {
    setIsLoading(true);
    try {
      const { data } = await api.post("/feedback", {
        email: values.email,
        category: "Support",
        message: values.message,
      });
      form.resetFields();
      setSent(true);
      fireToastMessage({ message: data.message });
    } catch (error) {
      fireToastMessage({
        type: "error",
        message:
          error.response?.data?.message || "We couldn't send your message.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Contact Support"
        description="Get help from the FamLink support team"
      />
      <div className="px-4 py-12 flex justify-center">
        <div className="width-form">
          <p className="onboarding-head text-center mb-4">Contact support</p>

          {sent ? (
            <div className="text-center">
              <p className="font-normal text-base text-gray-700">
                Thanks — we've got your message. Our support team will review it
                and get back to you within 2 business days.
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
                Tell us what's going on and we'll get back to you within 2
                business days. You can also email us directly at{" "}
                <a
                  href="mailto:support@famlink.care"
                  className="underline hover:text-blue-600 transition-colors"
                >
                  support@famlink.care
                </a>
                .
              </p>

              <Form
                name="contactForm"
                layout="vertical"
                form={form}
                onFinish={handleSubmit}
                initialValues={{ email: defaultEmail }}
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

                <div className="relative w-full">
                  <Form.Item
                    style={{ margin: 0, padding: 0 }}
                    name="message"
                    rules={[{ required: true, message: "" }]}
                  >
                    <Input.TextArea
                      rows={6}
                      placeholder="How can we help?"
                      className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-8 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary no-resize"
                    />
                  </Form.Item>
                  <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                    Your message
                  </label>
                </div>

                <div className="my-8 text-center">
                  <CustomButton
                    isLoading={isLoading}
                    loadingBtnText="Sending..."
                    htmlType={"submit"}
                    btnText={"Send message"}
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
