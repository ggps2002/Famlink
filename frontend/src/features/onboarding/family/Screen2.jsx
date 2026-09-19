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
import { registerThunk } from "@features/auth/store/authSlice";
import { familyGoalFor } from "@features/onboarding/registration";
import { useNavigate, Link } from "react-router-dom";

const Screen2 = ({ formRef, recordId, location, email, hasNanny, setIsTermsChecked }) => {
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

        // const loc = {
        //   type: "Point",
        //   coordinates: [coordinates?.lng, coordinates?.lat],
        //   format_location: coordinates?.formatted,
        // };

        // form.setFieldsValue({
        //   location: JSON.stringify(loc),
        //   zipCode,
        // });
        // if (coordinates || zipCode) {
        //   fireToastMessage({
        //     message: "Address and Zip Code is required!",
        //     type: "error",
        //   });
        //   return;
        // }
        // dispatch(
        //   updateForm({
        //     name: decoded.name,
        //     email: decoded.email,
        //     imageUrl: decoded.picture,
        //     registeredVia: "google",
        //     // location: JSON.stringify(loc),
        //     // zipCode,
        //   })
        // );
        setLoading(true)
        try {

          // parse children ages if needed

          const signupPayload = {
            registeredVia: "google",
            name: decoded.name,
            email: decoded.email,
            imageUrl: decoded.picture,
            type: "Parents",
            sheetId: recordId,
            goal: familyGoalFor(hasNanny),
            location: location,
          };

          const { data } = await dispatch(
            registerThunk(signupPayload)
          ).unwrap();

          fireToastMessage({
            success: true,
            message: data?.message || "Account created successfully",
          });

          // const { response, status } = await dispatch(nannyshareProfileThunk({
          //   careType: careType,
          //   careDistance: distance,
          //   careExperience: careExperience
          // })).unwrap();

          // if (status === 200) console.log("Created Profile", response)

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
          };

          const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

          if (!scriptUrl) {
            console.warn(
              "VITE_GOOGLE_SCRIPT_URL is not set. Data:",
              payload,
            );
            await new Promise((r) => setTimeout(r, 1400));
            // setIsLoading(false);
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
            message: "We couldn’t complete your signup. Please make sure your ZIP code and address are added, then try again.",
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
      {/* Lock icon + heading */}
      <p className="px-3 w-full text-center text-primary Livvic-Bold text-4xl mb-6 mt-4">
        <p className="px-3 w-full text-center text-primary Livvic-Bold text-4xl">
          Welcome, Let’s create <br />your account
        </p>
      </p>
      <div className="flex flex-col items-center">
        {/* <div
          className="flex gap-2 cursor-pointer bg-gray-100 justify-center Livvic-SemiBold text-sm text-primary w-96 py-4 mb-4 rounded-[6px]"
          onClick={handleGoogleSignup}
        >
          <img src="/google-icon.svg" alt="google" /> Continue with Google
        </div> */}
        <LoginPage />
        <div className="flex items-center my-3 w-96">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="mx-4 text-sm text-gray-500">or</span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>
      </div>

      {/* Form */}
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
          name="screen4" 
          autoComplete="off"
          onValuesChange={(changed) => {
            if ('terms' in changed) {
              setIsTermsChecked?.(changed.terms);
            }
          }}
        >
          {/* Email */}
          <div className="w-full">
            <InputDa type={"email"}
              name={"email"}
              defaultValue={email}
              emailVer={true}
              form={form}
              placeholder={"Enter your email"}
              labelText={"Your email"} />

            {/* Hidden field to store verified email */}
            <Form.Item name="verifiedEmail" hidden>
              <Input type="hidden" />
            </Form.Item>
          </div>

          {/* Password */}
          <div className="w-full">
            {" "}
            <InputPassword />
          </div>

          {/* Submit */}
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

        {/* Divider + login link */}
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
              onClick={() => window.location.href = "/login"}
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

export default Screen2;