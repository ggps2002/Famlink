import { Form, Input, Select, Row, Col, Radio } from "antd";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { fieldKey } from "@shared/lib/fieldKey";
import CustomButton from "@shared/ui/Button";
import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { requestOTP, verifyOTP, resendOTP } from "@features/auth/store/emailSlice";

const { Option } = Select;
export function InputDa({
  name,
  val,
  req,
  /**
   * Whether the field must be filled in. Defaults to true, which is what every
   * existing call site relies on.
   *
   * Two call sites already pass `required={true}` and were being ignored
   * entirely: the component only ever read `req`, so the prop did nothing. It
   * happened to be harmless because the default is already "required", but a
   * `required={false}` written in the same spirit would have silently kept the
   * field mandatory.
   */
  required,
  form,
  type,
  placeholder,
  defaultValue,
  labelText = "",
  fp,
  emailVer,
}) {
  // `req` is the original prop and means the OPPOSITE of its name — passing it
  // marks a field optional. Kept working so existing call sites are unchanged,
  // but `required` is the one to reach for.
  const isRequired = required ?? !req;

  const rules = [
    {
      required: isRequired,
      // Ant Design renders a red border with no text when the message is
      // empty, which tells someone that something is wrong but not what. The
      // label is the only thing here that knows what the field is called.
      message: labelText ? `${labelText} is required` : "This field is required",
    },
  ];
  const dispatch = useDispatch();
  const [step, setStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 min countdown
  const [isResendEnabled, setIsResendEnabled] = useState(false);
  const { isLoading } = useSelector((state) => state.auth);
  const [otpInput, setOtpInput] = useState(["", "", "", ""]);
  const [errors, setErrors] = useState({});
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [email, setEmail] = useState(defaultValue ?? "");

  useEffect(() => {
    if (email !== verifiedEmail) {
      setVerifiedEmail("");
    }
  }, [form, verifiedEmail, email]);

  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const validateOtp = () => {
    const newErrors = {};
    const otp = otpInput.join("");
    if (otp.length !== 4) {
      newErrors.otp = "OTP is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    let timer;
    if (!isResendEnabled && step === 1 && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsResendEnabled(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [timeLeft, isResendEnabled, step]);

  // If it's an email field, add email format validation
  if (type === "email") {
    rules.push({
      type: "email",
      message: "",
    });
  }

  const handleSendOTP = async () => {
    if (!email) {
      fireToastMessage({
        type: "error",
        message: "Please enter a valid email address",
      });
      return;
    }
    try {
      const { data, status } = await dispatch(
        requestOTP({ email: email }),
      ).unwrap();
      if (status === 200) {
        fireToastMessage({ success: true, message: data.message });
        setTimeLeft(120);
        setStep((prevStep) => prevStep + 1);
      } else {
        fireToastMessage({ type: "error", message: data.message });
      }
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateOtp()) return;

    try {
      const otp = otpInput.join("");
      //   const { data, status } = await api.post("/sms-verification/verify-otp", {
      //     oneTimePass: otp,
      //     phoneNo: phoneNumber,
      //   });
      const { data, status } = await dispatch(
        verifyOTP({
          oneTimePass: otp,
          email: email,
        }),
      ).unwrap();
      if (status === 200) {
        setOtpInput(["", "", "", ""]);
        fireToastMessage({ success: true, message: data.message });
        setVerifiedEmail(email);
        setStep(0);
        form?.setFieldsValue({
          verifiedEmail: email,
        });
      } else {
        fireToastMessage({ type: "error", message: data.message });
      }
    } catch (err) {
      fireToastMessage({
        type: "error",
        message: err?.message || err?.error || "Verification failed.",
      });
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      fireToastMessage({
        type: "error",
        message: "No valid email address found",
      });
      return;
    }
    try {
      //   const { data } = await api.post("/sms-verification/resend-otp", {
      //     phoneNo: phoneNumber,
      //   });
      const { data, status } = await dispatch(
        resendOTP({
          email: email,
        }),
      ).unwrap();
      if (status === 200) {
        fireToastMessage({ type: "success", message: data.message });
        setTimeLeft(120);
        setIsResendEnabled(false);
      } else {
        fireToastMessage({ type: "error", message: data.message });
      }
    } catch (err) {
      fireToastMessage({
        type: "error",
        message: err?.message || err?.error || "Verification failed.",
      });
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otpInput];
    newOtp[index] = value;
    setOtpInput(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }

    // Clear errors when user starts typing
    if (errors.otp) {
      setErrors({ ...errors, otp: "" });
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otpInput[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, 4);

    if (digits.length === 4) {
      setOtpInput(digits.split(""));
    }
  };

  const renderEmailVerSteps = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex justify-end">
            {verifiedEmail.length > 0 ? (
              <div className="flex items-center mt-2">
                <div className="flex items-center gap-2 text-green-600">
                  <img
                    src="/check-circle.svg"
                    alt="check"
                    className="w-4 h-4"
                  />
                  <span className="text-sm Livvic-Medium">Verified</span>
                </div>
              </div>
            ) : (
              <CustomButton btnText={"Verify"} action={handleSendOTP} />
            )}
          </div>
        );

      case 1:
        return (
          <>
            <div className="w-full mt-6 ">
              <div className="flex justify-center mb-5">
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      value={otpInput[index]}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="w-12 h-12 text-center text-xl Livvic-SemiBold border-2 rounded-lg focus:outline-none focus:border-[#AEC4FF] focus:ring-2 focus:ring-[#AEC4FF] focus:ring-opacity-20 transition-all"
                      style={{
                        borderColor: errors.otp ? "#ef4444" : "#D6DDEB",
                      }}
                    />
                  ))}
                </div>
              </div>

              {errors.otp && (
                <div className="text-red-500 text-sm text-center mb-4">
                  {errors.otp}
                </div>
              )}

              <div className="flex justify-center items-center">
                {isResendEnabled ? (
                  <CustomButton
                    isLoading={isLoading}
                    action={handleResendOtp}
                    btnText={
                      isLoading ? (
                        <span className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        "Resend OTP"
                      )
                    }
                  />
                ) : (
                  <p className="text-gray-600 text-center">
                    Resend OTP in {formatTime(timeLeft)}
                  </p>
                )}
              </div>
            </div>
            <div className="m-0 p-0 mb-8 flex justify-end">
              <button
                type="button"
                disabled={isLoading}
                className="bg-[#AEC4FF] w-24 py-3 rounded-3xl text-white Livvic-Medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#9BB5FF] transition-colors text-primary Livvic-Medium"
                onClick={handleVerifyOtp}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Loading...
                  </span>
                ) : (
                  "Verify"
                )}
              </button>
            </div>
          </>
        );

      default:
        break;
    }
  };

  return (
    <div>
      <div className="relative w-full">
        <Form.Item
          style={{ margin: 0, padding: 0 }}
          name={val ? val : fieldKey(name)}
          rules={rules}
          initialValue={defaultValue}
        >
          <Input
            type={type}
            placeholder={placeholder}
            onChange={(e) => setEmail(e.target.value)}
            className={`peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 ${labelText.length > 0 ? "pt-7" : "pt-2" } pb-2 ${
              fp ? "w-[300px]" : "w-full"
            } placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary`}
          />
        </Form.Item>
        <label
          htmlFor={name}
          className="absolute left-4 top-2 text-sm Livvic-Medium text-[#666666] px-1 z-10"
        >
          {labelText}
        </label>
      </div>
      {emailVer && renderEmailVerSteps()}
    </div>
  );
}

