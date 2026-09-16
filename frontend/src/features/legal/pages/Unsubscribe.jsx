import { useEffect, useState } from "react";
import { Form, Input } from "antd";
import { NavLink, useSearchParams } from "react-router-dom";
import { api } from "@shared/api/client";
import { fireToastMessage } from "@shared/ui/toast";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

// Landing page for the "Unsubscribe" link in the footer of every FamLink email.
//
// Two ways in:
//   • With ?email=&token= (our backend emails) — the token is an HMAC of the
//     address, so we unsubscribe immediately: one click, no login.
//   • Without a token (e.g. a campaign-app send, which can't carry our HMAC) —
//     we ask for the address and email back a signed link, so nobody can
//     unsubscribe an address they don't control.
export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const hasSignedLink = Boolean(email && token);

  // "working" only applies to the signed-link path.
  const [status, setStatus] = useState(hasSignedLink ? "working" : "askEmail");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasSignedLink) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.post("/unsubscribe", { email, token });
        if (!cancelled) {
          setStatus("done");
          setMessage(data.message);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error.response?.data?.message ||
              "We couldn't process this unsubscribe link.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, token, hasSignedLink]);

  const requestLink = async (values) => {
    setIsLoading(true);
    try {
      const { data } = await api.post("/unsubscribe/request", {
        email: values.email,
      });
      setStatus("linkSent");
      setMessage(data.message);
    } catch (error) {
      fireToastMessage({
        type: "error",
        message:
          error.response?.data?.message || "We couldn't send that link.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const heading = {
    working: "Unsubscribing…",
    done: "You're unsubscribed",
    error: "Something went wrong",
    askEmail: "Unsubscribe from FamLink emails",
    linkSent: "Check your email",
  }[status];

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Unsubscribe"
        description="Manage your FamLink email preferences"
        noIndex={true}
      />
      <div className="px-4 py-16 flex justify-center">
        <div className="width-form text-center">
          <p className="onboarding-head mb-6">{heading}</p>

          {status === "working" && (
            <p className="font-normal text-base text-gray-600">
              One moment while we update your preferences.
            </p>
          )}

          {status === "done" && (
            <>
              <p className="font-normal text-base text-gray-700">{message}</p>
              {email && (
                <p className="mt-2 font-normal text-base text-gray-600">
                  No more FamLink emails will be sent to{" "}
                  <span className="font-semibold">{email}</span>.
                </p>
              )}
              <p className="mt-6 font-normal text-base text-gray-600">
                Changed your mind? You can turn individual emails back on any
                time from{" "}
                <NavLink to="/dashboard/setting">
                  <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                    your notification settings
                  </span>
                </NavLink>
                .
              </p>
            </>
          )}

          {status === "linkSent" && (
            <p className="font-normal text-base text-gray-700">{message}</p>
          )}

          {(status === "askEmail" || status === "error") && (
            <>
              <p className="font-normal text-base text-gray-600 mb-8">
                {status === "error"
                  ? message
                  : "Enter your email and we'll send you a link to confirm."}
              </p>

              <Form
                name="unsubscribeForm"
                layout="vertical"
                onFinish={requestLink}
                initialValues={{ email }}
              >
                <div className="relative w-full">
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

                <div className="my-8">
                  <CustomButton
                    isLoading={isLoading}
                    loadingBtnText="Sending..."
                    htmlType={"submit"}
                    btnText={"Send unsubscribe link"}
                    className="bg-[#AEC4FF]"
                  />
                </div>
              </Form>
            </>
          )}

          <p className="mt-8 font-normal text-base already-acc">
            <NavLink to="/">
              <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                Back to FamLink
              </span>
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}
