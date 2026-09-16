import { Form, Input } from "antd";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { resetPasswordWithTokenThunk } from "@features/auth/store/forgetPasswordSlice";
import CustomButton from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";

export default function ResetPassword() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const { isLoading } = useSelector((state) => state.forgetPassSlice);

  const token = searchParams.get("token");
  const email = searchParams.get("email") || "";

  const handleSubmit = async (values) => {
    try {
      const { data } = await dispatch(
        resetPasswordWithTokenThunk({
          email,
          token,
          newPassword: values.password,
        }),
      ).unwrap();
      form.resetFields();
      fireToastMessage({ message: data.message });
      navigate("/login");
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Reset Password"
        description="Set a new password for your FamLink account"
        noIndex={true}
      />
      <div className="px-4 py-4 rounded-3xl">
        <div className="flex justify-center">
          <div>
            <p className="px-3 width-form text-center onboarding-head">
              Set a new password
            </p>

            {!token ? (
              <div className="flex justify-center mt-10">
                <div className="width-form text-center">
                  <p className="font-normal text-base text-gray-700">
                    This reset link is missing or invalid. Please request a new
                    one.
                  </p>
                  <p className="mt-6 font-normal text-base already-acc">
                    <NavLink to="/forgetPass">
                      <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                        Request a new link
                      </span>
                    </NavLink>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mt-10">
                <Form
                  name="resetForm"
                  layout="vertical"
                  onFinish={handleSubmit}
                  form={form}
                >
                  {email && (
                    <p className="text-center text-gray-600 mb-6 width-form">
                      Resetting the password for{" "}
                      <span className="font-semibold">{email}</span>
                    </p>
                  )}

                  <div className="relative w-full mb-6">
                    <Form.Item
                      style={{ margin: 0, padding: 0 }}
                      name="password"
                      rules={[
                        { required: true, message: "" },
                        {
                          pattern: /^.{8,}$/,
                          message: "Password must be at least 8 characters!",
                        },
                      ]}
                      hasFeedback
                    >
                      <Input.Password
                        className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-[300px] placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="New password"
                      />
                    </Form.Item>
                    <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                      New password
                    </label>
                  </div>

                  <div className="relative w-full">
                    <Form.Item
                      style={{ margin: 0, padding: 0 }}
                      name="confirm"
                      dependencies={["password"]}
                      hasFeedback
                      rules={[
                        { required: true, message: "" },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue("password") === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(
                              new Error("Passwords do not match"),
                            );
                          },
                        }),
                      ]}
                    >
                      <Input.Password
                        className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-[300px] placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Confirm new password"
                      />
                    </Form.Item>
                    <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10">
                      Confirm password
                    </label>
                  </div>

                  <div className="my-8 text-center">
                    <CustomButton
                      isLoading={isLoading}
                      loadingBtnText="Please wait..."
                      htmlType={"submit"}
                      btnText={"Reset password"}
                      className="bg-[#AEC4FF]"
                    />
                    <p className="mt-4 font-normal text-base already-acc">
                      <NavLink to="/login">
                        <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                          Back to log in
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
