import { CloseOutlined } from "@ant-design/icons";
import { useState, useRef, useEffect } from "react";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import HireStep1 from "@features/hire/components/step1";
import HireStep2 from "@features/hire/components/step2";
import { fireToastMessage } from "@shared/ui/toast";
import NannyNoStep2 from "@features/hire/components/NannyShareNo/step2";
import { useDispatch, useSelector } from "react-redux";
import { registerThunk, userCheckThunk } from "@features/auth/store/authSlice";
import Button from "@shared/ui/Button";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { fullNameFrom } from "@shared/lib/formName";

export default function NewHireForm() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedValue, setSelectedValue] = useState(null);

  const hireStep1FormRef = useRef(null);
  const hireStep2FormRef = useRef(null);

  const v = useSelector((s) => s.additionalSer);
  const val = useSelector((s) => s.form);

  const recordId = searchParams.get("recordId");
  const [sheetUserData, setSheetUserData] = useState(null);

  const parseChildAgesToYears = (agesString) => {
    if (!agesString) return { length: 0, info: {} };

    const agesArray = agesString.split(",").map((a) => a.trim());

    const info = {};

    agesArray.forEach((ageStr, index) => {
      let value = 0;

      if (ageStr.includes("year")) {
        value = parseFloat(ageStr);
      } else if (ageStr.includes("month")) {
        const months = parseFloat(ageStr);
        value = +(months / 12).toFixed(2); // convert to years
      }

      info[`Child${index + 1}`] = value;
    });

    return {
      length: agesArray.length,
      info,
    };
  };

  const data = [
    {
      name: "Private Educator",
      subHead: "Personalized academic support.",
    },
    {
      name: "Specialized Caregiver",
      subHead: "Doula, night nurse, special needs care.",
    },
    {
      name: "Sports Coaches",
      subHead: "Coaches for soccer, basketball, tennis, and more.",
    },
    {
      name: "Music Instructor",
      subHead: "Lessons for various musical instruments.",
    },
    {
      name: "Swim Instructor",
      subHead: "Swimming lessons and water safety.",
    },
    {
      name: "House Manager",
      subHead: "Help with maintaining an organized home.",
    },
  ];

  // =========================
  // FETCH SHEET DATA BY recordId
  // =========================
  useEffect(() => {
    const fetchSheetRecord = async () => {
      if (!recordId) return;

      try {
        setLoading(true);
        const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

        const response = await fetch(`${scriptUrl}?recordId=${recordId}`);
        const result = await response.json();

        if (result.status === "success" && result.record) {
          setSheetUserData(result.record);
        } else {
          fireToastMessage({
            type: "error",
            message: result.message || "Could not load saved data",
          });
        }
      } catch (error) {
        console.error("Sheet fetch error:", error);
        fireToastMessage({
          type: "error",
          message: "Failed to load saved record",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSheetRecord();
  }, [recordId]);

  const handleBack = () => {
    if (step === 1) {
      navigate(-1);
    } else {
      setStep((prevStep) => prevStep - 1);
    }
  };

  const handleNext = async () => {
    setLoading(true);

    if (step === 1 && hireStep1FormRef.current) {
      try {
        const values = await hireStep1FormRef.current.validateFields();
        const dob = `${values.month} ${values.date} ${values.year}`;

        if (!values.zipCode) {
          fireToastMessage({
            type: "error",
            message: "Please properly fill ZIP code field",
          });
          setLoading(false);
          return;
        }

        const fullName = fullNameFrom(values);
        const updatedFormData = {
          ...formData,
          ...values,
          name: fullName,
          dob,
        };

        delete updatedFormData.date;
        delete updatedFormData.year;
        delete updatedFormData.month;
        delete updatedFormData.confirm;

        setFormData(updatedFormData);

        try {
          await dispatch(userCheckThunk({ email: values.email })).unwrap();

          // =========================================
          // IF recordId EXISTS => REGISTER IMMEDIATELY
          // =========================================
          if (recordId && sheetUserData) {
            try {

              // parse children ages if needed
              const parsedChildAges = parseChildAgesToYears(sheetUserData["Child age(s)"]);

              const signupPayload = {
                ...val,
                ...updatedFormData,
                type: "Parents",
                sheetId: recordId,
                services: [
                  "Nanny"
                ],
                noOfChildren: parsedChildAges || "",
              };

              const { data } = await dispatch(
                registerThunk(signupPayload)
              ).unwrap();

              fireToastMessage({
                success: true,
                message: data?.message || "Account created successfully",
              });

              navigate(`/login?recordId=${recordId}&email=${encodeURIComponent(values.email)}&password=${encodeURIComponent(values.password)}`);
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
            }
          }

          // =========================================
          // NORMAL FLOW (NO recordId)
          // =========================================
          setStep((prevStep) => prevStep + 1);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          fireToastMessage({ type: "error", message: err.message });
        }
      } catch (errorInfo) {
        setLoading(false);
        const fieldName = errorInfo?.errorFields?.[0]?.name?.[0];

        if (fieldName === "remember") {
          fireToastMessage({
            type: "error",
            message: "Please check Terms & Condition",
          });
        } else if (["month", "date", "year"].includes(fieldName)) {
          fireToastMessage({
            type: "error",
            message: `Please set ${fieldName} properly`,
          });
        } else if (fieldName === "zipCode") {
          fireToastMessage({
            type: "error",
            message: "Please fill the ZIP code properly",
          });
        } else {
          fireToastMessage({
            type: "error",
            message: "Please correct all required fields",
          });
        }
      }
    } else if (step === 2 && hireStep2FormRef.current) {
      try {
        const values = await hireStep2FormRef.current.validateFields();
        const services = Object.keys(values).filter((key) => values[key]);

        if (services.length > 0) {
          setFormData((prevState) => ({ ...prevState, services }));
          setStep((prevStep) => prevStep + 1);
        } else {
          fireToastMessage({
            type: "error",
            message: "Select at least one option",
          });
        }
      } catch (errorInfo) {
        fireToastMessage({
          type: "error",
          message:
            errorInfo?.errorFields?.[0]?.errors?.[0] || "Validation failed",
        });
      } finally {
        setLoading(false);
      }
    } else if (step === 3) {
      hireStep2FormRef.current
        .validateFields()
        .then(async (values) => {
          const hasAnyChildValue = Object.values(values).some(
            (val) => val !== undefined && val !== ""
          );

          if (hasAnyChildValue) {
            const finalChildren = {
              length: Object.keys(values).length,
              info: values,
            };

            setFormData((prevState) => ({
              ...prevState,
              noOfChildren: finalChildren,
            }));

            try {
              const { data } = await dispatch(
                registerThunk({
                  ...val,
                  ...formData,
                  noOfChildren: finalChildren,
                  type: "Parents",
                })
              ).unwrap();

              fireToastMessage({
                success: true,
                message: data.message,
              });

              navigate("/login");
              window.location.reload();
            } catch (err) {
              fireToastMessage({ type: "error", message: err.message });
            }
          } else {
            fireToastMessage({
              type: "error",
              message: "Select number of children",
            });
          }
        })
        .catch((errorInfo) => {
          const errorMsg =
            errorInfo?.errorFields?.[0]?.errors?.[0] ||
            "Please complete the required fields.";
          fireToastMessage({ type: "error", message: errorMsg });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="padd-res">
      <SEOMetaData
        title="Sign Up to Hire Nannies | Famlink"
        description="Create your account to hire caregivers, find nanny shares, and manage childcare with Famlink."
      />

      <div className="px-4 py-4 rounded-3xl">
        <div className="flex justify-center">
          <div>
            {step === 1 && (
              <HireStep1
                formRef={hireStep1FormRef}
                head={"Welcome, Let’s create your account"}
                type="Parents"
                handleNext={() => setStep((prev) => prev + 1)}
                initialData={sheetUserData} // ✅ prefill from sheet
                recordId={recordId}
              />
            )}

            {step === 2 && (
              <NannyNoStep2
                formRef={hireStep2FormRef}
                data={data}
                defaultValue={"Nanny"}
                defaultSubValue={"Full-time, part-time, or live-in care."}
              />
            )}

            {step === 3 && (
              <HireStep2
                opt={Array.from({ length: 4 }, (_, i) => i + 1)}
                formRef={hireStep2FormRef}
                selectedValue={selectedValue}
                handleSelectChange={setSelectedValue}
              />
            )}

            <div className="my-5 space-x-6 text-center">
              <Button
                action={() => handleBack()}
                btnText={"Back"}
                className="border border-[#FFFFFF] text-[#555555]"
              />

              {step > 0 && step <= 3 && (
                <Button
                  btnText={step===1 && recordId ? "Sign up" : "Continue"}
                  action={() => handleNext()}
                  className="bg-[#AEC4FF] text-primary"
                  isLoading={loading}
                  loadingBtnText="Loading..."
                />
              )}

              {step === 0 && (
                <p className="mt-2 mb-10 font-normal text-base cursor-pointer already-acc">
                  Already have an account?{" "}
                  <NavLink
                    to="/login"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  >
                    <span className="hover:text-blue-600 underline transition-colors duration-300">
                      Log in
                    </span>
                  </NavLink>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}