export function InputPassword() {
  return (
    <div className="flex flex-col items-center gap-y-6 w-full">
      <div className="w-full mt-6">
        {/* <div className="relative w-full">
              <Form.Item style={{ margin: 0, padding: 0 }} name="email">
                <Input
                  type="email"
                  className="peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Email"
                />
                <label
                  htmlFor="fullName"
                  className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10"
                >
                  Your Email
                </label>
              </Form.Item>
            </div> */}
        <div className="relative w-full">
          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: "",
              },
              {
                pattern: /^.{8,}$/,
                message: "Password must be at least 8 characters!",
              },
            ]}
            hasFeedback
          >
            <Input.Password
              className="peer border border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-full  placeholder-transparent focus:outline-none "
              placeholder="Enter your password"
            />
          </Form.Item>
          <label
            htmlFor="password"
            className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10"
          >
            Password
          </label>
        </div>

        <div className="relative w-full">
          <Form.Item
            name="confirm"
            dependencies={["password"]}
            hasFeedback
            rules={[
              {
                required: true,
                message: "",
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(""));
                },
              }),
            ]}
          >
            <Input.Password
              className="peer border border-[#EEEEEE] rounded-[10px] px-4 pt-7 pb-2 w-full  placeholder-transparent focus:outline-none"
              placeholder="Enter password again"
            />
          </Form.Item>
          <label
            htmlFor="confirm password"
            className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10"
          >
            Confirm Password
          </label>
        </div>
      </div>
    </div>
  );
}

