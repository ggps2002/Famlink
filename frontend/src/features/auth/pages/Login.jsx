import { useState, useEffect } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { Input, Spin, Form } from "antd";
import CustomButton from "@shared/ui/Button";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginThunk } from "@features/auth/store/authSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { nannyshareProfileThunk } from "@features/nanny-share/store/nannyShareSlice";


export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetUserData, setSheetUserData] = useState(null);
  const { isLoading } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("recordId");
  const email = searchParams.get("email");
  const password = searchParams.get("password");

  // Where to land after a successful login. Set by App.jsx when a logged-out
  // visitor clicks a /dashboard/* link (e.g. from an email) — we send them here
  // afterwards instead of the default dashboard. Only same-site absolute paths
  // are honoured ("/dashboard/requests"), never "//evil.com" or a full URL, so
  // the param can't be used as an open redirect.
  const redirectParam = searchParams.get("redirect");
  const safeRedirect =
    redirectParam && /^\/(?!\/)/.test(redirectParam) ? redirectParam : null;
  const postLoginTarget = safeRedirect || "/dashboard";

  // const [sheetLoading, setSheetLoading] = useState(false);
  // Closing the page goes back where the visitor came from — except when there's
  // nothing safe behind us. A visitor App.jsx bounced here (any logged-out hit on
  // /dashboard/*, which is what a member sees mid-logout) has the redirecting
  // page as their previous entry, so navigate(-1) walks straight back into the
  // bounce and returns them to this page; likewise /login opened as the first
  // entry in a tab has nowhere to go back to at all. Both go home instead.
  const handleGoBack = () => {
    const hasPreviousPage = window.history.state?.idx > 0;
    if (redirectParam || !hasPreviousPage) {
      navigate("/", { replace: true });
    } else {
      navigate(-1);
    }
  };

  // =========================
  // AUTO LOGIN FROM SHEET RECORD ID
  // =========================
  useEffect(() => {
    const redirectUser = (user) => {
      if (user.type === "Nanny" || user.type === "Parents") {
        navigate(postLoginTarget);
      } else {
        fireToastMessage({
          type: "error",
          message: "This is not for admin",
        });
      }
    };

    const init = async () => {
      if (!recordId) return;

      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

      try {
        setSheetLoading(true);

        // 1. Fetch sheet data
        const res = await fetch(`${scriptUrl}?recordId=${encodeURIComponent(recordId)}`);
        const result = await res.json();

        if (result.status !== "success" || !result.record) {
          throw new Error(result.message || "Failed to fetch record");
        }

        const sheetData = result.record;
        setSheetUserData(sheetData);

        // 2. Login
        const loginResult = password
          ? await dispatch(loginThunk({ email, password }))
          : await dispatch(loginThunk({ email }));

        if (!loginThunk.fulfilled.match(loginResult)) {
          throw new Error(loginResult.payload?.message || "Login failed");
        }

        const { user, status } = loginResult.payload;

        if (status !== 200) throw new Error("Login failed");

        const hasFamilyBoolean =
          sheetData["Path"] === "Already works with a family" ? true :
            sheetData["Path"] === "Looking for nanny share position" ? false : null;

        const hasNannyBoolean =
          sheetData["Already have nanny"] === "yes" ? true :
            sheetData["Already have nanny"] === "no" ? false : null;

        function parseSheetChildrenAges(ageString = "") {
          if (!ageString) return [];

          return ageString.split(",").map((part) => {
            const trimmed = part.trim().toLowerCase();

            const monthMatch = trimmed.match(/(\d+)\s*month/);
            const yearMatch = trimmed.match(/(\d+)\s*year/);

            if (monthMatch) {
              const num = parseInt(monthMatch[1]);
              return {
                label: `${num} months`,
                value: parseFloat((num / 12).toFixed(4)),
                unit: "months",
              };
            }

            if (yearMatch) {
              const num = parseInt(yearMatch[1]);
              return {
                label: `${num} yrs`,
                value: num,
                unit: "years",
              };
            }

            return null;
          }).filter(Boolean);
        }

        const childrenAges = parseSheetChildrenAges(sheetData["Child age(s)"]);
        const numberOfChildren = parseInt(sheetData["Number of children"]);

        // 3. Create profile (NOW sheetData is available)
        await dispatch(
          nannyshareProfileThunk({
            careType: sheetData["Type"],
            careDistance: sheetData["Distance"],
            careExperience: sheetData["Experience"],
            hasFamily: hasFamilyBoolean,
            hasNanny: hasNannyBoolean,
            numberOfChildren,
            childrenAges, //add the chilren ages as decided,
          })
        ).unwrap();


        fireToastMessage({
          success: true,
          message: "Logged in successfully",
        });

        redirectUser(user);

      } catch (err) {
        console.error(err);
        fireToastMessage({
          type: "error",
          message: err.message || "Something went wrong",
        });
      } finally {
        setSheetLoading(false);
      }
    };

    init();
  }, [recordId]);

  function LoginPage() {
    const onSuccess = async (credentialResponse) => {
      const decoded = jwtDecode(credentialResponse.credential);
      try {
        const result = await dispatch(loginThunk({ email: decoded.email }));

        if (loginThunk.fulfilled.match(result)) {
          const { user, status } = result.payload;

          if (status == 200) {
            if (user.type === "Nanny" || user.type === "Parents") {
              navigate(postLoginTarget);
            } else {
              fireToastMessage({
                type: "error",
                message: "This is not for admin",
              });
            }
          }
        } else if (loginThunk.rejected.match(result)) {
          const { message } = result.payload || {};
          fireToastMessage({
            type: "error",
            message: message || "Login failed",
          });
        }
      } catch (err) {
        console.error("Google signup callback error:", err);
      }
    };

    const onError = () => {
      console.error("Login Failed");
    };

    return <GoogleLogin onSuccess={onSuccess} onError={onError} />;
  }
  const handleSubmit = async (values) => {
    try {
      const { user, status } = await dispatch(loginThunk(values)).unwrap();
      if (status == 200) {
        if (user.type === "Nanny" || user.type === "Parents") {
          navigate(postLoginTarget);
        } else {
          fireToastMessage({ type: "error", message: "This is not for admin" });
        }
      }
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  if (recordId && sheetLoading) {
    return <SheetLoadingModal />
  }

  return (
    <div className="padd-res bg-[#F6F3EE] w-sceen min-h-screen overflow-x-hidden flex justify-center items-center">
      {isLoading && <LoadingModal />}
      <SEOMetaData
        title={"Login | Famlink"}
        description={`Access your Famlink account to manage your nanny share, view schedules, and connect with families.
`}
      />

      {/* {(sheetLoading || isLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white px-6 py-5 rounded-2xl shadow-xl flex flex-col items-center">
            <Spin size="large" />
            <p className="mt-4 text-[#08428D] Livvic-SemiBold">
              Signing you in...
            </p>
          </div>
        </div>
      )} */}
      <div className="px-4 py-4">
        <div className="flex justify-end">
          <button onClick={handleGoBack}>
            <CloseOutlined style={{ fontSize: "24px" }} />
          </button>
        </div>
        <div className="flex justify-center">
          <div>
            <div className="top-0 z-50 sticky flex items-center justify-center mb-3 w-full h-20">
              <NavLink
                to="/"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <div className="flex gap-1 items-center">
                  <img
                    src="/logo3.png"
                    alt="logo"
                    className="w-6 h-6 sm:w-8 sm:h-8"
                  />
                  <p className="Livvic-Bold text-lg sm:text-xl Livvic-Bold">
                    Famlink
                  </p>
                </div>
              </NavLink>
            </div>
            <p className="px-3 width-form text-center Livvic-Bold text-3xl text-[#08428D]">
              Log in to your Account
            </p>
            <div className="flex flex-col items-center mt-10">
              <LoginPage />
              <div className="flex items-center my-3 w-96">
                <div className="flex-grow h-px bg-gray-300" />
                <span className="mx-4 text-sm text-gray-500">or</span>
                <div className="flex-grow h-px bg-gray-300" />
              </div>

              <Form name="loginForm" layout="vertical" onFinish={handleSubmit}>
                <div>
                  <p className="mb-1 text-sm Livvic-SemiBold text-[#555555]">
                    Your email
                  </p>
                  <Form.Item
                    name="email"
                    rules={[{ required: true, message: "" }]}
                  >
                    <Input
                      type={"email"}
                      placeholder={"Enter email"}
                      className="py-4 border-none rounded-[6px] w-96"
                    />
                  </Form.Item>
                </div>

                <div>
                  <p className="mb-1 text-sm Livvic-SemiBold text-[#555555]">
                    Password
                  </p>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: "" }]}
                    style={{ margin: 0 }}
                  >
                    <Input.Password
                      placeholder="Enter password"
                      className="py-4 border-none rounded-[6px]"
                    />
                  </Form.Item>
                  <p className="font-normal text-end mr-2 mt-2">
                    <NavLink
                      to="/forgetPass"
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                    >
                      <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                        Forgot password?
                      </span>
                    </NavLink>
                  </p>
                </div>

                <div className="my-5 text-center">
                  {/* <Button
                    type="primary"
                    htmlType="submit"
                    loading={isLoading}
                    className="mx-auto my-0 px-6 py-2 rounded-full w-48 font-normal text-base text-white transition hover:-translate-y-1 duration-700 delay-150 ease-in-out hover:scale-110"
                    style={{ background: "#AEC4FF", border: "none" }}
                  >
                    Login
                  </Button> */}
                  <CustomButton
                    btnText={"Sign In"}
                    htmlType="submit"
                    isLoading={isLoading}
                    loadingBtnText="Signing In..."
                    className="bg-[#AEC4FF] w-full !py-3"
                  />
                  <p className="mt-2 mb-10 font-normal text-base already-acc">
                    New to Famlink?{" "}
                    <NavLink
                      to="/joinNow"
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                    >
                      <span className="hover:text-blue-600 underline transition-colors duration-300 cursor-pointer">
                        Sign Up
                      </span>
                    </NavLink>
                  </p>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            stroke="#FFADE1"
            strokeWidth="6"
            strokeOpacity="0.25"
          />
          <path
            d="M32 6 a26 26 0 0 1 26 26"
            stroke="#FFADE1"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">
        Signing you in…
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        Hang tight while we log you in. Just a moment!
      </p>

      <div className="flex gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-[#FFADE1]"
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

const SheetLoadingModal = () => (
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
        Please Wait…
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
