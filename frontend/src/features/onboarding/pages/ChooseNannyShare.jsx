import React, { useState } from 'react';
import { useNavigate, NavLink } from "react-router-dom";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { Form } from 'antd';
import Button from '@shared/ui/Button';
import { InputDa } from '@shared/ui/Input';
import { fireToastMessage } from '@shared/ui/toast';
import { Baby, BriefcaseIcon, Users } from 'lucide-react';
import { fullNameFrom } from "@shared/lib/formName";

/* ─────────────────────────────────────────
   Loading Modal
───────────────────────────────────────── */
const LoadingModal = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
    <div className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4 animate-[popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="mb-5 w-16 h-16">
        <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 animate-spin">
          <circle cx="32" cy="32" r="26" stroke="#AEC4FF" strokeWidth="6" strokeOpacity="0.25" />
          <path d="M32 6 a26 26 0 0 1 26 26" stroke="#AEC4FF" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">Processing your info…</h2>
      <p className="text-gray-400 text-sm leading-relaxed">Finding the best nanny share path for you!</p>
      <div className="flex gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-[#AEC4FF] w-2 h-2"
            style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
    <style>{`
      @keyframes popIn  { 0%{opacity:0;transform:scale(0.85)} 100%{opacity:1;transform:scale(1)} }
      @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }
    `}</style>
  </div>
);

/* ─────────────────────────────────────────
   Maybe Later Modal
───────────────────────────────────────── */
const MaybeLaterModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
    <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="flex items-center justify-center rounded-full mb-5 w-[68px] h-[68px] bg-[#AEC4FF]">
        <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none">
          <path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">We'll be in touch! 💌</h2>
      <p className="text-gray-600 text-sm mb-6 leading-relaxed">
        Create a free account to browse compatible nanny share positions in your area right now.
      </p>
      <NavLink
        to="/joinNow"
        className="w-full block text-center bg-[#AEC4FF] hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3 no-underline"
      >
        Create account to see positions now
      </NavLink>
      <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        No thanks
      </button>
    </div>
    <style>{`@keyframes popIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}`}</style>
  </div>
);

