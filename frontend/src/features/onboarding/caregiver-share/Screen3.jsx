import React, { useEffect, useState } from "react";
import { Form, Input, Checkbox } from "antd";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { InputDa, InputPassword } from "@shared/ui/Input";
import TermsNotice from "@features/legal/components/TermsNotice";
import { GoogleLogin } from "@react-oauth/google";
import GoogleAuthBoundary from "@shared/auth/GoogleAuthBoundary";
import { fireToastMessage } from "@shared/ui/toast";
import { useDispatch } from "react-redux";
import { userCheckThunk } from "@features/auth/store/authSlice";
import { jwtDecode } from "jwt-decode";
import { updateForm } from "@shared/store/formValueSlice";
import { registerThunk } from "@features/auth/store/authSlice";
import { useNavigate, Link } from "react-router-dom";
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";

const Screen3 = ({ formRef, recordId, location, careType, setIsTermsChecked }) => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false)

  function LoginPage() {
    const onSuccess = async (credentialResponse) => {
      const decoded = jwtDecode(credentialResponse.credential);
      try {
        const res = await dispatch(
          userCheckThunk({ email: decoded.email })
        ).unwrap();

        if (res.message === "Email already exists") {
          fireToastMessage({ message: res.message, type: "error" });
          return;
        }

        dispatch(
          updateForm({
            name: decoded.name,
            email: decoded.email,
            imageUrl: decoded.picture,
            registeredVia: "google",
          })
        );
        setLoading(true)
        try {
          const signupPayload = {
            registeredVia: "google",
            name: decoded.name,
            email: decoded.email,
            imageUrl: decoded.picture,
            type: "Nanny",
            sheetId: recordId,
            services: [
              "NannyShareJob"
            ],
            goal: "Nanny adding a share",
            location: location,
          };

          const { data } = await dispatch(
            registerThunk(signupPayload)
          ).unwrap();

          fireToastMessage({
            success: true,
            message: data?.message || "Account created successfully",
          });

          if (!recordId) {
            console.error("No record ID found in URL");
            setLoading(false);
            return;
          }
          const payload = {
            action: "update",
            Id: recordId,
            Location: location?.format_location,
            Email: decoded.email,
            Type: careType,
          };

          const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

          if (!scriptUrl) {
            console.warn(
              "VITE_GOOGLE_SCRIPT_URL is not set. Data:",
              payload,
            );
            await new Promise((r) => setTimeout(r, 1400));
            return;
          }

          const formData = new URLSearchParams(payload).toString();

          await fetch(scriptUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData,
          });

          setLoading(false);

          navigate(`/login?recordId=${recordId}&email=${encodeURIComponent(decoded.email)}`);
          window.location.reload();
          return;
        } catch (err) {
          console.error("Register from recordId error:", err);
          fireToastMessage({
            type: "error",
            message: "We couldn’t complete your signup. Please try again.",
          });
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }

      } catch (err) {
        fireToastMessage({
          message: err.message || "Something went wrong",
          type: "error",
        });
      }
    };

    return (
      // The boundary, not the root provider stack, is what pulls in
      // Google's script — so it is fetched on this screen and nowhere else.
      <GoogleAuthBoundary>
        <GoogleLogin onSuccess={onSuccess} onError={() => { }} />
      </GoogleAuthBoundary>
    );
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [formRef, form]);

  if (loading) return <LoadingModal />

  return (
    <div className="flex flex-col items-center px-4">
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
        className="text-center mb-6 mt-4"
      >
        <p className="text-primary Livvic-Bold text-4xl mb-2">
          Welcome, Let's create <br />your account
        </p>
        <p className="text-gray-400 Livvic text-sm">
          Save your progress and see full profiles
        </p>
      </div>
      <div className="flex flex-col items-center">
        <LoginPage />
        <div className="flex items-center my-3 w-96">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="mx-4 text-sm text-gray-500">or</span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>
      </div>

      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.5s ease 120ms, transform 0.5s ease 120ms",
        }}
        className="w-full max-w-sm"
      >
        <Form 
          form={form} 
          name="screen3" 
          autoComplete="off"
          onValuesChange={(changed) => {
            if ('terms' in changed) {
              setIsTermsChecked?.(changed.terms);
            }
          }}
        >
          <div className="w-full">
            <InputDa type={"email"}
              name={"email"}
              emailVer={true}
              form={form}
              placeholder={"Enter your email"}
              labelText={"Your email"} />

            <Form.Item name="verifiedEmail" hidden>
              <Input type="hidden" />
            </Form.Item>
          </div>

          <div className="w-full">
            {" "}
            <InputPassword />
          </div>
          <Form.Item
            name="terms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Please agree to the Terms & Conditions and Privacy Policy")),
              },
            ]}
          >
            <Checkbox 
              className="text-left w-full mt-1" 
              onChange={(e) => setIsTermsChecked?.(e.target.checked)}
            >
              I have read and agree to Famlink's{" "}
              <Link
                to="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="Livvic-SemiBold underline hover:text-[#001243] transition-colors cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                Terms & Conditions
              </Link>
              {" "}and{" "}
              <a
                href="#"
                className="Livvic-SemiBold underline hover:text-[#001243] transition-colors cursor-pointer"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                Privacy Policy
              </a>.
            </Checkbox>
          </Form.Item>
        </Form>

        <div
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.5s ease 300ms",
          }}
          className="text-center mt-2"
        >
          <p className="Livvic text-gray-400 text-sm">
            Already have an account?{" "}
            <span
              className="text-primary Livvic-SemiBold underline cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Log in
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

const LoadingModal = () => (
  <div
    className="fixed inset-0 z-[999] flex items-center justify-center"
    style={{
      backdropFilter: "blur(8px)",
      backgroundColor: "rgba(0,0,0,0.35)",
    }}
  >
    <div
      className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4"
      style={{
        animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <div className="mb-5" style={{ width: 64, height: 64 }}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          style={{
            animation: "spin 1s linear infinite",
            width: 64,
            height: 64,
          }}
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            stroke="#AEC4FF"
            strokeWidth="6"
            strokeOpacity="0.25"
          />
          <path
            d="M32 6 a26 26 0 0 1 26 26"
            stroke="#AEC4FF"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">
        Processing your responses…
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        We're processing your responses. Just a moment!
      </p>

      <div className="flex gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-[#AEC4FF]"
            style={{
              width: 8,
              height: 8,
              animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>

    <style>{`
      @keyframes popIn {
        0%   { opacity: 0; transform: scale(0.85); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40%            { transform: translateY(-6px); opacity: 1; }
      }
    `}</style>
  </div>
);

export default Screen3;