export function InputDOB() {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dates = Array.from({ length: 31 }, (_, i) => i + 1);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => currentYear - i);

  // ✅ age validator
  const validateAge = (_, value, form) => {
    const month = form.getFieldValue("month");
    const date = form.getFieldValue("date");
    const year = form.getFieldValue("year");

    if (!month || !date || !year) return Promise.resolve();

    const monthIndex = months.indexOf(month);
    const dob = new Date(year, monthIndex, date);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      return Promise.reject("Age must be 18 years or more");
    }

    return Promise.resolve();
  };

  return (
    <div className="relative">
      <Form.Item required>
        <div className="grid grid-cols-3 gap-2 px-4 pt-7 pb-2 border border-[#EEEEEE] rounded-[10px]">
          <Col>
            <Form.Item
              name="month"
              noStyle
              rules={[{ required: true, message: "" }]}
            >
              <Select className="width-dob" placeholder="Month">
                {months.map((month, index) => (
                  <Option key={index} value={month}>
                    {month}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col>
            <Form.Item
              name="date"
              noStyle
              rules={[{ required: true, message: "" }]}
            >
              <Select className="width-dob" placeholder="Date">
                {dates.map((date) => (
                  <Option key={date} value={date}>
                    {date}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col>
            <Form.Item
              name="year"
              noStyle
              rules={[
                { required: true, message: "" },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    validateAge(_, value, { getFieldValue }),
                }),
              ]}
            >
              <Select className="width-dob" placeholder="Year">
                {years.map((year) => (
                  <Option key={year} value={year}>
                    {year}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </div>
      </Form.Item>

      <label className="absolute left-4 top-2 text-sm text-[#666666] px-1 z-10">
        Date of birth
      </label>
    </div>
  );
}

export function InputRadio({ name, val, value, onRadioChange }) {
  const isChecked = value === val;

  return (
    <div
      className="bg-white px-4 py-4 rounded-[10px] input-width cursor-pointer shadow-soft"
      onClick={() => onRadioChange(val)}
    >
      <div className="flex justify-between items-center">
        <p className="Livvic-SemiBold text-sm">{name}</p>
        <div
          className={`w-5 h-5 rounded-full border-4 transition-colors duration-200 ${
            isChecked ? "border-[#AEC4FF]" : "border-[#EEEEEE]"
          }`}
        />
      </div>
    </div>
  );
}

export function SelectComponent({
  opt,
  selectedValue,
  onSelectChange,
  placeholder,
}) {
  return (
    // <div>
    //   <p className="mb-2 text-xl capitalize Livvic">{placeholder}</p>
    //   <Select
    //     className="custom-select h-12" // Apply custom class here
    //     value={selectedValue}
    //     placeholder={placeholder}
    //     onChange={onSelectChange}
    //     dropdownClassName="custom-dropdown" // Add custom dropdown styles if needed
    //   >
    //     {opt.map((opt) => (
    //       <Option key={opt} value={opt}>
    //         {opt}
    //       </Option>
    //     ))}
    //   </Select>
    <div className="relative w-72">
      <Select
        value={selectedValue}
        bordered={false}
        onChange={onSelectChange}
        className="peer w-full pt-6 pb-2 px-2 border border-[#EEEEEE] rounded-[10px]"
        style={{
          height: "64px",
        }}
      >
        {opt.map((opt) => (
          <Select.Option key={opt} value={opt}>
            <span className="Livvic-SemiBold text-sm text-primary">{opt}</span>
          </Select.Option>
        ))}
      </Select>
      <label className="absolute left-4 top-2 text-sm Livvic-Medium text-[#777777] px-1 z-10">
        {placeholder}
      </label>
    </div>
  );
}

export function InputTextArea({
  name,
  req,
  placeholder,
  head,
  rows,
  grid,
  labelText,
  form,
}) {
  return (
    <div>
      <div className="relative w-full">
        <Form.Item
          style={{ margin: 0, padding: 0 }}
          name={name} // ✅ always use explicit `name`
          rules={[
            {
              required: req ? true : false,
              message: "",
            },
          ]}
          preserve={false}
        >
          <Input.TextArea
            placeholder={placeholder}
            rows={rows || 6}
            onChange={async (e) => {
              form.setFieldsValue({
                [name]: e.target.value,
              });
            }}
            className={`peer border text-primary border-[#EEEEEE] rounded-[10px] px-4 pt-8 pb-2 w-full placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary ${
              !grid && "input-width"
            } no-resize`}
          />
        </Form.Item>
        {labelText && (
          <label
            htmlFor={name}
            className="absolute left-4 top-2 text-sm text-primary Livvic-Medium px-1 z-10"
          >
            {labelText}
          </label>
        )}
      </div>
    </div>
  );
}