/* ─────────────────────────────────────────
   Success Modal
───────────────────────────────────────── */
const SuccessModal = ({ onClose, selectedPath, navigate, recordId }) => {
  const [showMaybeLater, setShowMaybeLater] = useState(false);

  if (showMaybeLater) return <MaybeLaterModal onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
      <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <div className="flex items-center justify-center rounded-full mb-5 w-[68px] h-[68px] bg-[#AEC4FF] animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M7 16.5L13 22.5L25 10"
              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="30" strokeDashoffset="0"
              style={{ animation: "drawCheck 0.4s 0.3s ease both" }}
            />
          </svg>
        </div>
        <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">You're all set! 🎉</h2>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Great choice! Your profile is being set up.{" "}
          <span className="Livvic-Bold">
            {selectedPath === 1
              ? "We'll help you find a second family to join your current setup."
              : "We'll start matching you with compatible nanny share families."}
          </span>
        </p>
        <button
          type="button"
          onClick={() => navigate(
            selectedPath === 1
              ? `/caregiver/nanny-share/looking-for-another-family/${recordId}`
              : `/caregiver/nanny-share/looking-for-nanny-share-job/${recordId}`
          )}
          className="w-full block text-center bg-[#AEC4FF] hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3"
        >
          Continue – create my account
        </button>
        <button type="button" onClick={() => setShowMaybeLater(true)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Maybe later
        </button>
      </div>
      <style>{`
        @keyframes popIn    {0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes scaleIn  {0%{transform:scale(0)}100%{transform:scale(1)}}
        @keyframes drawCheck{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────
   Path Options
───────────────────────────────────────── */
const pathOptions = [
  {
    value: 1,
    icon: <Users />,
    title: "I already work with a family and want to add a share",
    description:
      "Add a second family to your current role and earn more through nanny share.",
  },
  {
    value: 2,
    icon: <BriefcaseIcon />,
    title: "I'm looking for a nanny share position",
    description:
      "Get matched with two compatible families and explore nanny share roles.",
  },
];

/* ─────────────────────────────────────────
   Main Form
───────────────────────────────────────── */
const ChooseNannyShare = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPath, setSelectedPath] = useState(null);
  const [recordId, setRecordId] = useState("");
  const [pathError, setPathError] = useState(false);

  const handleGoBack = () => navigate("/");

  const resetFormState = () => {
    form.resetFields();
    setSelectedPath(null);
    setPathError(false);
  };

  const onFinish = async (values) => {
    values.name = fullNameFrom(values);

    if (!selectedPath) { setPathError(true); return; }
    if (!values.name) { fireToastMessage({ type: "error", message: "Please fill out all the fields" }); return; }

    setLoading(true);
    const newRecordId = crypto.randomUUID();

    const data = {
      action: "create",
      Timestamp: new Date().toISOString(),
      Id: newRecordId,
      Name: values.name || "",
      Path: selectedPath === 1 ? "Already works with a family" : "Looking for nanny share position",
      Type: "Nanny share caregiver",
    };

    const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

    if (!scriptUrl) {
      console.warn("VITE_GOOGLE_SCRIPT_URL is not set. Data:", data);
      await new Promise((r) => setTimeout(r, 1400));
      setLoading(false);
      resetFormState();
      setRecordId(newRecordId);
      setShowSuccess(true);
      return;
    }

    try {
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data).toString(),
      });
      setRecordId(newRecordId);
      navigate(
        selectedPath === 1
          ? `/caregiver/nanny-share/looking-for-another-family/${newRecordId}`
          : `/caregiver/nanny-share/looking-for-nanny-share-job/${newRecordId}`
      );
    } catch (error) {
      console.error("Submission error:", error);
      fireToastMessage({ type: "error", message: "Something went wrong. Please try again." });
      setLoading(false);
      return;
    } finally {
      setLoading(false);
      resetFormState();
      setShowSuccess(true);
    }
  };

  const onFinishFailed = () => { if (!selectedPath) setPathError(true); };

  return (
    <>
      <SEOMetaData
        title="Nanny Share for Caregivers | Find a Share Job | FamLink"
        description="Caregivers: find a nanny share job or bring a family into your share. Get matched with local families looking for shared childcare in your area."
        canonical="https://famlink.care/caregiver/nannyshare"
      />
      {loading && <LoadingModal />}

      {!loading && showSuccess && (
        <SuccessModal
          onClose={() => setShowSuccess(false)}
          selectedPath={selectedPath}
          navigate={navigate}
          recordId={recordId}
        />
      )}

      {/* Page wrapper */}
      <div className="min-h-screen bg-gray-50/50 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto relative">
          <div className="px-5 sm:px-8 md:px-10 text-center mb-6">
            <h1 className="text-[28px] sm:text-[32px] font-black text-[#001243] mb-2 leading-tight">
              Hello Caregivers! 👋
            </h1>
            <p className="text-[14px] sm:text-[15px] font-normal text-[#6B7280] mb-6 max-w-md mx-auto">
              Let's get you started so you can find the right nanny share fit for you
            </p>
            <div className="flex items-center justify-center w-fit mx-auto bg-[#EEF2FF] rounded-full px-5 py-2.5 mt-0 border-none">
              <Users className="w-4 h-4 text-[#4F46E5] mr-2" />
              <span className="font-normal text-[#374151] text-[14px]">
                Need to set up a family profile?
              </span>
              <NavLink
                to="/find-nanny-share"
                className="font-bold underline text-[#001243] text-[14px] ml-1 hover:opacity-80 transition-opacity"
              >
                Click Here
              </NavLink>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10">
            <Form
              form={form}
              onFinish={onFinish}
              onFinishFailed={onFinishFailed}
              name="chooseNannyShareForm"
              autoComplete="off"
              layout="vertical"
              className="space-y-4"
            >
              {/* Name */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="w-full">
                  <InputDa type="text" name="firstName" placeholder="Enter your first name" labelText="First Name" />
                </div>
                <div className="w-full">
                  <InputDa type="text" name="lastName" placeholder="Enter your last name" labelText="Last Name" />
                </div>
              </div>
              <hr className="border-gray-100" />

              {/* Path selector */}
              <div>
                <p className="text-base sm:text-lg Livvic-Medium text-primary mb-4">
                  Choose your path <span className="text-red-400">*</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pathOptions.map((opt) => {
                    const isSelected = selectedPath === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => { setSelectedPath(opt.value); setPathError(false); }}
                        className={[
                          "relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200",
                          "hover:shadow-md active:scale-[0.99]",
                          isSelected
                            ? "border-[#AEC4FF] bg-blue-50/40 shadow-sm"
                            : pathError
                              ? "border-red-300 bg-white"
                              : "border-gray-200 bg-white hover:border-[#AEC4FF]/50",
                        ].join(" ")}
                      >
                        {/* Radio circle — top-right corner */}
                        <div
                          className={[
                            "absolute top-3 left-3 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-200",
                            isSelected ? "border-[#AEC4FF]" : "border-gray-300",
                          ].join(" ")}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#AEC4FF]" />
                          )}
                        </div>

                        {/* Icon */}
                        <div className="rounded-full p-4 bg-blue-100 w-fit mx-auto mt-2">
                          {opt.icon}
                        </div>

                        {/* Title */}
                        <h2 className="Livvic-SemiBold text-center text-primary text-sm sm:text-base leading-snug m-0">
                          {opt.title}
                        </h2>

                        {/* Description */}
                        <p className="text-gray-500 text-center text-sm leading-relaxed m-0">
                          {opt.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {pathError && (
                  <p className="text-red-400 text-xs mt-2">Please select a path to continue.</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
                <Button
                  btnText="Go Back"
                  action={handleGoBack}
                  className="w-full sm:w-40 py-3 flex items-center justify-center rounded-full text-base Livvic-Bold text-primary border border-gray-200 hover:bg-gray-50 transition-all"
                />
                <Form.Item className="mb-0 w-full sm:w-auto">
                  <Button
                    btnText="Continue"
                    htmlType="submit"
                    className="w-full sm:w-44 bg-[#AEC4FF] hover:bg-[#9db3f0] py-3 flex items-center justify-center rounded-full text-base Livvic-Bold text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={loading}
                  />
                </Form.Item>
              </div>
            </Form>
          </div>

        </div>
      </div>
    </>
  );
};

export default ChooseNannyShare;