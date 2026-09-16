import { useEffect, useState } from "react";
// axios import removed - using your custom api instance
import { useDispatch, useSelector } from "react-redux"; // To access auth token or user
import { fireToastMessage } from "@shared/ui/toast"; // Your toast system
import { api } from "@shared/api/client";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { requestOTP, resendOTP, verifyOTP } from "@features/auth/store/smsSlice";
import { Edit2 } from "lucide-react";
import { updatePhoneThunk } from "@features/dashboard/store/updateSlice";

const PhoneVerification = () => {
  const [step, setStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 min countdown
  const [isResendEnabled, setIsResendEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("+91");
  const [otpInput, setOtpInput] = useState(["", "", "", ""]);
  const [errors, setErrors] = useState({});
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.sms);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [updatePhoneInput, setUpdatePhoneInput] = useState("");
  const [phoneInput, setPhoneInput] = useState(user?.phoneNo);

  // Country codes list
  const countryCodes = [
    { code: "+1", country: "US/CA", flag: "🇺🇸" },
    { code: "+44", country: "UK", flag: "🇬🇧" },
    { code: "+91", country: "IN", flag: "🇮🇳" },
    { code: "+86", country: "CN", flag: "🇨🇳" },
    { code: "+81", country: "JP", flag: "🇯🇵" },
    { code: "+49", country: "DE", flag: "🇩🇪" },
    { code: "+33", country: "FR", flag: "🇫🇷" },
    { code: "+39", country: "IT", flag: "🇮🇹" },
    { code: "+34", country: "ES", flag: "🇪🇸" },
    { code: "+61", country: "AU", flag: "🇦🇺" },
    { code: "+7", country: "RU", flag: "🇷🇺" },
    { code: "+55", country: "BR", flag: "🇧🇷" },
    { code: "+52", country: "MX", flag: "🇲🇽" },
    { code: "+82", country: "KR", flag: "🇰🇷" },
    { code: "+65", country: "SG", flag: "🇸🇬" },
    { code: "+971", country: "AE", flag: "🇦🇪" },
    { code: "+966", country: "SA", flag: "🇸🇦" },
    { code: "+31", country: "NL", flag: "🇳🇱" },
    { code: "+46", country: "SE", flag: "🇸🇪" },
    { code: "+47", country: "NO", flag: "🇳🇴" },
  ];

  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

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

  const validatePhoneNumber = () => {
    const newErrors = {};
    if (!phoneInput.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{7,15}$/.test(phoneInput.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = () => {
    const newErrors = {};
    const otp = otpInput.join("");
    if (otp.length !== 4) {
      newErrors.otp = "OTP is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestOtp = async () => {
    if (!validatePhoneNumber()) return;

    try {
      const formattedPhone = phoneInput.replace(/\s/g, "").replace(/^0/, "");
      const fullPhoneNumber = selectedCountryCode + formattedPhone;
      //   const { data } = await api.post("/sms-verification/send-otp", {
      //     phoneNo: fullPhoneNumber,
      //   });
      const { data, status } = await dispatch(
        requestOTP({ phoneNo: fullPhoneNumber })
      ).unwrap();
      if (status === 200) {
        setPhoneNumber(fullPhoneNumber);
        fireToastMessage({ message: data.message });
        setStep(1);
        setTimeLeft(120);
        setIsResendEnabled(false);
      } else {
        fireToastMessage({
          type: "error",
          message: data.message,
        });
      }
    } catch (err) {
      fireToastMessage({
        type: "error",
        message: err?.message || err?.error || "Verification failed.",
      });
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
          phoneNo: phoneNumber,
        })
      ).unwrap();
      if (status === 200) {
        setPhoneNumber("");
        setPhoneInput("");
        setOtpInput(["", "", "", ""]);
        fireToastMessage({ success: true, message: data.message });
        dispatch(refreshTokenThunk());
        setStep(0);
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
    try {
      //   const { data } = await api.post("/sms-verification/resend-otp", {
      //     phoneNo: phoneNumber,
      //   });
      const { data, status } = await dispatch(
        resendOTP({
          phoneNo: phoneNumber,
        })
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

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <>
            <div className="w-full mb-8 lg:mb-0">
              <div
                className="flex border-2 rounded-3xl overflow-hidden"
                style={{ borderColor: "#D6DDEB" }}
              >
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="px-3 py-3 bg-gray-50 border-r border-none text-sm Livvic-Medium focus:outline-none"
                  style={{ minWidth: "80px" }}
                >
                  {countryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (errors.phone) {
                      setErrors({ ...errors, phone: "" });
                    }
                  }}
                  className="flex-1 py-3 px-4 text-base border-none outline-none"
                  placeholder="Enter your phone number"
                  onKeyPress={(e) => {
                    if (!/\d/.test(e.key) && e.key !== "Backspace") {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              {errors.phone && (
                <div className="text-red-500 text-sm mt-2 ml-4">
                  {errors.phone}
                </div>
              )}
            </div>
            <div className="m-0 p-0 mb-8">
              <button
                type="button"
                disabled={isLoading}
                className="bg-[#AEC4FF] w-52 py-3 rounded-3xl text-white Livvic-Medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#9BB5FF] transition-colors text-primary Livvic-Medium"
                onClick={handleRequestOtp}
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
                  "Request for OTP"
                )}
              </button>
            </div>
          </>
        );

      case 1:
        return (
          <>
            <div className="w-full mb-6">
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
                  <button
                    disabled={isLoading}
                    onClick={handleResendOtp}
                    type="button"
                    className="bg-[#AEC4FF] px-6 py-2 rounded-3xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#9BB5FF] transition-colors text-primary Livvic-Medium"
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    )}
                  </button>
                ) : (
                  <p className="text-gray-600 text-center">
                    Resend OTP in {formatTime(timeLeft)}
                  </p>
                )}
              </div>
            </div>
            <div className="m-0 p-0 mb-8">
              <button
                type="button"
                disabled={isLoading}
                className="bg-[#AEC4FF] w-52 py-3 rounded-3xl text-white Livvic-Medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#9BB5FF] transition-colors text-primary Livvic-Medium"
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
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 0:
        return "Verify Phone Number";
      case 1:
        return "Write OTP";
      default:
        return "";
    }
  };

  const handleUpdatePhoneNumber = async () => {
    if (!updatePhoneInput.trim()) return;
    try {
      const { data, status } = await dispatch(
        updatePhoneThunk({
          phoneNo: updatePhoneInput,
        })
      ).unwrap();
      if (status === 200) {
        setUpdatePhoneInput("");
        fireToastMessage({ success: true, message: data.message });
        dispatch(refreshTokenThunk());
        setIsEditingPhone(false);
      }
    } catch (err) {
      fireToastMessage({
        type: "error",
        message: err?.message || err?.error || "Verification failed.",
      });
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      {user?.verified?.phoneVer ? (
        <div className="flex items-center mb-8 py-6">
          <div className="flex items-center gap-3 text-green-600">
            {!isEditingPhone && <img src="/check-circle.svg" alt="" />}
            {isEditingPhone ? (
              <div>
                <div className="w-full mb-8">
                  <div
                    className="flex border-2 rounded-3xl overflow-hidden"
                    style={{ borderColor: "#D6DDEB" }}
                  >
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="px-3 py-3 bg-gray-50 border-r border-none text-sm Livvic-Medium focus:outline-none"
                      style={{ minWidth: "80px" }}
                    >
                      {countryCodes.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={updatePhoneInput}
                      onChange={(e) => {
                        setUpdatePhoneInput(e.target.value);
                        if (errors.phone) {
                          setErrors({ ...errors, phone: "" });
                        }
                      }}
                      className="flex-1 py-3 px-4 text-base border-none outline-none"
                      placeholder="Enter your phone number"
                      onKeyPress={(e) => {
                        if (!/\d/.test(e.key) && e.key !== "Backspace") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  {errors.phone && (
                    <div className="text-red-500 text-sm mt-2 ml-4">
                      {errors.phone}
                    </div>
                  )}
                </div>
                <div className="mb-8 flex gap-6">
                  <button
                    type="button"
                    disabled={isLoading}
                    className="bg-[#AEC4FF] w-52 py-3 rounded-3xl text-white Livvic-Medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#9BB5FF] transition-colors text-primary Livvic-Medium"
                    onClick={handleUpdatePhoneNumber}
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
                      "Update phone number"
                    )}
                  </button>
                  {isEditingPhone && (
                    <button
                      onClick={() => setIsEditingPhone(false)}
                      className="text-sm text-gray-500 mt-2 underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-lg">{user.phoneNo}</span>
            )}
            {!isEditingPhone && (
              <Edit2
                className="w-4 h-4 cursor-pointer text-gray-400"
                onClick={() => setIsEditingPhone(true)}
              />
            )}

          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 mb-6 Livvic-SemiBold text-lg md:text-xl text-center Quicksand">
            {getStepTitle()}
          </p>

          <div className="flex flex-col lg:gap-8">{renderStepContent()}</div>
        </>
      )}
    </div>
  );
};

export default PhoneVerification;
