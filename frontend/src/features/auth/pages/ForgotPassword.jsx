import { CloseOutlined } from "@ant-design/icons";
import { Form } from "antd";
import { useNavigate, NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { useState } from "react";
import { requestPasswordResetThunk } from "@features/auth/store/forgetPasswordSlice";
import { InputDa } from "@shared/ui/Input";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function ForgetPass() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [sentTo, setSentTo] = useState(null);
  const { isLoading } = useSelector((state) => state.forgetPassSlice);

  const handleGoBack = () => {
    navigate(-1); // Navigate back in history
  };

  const handleSubmit = async (values) => {
    try {
      const { data } = await dispatch(
        requestPasswordResetThunk({ email: values.email }),
      ).unwrap();
      setSentTo(values.email);
      fireToastMessage({ message: data.message });
      form.resetFields();
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Forget Password"
        description="Reset your password"
        noIndex={true}
      />
      <div className="px-4 py-4 rounded-3xl">
        <div className="flex justify-end">
          <button onClick={handleGoBack}>
            <CloseOutlined style={{ fontSize: "24px" }} />
          </button>
        </div>
        <div className="flex justify-center">
          <div>
            <p className="px-3 width-form text-center onboarding-head">
              Reset your password
            </p>

            {sentTo ? (
              <div className="flex justify-center mt-10">
                <div className="width-form text-center">
                  <p className="font-normal text-base text-gray-700">
                    If an account exists for{" "}
                    <span className="font-semibold">{sentTo}</span>, we've sent a
                    password reset link to it. The link expires in 1 hour.
                  </p>
                  <p className="mt-4 font-normal text-base text-gray-600">
                    Didn't get it? Check your spam folder, or{" "}
                    <button
                      type="button"
                      className="underline hover:text-blue-600 transition-colors"
                      onClick={() => setSentTo(null)}
                    >
                      try a different email
                    </button>
                    .
                  </p>
                  <p className="mt-6 font-normal text-base already-acc">
                    <NavLink to="/login">
                      <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                        Back to log in
                      </span>
                    </NavLink>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mt-10">
                <Form name="forgetForm" layout="vertical" onFinish={handleSubmit}>
                  <div>
                    <InputDa
                      name={"email"}
                      placeholder={"Enter your email"}
                      labelText="Email"
                      type={"email"}
                      fp={true}
                    />
                  </div>

                  <div className="my-5 text-center">
                    <div className="my-5 text-center">
                      <CustomButton
                        isLoading={isLoading}
                        loadingBtnText="Please wait..."
                        htmlType={"submit"}
                        btnText={"Send reset link"}
                        className="bg-[#AEC4FF]"
                      />
                    </div>

                    <p className="mt-2 mb-1 font-normal text-base already-acc">
                      New to Famlink?{" "}
                      <NavLink to="/joinNow">
                        <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                          Sign Up
                        </span>
                      </NavLink>
                    </p>
                  </div>
                </Form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
