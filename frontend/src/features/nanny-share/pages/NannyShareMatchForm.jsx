import React, { useState } from "react";
import SEOMetaData from "@shared/seo/SEOMetaData";
import { findNannyShareMeta } from "@shared/seo/routeMeta";
import Form from "antd/es/form/Form";
import { useNavigate, NavLink } from "react-router-dom";
import { InputDa } from "@shared/ui/Input";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import FormItem from "antd/es/form/FormItem";
import Button from "@shared/ui/Button";
import { Input, Select } from "antd";
import { fireToastMessage } from "@shared/ui/toast";
import { House, Plus, User2, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { sendQuestionnaireFormEmail } from "@features/nanny-share/store/nannyShareSlice";
import { Spin } from "antd";
import Autocomplete from "react-google-autocomplete";
import { sendWaitlistConfirmation } from "@features/waitlist/waitlistEmail";
import { buildDetails, submitWaitlistEntry, WAITLIST_SOURCE } from "@features/waitlist/waitlistSubmit";
import { ALLOWED_ZIPCODES, resolveZip, zipFromPlace } from "@shared/lib/serviceArea";
import { captureOnboardingLead, ONBOARDING_SOURCE } from "@features/onboarding/onboardingLead";
import { fullNameFrom } from "@shared/lib/formName";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";

/* ─────────────────────────────────────────
   Loading Modal
───────────────────────────────────────── */
const LoadingModal = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
    <div className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4 animate-[popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="mb-5 w-16 h-16">
        <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 animate-spin">
          <circle cx="32" cy="32" r="26" stroke="#FFADE1" strokeWidth="6" strokeOpacity="0.25" />
          <path d="M32 6 a26 26 0 0 1 26 26" stroke="#FFADE1" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">Processing your responses…</h2>
      <p className="text-gray-400 text-sm leading-relaxed">We're searching families near you. Just a moment!</p>
      <div className="flex gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-[#FFADE1] w-2 h-2"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
    <style>{`
      @keyframes popIn { 0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)} }
    `}</style>
  </div>
);

/* ─────────────────────────────────────────
   Maybe Later Modal
───────────────────────────────────────── */
const MaybeLaterModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
    <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="flex items-center justify-center rounded-full mb-5 w-[68px] h-[68px] bg-[#FFADE1]">
        <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none">
          <path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">We'll be in touch! 💌</h2>
      <p className="text-gray-600 text-sm mb-6 leading-relaxed">
        Create a free account to browse compatible families and nanny shares in your area right now.
      </p>
      <NavLink
        to="/joinNow"
        className="w-full block text-center bg-[#FFADE1] hover:bg-[#f99dd5] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3 no-underline"
      >
        Create account to see families now
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
const SuccessModal = ({ onClose, recordId, email, name, sendQuestionnaireEmail }) => {
  const [showMaybeLater, setShowMaybeLater] = useState(false);
  const navigate = useNavigate();

  if (showMaybeLater) return <MaybeLaterModal onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
      <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <div className="flex items-center justify-center rounded-full mb-5 w-[68px] h-[68px] bg-[#FFADE1] animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M7 16.5L13 22.5L25 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset="0" style={{ animation: "drawCheck 0.4s 0.3s ease both" }} />
          </svg>
        </div>
        <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">You're on the list! 🎉</h2>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Thanks for submitting! We'll start looking for compatible nanny-share options in your area and email you within 24 hours.{" "}
          <span className="Livvic-Bold">To accurately match you with a nanny share, answer a few more quick questions now.</span>
        </p>
        <button
          type="button"
          onClick={() => navigate(`/hire?recordId=${recordId || ""}`)}
          className="w-full block text-center bg-[#FFADE1] hover:bg-[#f99dd5] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3"
        >
          Continue – unlock my match
        </button>
        <button type="button" onClick={() => setShowMaybeLater(true)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Maybe later
        </button>
      </div>
      <style>{`
        @keyframes popIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes scaleIn{0%{transform:scale(0)}100%{transform:scale(1)}}
        @keyframes drawCheck{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────
   Waitlist Success Modal
───────────────────────────────────────── */
const WaitlistSuccessModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
    <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="flex items-center justify-center rounded-full mb-5 w-[72px] h-[72px] bg-gradient-to-br from-[#AEC4FF] to-[#AEC4FF] shadow-[0_8px_24px_rgba(174,196,255,0.45)] animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <path d="M8 17.5L14 23.5L26 11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="32" strokeDashoffset="0" style={{ animation: "drawCheck 0.45s 0.35s ease both" }} />
        </svg>
      </div>

      {/* Confetti dots */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full pointer-events-none" aria-hidden="true">
        {[
          { left: "20%", top: "0px", color: "#AEC4FF", size: 7, delay: "0.3s" },
          { left: "35%", top: "-8px", color: "#AEC4FF", size: 5, delay: "0.4s" },
          { left: "50%", top: "-4px", color: "#AEC4FF", size: 6, delay: "0.25s" },
          { left: "65%", top: "-10px", color: "#AEC4FF", size: 5, delay: "0.45s" },
          { left: "78%", top: "0px", color: "#AEC4FF", size: 7, delay: "0.35s" },
        ].map((dot, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: dot.left, top: dot.top,
              width: dot.size, height: dot.size,
              background: dot.color,
              animation: `confettiFall 0.6s ${dot.delay} cubic-bezier(0.22,1,0.36,1) both`,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 bg-blue-50 border border-blue-100">
        <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#AEC4FF]" />
        <span className="text-xs Livvic-SemiBold text-[#AEC4FF]">Coming soon to your area</span>
      </div>

      <h2 className="text-3xl Livvic-Bold text-primary mb-2 leading-snug">
        Famlink is <br /> <span className="text-[#7499ff] Livvic-Bold">expanding near you</span>
      </h2>
      <p className="text-gray-500 text-base Livvic-Medium mb-2 leading-relaxed">
        We're actively expanding into new areas and{" "}
        <span className="text-[#7499ff] Livvic-Medium">you've been added to the waitlist.</span>{" "}
        We'll reach out as soon as Famlink becomes available near you.
      </p>

      <NavLink
        to="/"
        className="w-full block text-center bg-[#AEC4FF] hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3 no-underline"
      >
        Back to Homepage
      </NavLink>
    </div>
    <style>{`
      @keyframes popIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
      @keyframes scaleIn{0%{transform:scale(0)}100%{transform:scale(1)}}
      @keyframes drawCheck{from{stroke-dashoffset:32}to{stroke-dashoffset:0}}
      @keyframes confettiFall{0%{opacity:0;transform:translateY(-12px) scale(0)}60%{opacity:1;transform:translateY(4px) scale(1.2)}100%{opacity:.7;transform:translateY(0px) scale(1)}}
    `}</style>
  </div>
);

/* ─────────────────────────────────────────
   Waitlist Modal
───────────────────────────────────────── */
const WaitlistModal = ({ onClose, email, name, location, locationText, childAges, onSuccess, setModalState, careNeeded, hasNanny }) => {
  const [showMaybeLater, setShowMaybeLater] = useState(false);
  const [submitState, setSubmitState] = useState("idle");

  if (showMaybeLater) return <MaybeLaterModal onClose={onClose} />;
  if (submitState === "success") return <WaitlistSuccessModal onClose={onSuccess} />;

  const handleWaitlistAdd = async () => {
    setSubmitState("loading");

    const details = buildDetails([
      ["Children", childAges],
      ["Care needed", careNeeded],
      ["Already have nanny", hasNanny],
    ]);

    try {
      await submitWaitlistEntry({
        source: WAITLIST_SOURCE.FAMILY_MATCH,
        name,
        email,
        location,
        locationText,
        details,
      });
    } catch (error) {
      console.error("Waitlist submission error:", error);
      fireToastMessage({
        type: "error",
        message: "Couldn't add you to the waitlist. Please try again.",
      });
      setSubmitState("idle");
      return;
    }

    await sendWaitlistConfirmation({ email, name, location, userType: "Parents", details });

    setSubmitState("success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/35">
      <div className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4 animate-[popIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <div className="flex items-center justify-center rounded-full mb-5 w-[72px] h-[72px] bg-blue-50 animate-[scaleIn_0.4s_0.1s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <path d="M10 5 H28 L19 18 L28 31 H10 L19 18 Z" fill="#AEC4FF" fillOpacity="0.18" stroke="#AEC4FF" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 7.5 H26 L19 16 Z" fill="#AEC4FF" fillOpacity="0.7" />
            <path d="M14 28.5 H24 L19 22 Z" fill="#AEC4FF" />
            <line x1="19" y1="17" x2="19" y2="21" stroke="#AEC4FF" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 2" />
            <rect x="9" y="4" width="20" height="2.5" rx="1.25" fill="#AEC4FF" />
            <rect x="9" y="31.5" width="20" height="2.5" rx="1.25" fill="#AEC4FF" />
            <circle cx="30" cy="8" r="1.2" fill="#AEC4FF" fillOpacity="0.6" />
            <circle cx="33" cy="13" r="0.8" fill="#AEC4FF" fillOpacity="0.4" />
            <circle cx="8" cy="30" r="1" fill="#AEC4FF" fillOpacity="0.5" />
          </svg>
        </div>

        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-4 bg-blue-50 border border-blue-100">
          <span className="inline-block rounded-full w-[7px] h-[7px] bg-[#AEC4FF]" />
          <span className="text-xs Livvic-SemiBold text-[#AEC4FF]">Coming soon to your area</span>
        </div>

        <h2 className="text-2xl Livvic-SemiBold text-primary mb-2 leading-snug">Good things take time ⏳</h2>
        <p className="text-gray-500 text-lg mb-6 leading-relaxed">
          We're not quite in your area yet — but we're growing fast.{" "}
          <span className="Livvic-SemiBold text-gray-700">Join the waitlist</span> and we'll reach out{" "}
          <span className="Livvic-SemiBold text-gray-700">the moment we're available near you.</span>
        </p>

        <button
          type="button"
          onClick={handleWaitlistAdd}
          disabled={submitState === "loading"}
          className="w-full flex items-center justify-center gap-2 text-center bg-[#AEC4FF] disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#9db3f0] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3"
        >
          {submitState === "loading" ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="animate-spin shrink-0">
                <circle cx="9" cy="9" r="7" stroke="rgba(0,0,0,0.2)" strokeWidth="2.5" />
                <path d="M9 2 a7 7 0 0 1 7 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Joining waitlist…
            </>
          ) : (
            "Notify me when you're here"
          )}
        </button>

        {submitState !== "loading" && (
          <button
            type="button"
            onClick={() => setModalState("idle")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Maybe later
          </button>
        )}
      </div>
      <style>{`
        @keyframes popIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes scaleIn{0%{transform:scale(0)}100%{transform:scale(1)}}
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────
   Main Form
───────────────────────────────────────── */
const NannyShareMatchForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const [modalState, setModalState] = useState("idle");
  const [location, setLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [hasNanny, setHasNanny] = useState("");
  const [careNeeded, setCareNeeded] = useState("");
  const [resetKey, setResetKey] = useState(0);
  // The place object behind the `location` display text. The waitlist row wants
  // its city and neighborhood as their own columns, which the text has lost.
  const [waitlistPlace, setWaitlistPlace] = useState(null);
  const [waitlistChildAges, setWaitlistChildAges] = useState([]);

  const defaultChild = () => ({ id: Date.now() + Math.random(), age: "", unit: "years" });
  const [children, setChildren] = useState([defaultChild()]);
  const [childrenError, setChildrenError] = useState(false);

  const addChild = () => setChildren((prev) => [...prev, { id: Date.now() + Math.random(), age: "", unit: "years" }]);
  const removeChild = (id) => { if (children.length > 1) setChildren((prev) => prev.filter((c) => c.id !== id)); };
  const updateChild = (id, field, value) => {
    setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    setChildrenError(false);
  };

  const sendQuestionnaireEmail = async (email, name, id) => {
    if (!email || !name || !id) return;
    try {
      await dispatch(sendQuestionnaireFormEmail({ email, name, id }));
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setChildren([defaultChild()]);
    setChildrenError(false);
    setLocation("");
    setResetKey((prev) => prev + 1);
  };

  const onFinish = async (values) => {
    values.name = fullNameFrom(values);

    if (!values.careNeeded || !values.alreadyHaveNanny) {
      fireToastMessage({ type: "error", message: "Please answer all the fields" });
      return;
    }

    if (children.some((c) => c.age === "" || c.age === null)) {
      setChildrenError(true);
      return;
    }

    // Resolving the zip can mean a geocode round-trip, so show the spinner first.
    setModalState("loading");

    const childAges = children.map((c) => `${c.age} ${c.unit}`);

    const zip = await resolveZip(values.location);
    if (!zip || !ALLOWED_ZIPCODES.has(zip)) {
      setEmail(values.email);
      setName(values.name || "");
      setCareNeeded(values.careNeeded);
      setHasNanny(values.alreadyHaveNanny);
      setWaitlistPlace(values.location);
      setWaitlistChildAges(childAges);
      setModalState("waitlist");
      return;
    }

    const newRecordId = crypto.randomUUID();

    const data = {
      action: "create",
      Timestamp: new Date().toISOString(),
      Id: newRecordId,
      Name: values.name || "",
      Email: values.email || "",
      "Already have nanny": values.alreadyHaveNanny || "",
      "Child age(s)": childAges.join(", "),
      "Care needed": values.careNeeded,
      Type: values.careNeeded,
      "Number of children": children.length,
      Location: JSON.stringify(values.location) || "",
      Details: "",
    };

    const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

    if (!scriptUrl) {
      console.warn("VITE_GOOGLE_SCRIPT_URL is not set. Data:", data);
      await new Promise((r) => setTimeout(r, 1400));
      setRecordId(newRecordId);
      setEmail(values.email);
      setName(values.name || "");
      resetForm();
      setModalState("success");
      return;
    }

    try {
      await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data).toString(),
      });

      // Record the half-finished signup server-side. From here they go to the
      // questionnaire and then the account step, and a good share of people
      // never arrive — this is what lets the backend notice a few hours later
      // and send them the "you're one step away" email. Not awaited: it must
      // not delay the navigation, and it swallows its own errors.
      captureOnboardingLead({
        email: values.email,
        name: values.name || "",
        source: ONBOARDING_SOURCE.FAMILY_MATCH,
        sheetId: newRecordId,
        location: values.location,
        details: buildDetails([
          ["Care needed", values.careNeeded],
          ["Already have nanny", values.alreadyHaveNanny],
          ["Number of children", children.length],
          ["Child age(s)", childAges],
        ]),
      });

      setRecordId(newRecordId);
      setEmail(values.email);
      setName(values.name || "");
      resetForm();
      navigate(`family/${newRecordId}`);
    } catch (error) {
      console.error("Submission error:", error);
      fireToastMessage({ type: "error", message: "Something went wrong. Please try again." });
      setModalState("idle");
    }
  };

  const handleZipAutoGeocode = (zipcode) => {
    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;
    setLocationLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: zipcode, componentRestrictions: { country: "US" } }, async (results, status) => {
      if (status === "OK" && results && results.length > 0) {
        try {
          const place = results[0];
          const address = place.formatted_address;
          const components = place?.address_components || [];
          const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "";
          const extractedCity = get("locality") || get("administrative_area_level_2");
          const extractedNeighborhood = get("neighborhood") || get("sublocality_level_1") || get("sublocality") || extractedCity || "";
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const extractedZip = (await zipFromPlace(place)) || zipcode;
          const locationObj = { type: "Point", coordinates: [lng, lat], format_location: address, city: extractedCity, neighborhood: extractedNeighborhood, zip: extractedZip };

          const displayValue = extractedNeighborhood !== extractedCity ? `${extractedCity}, ${extractedNeighborhood}` : extractedCity;
          setLocation(displayValue);
          form.setFieldsValue({ location: locationObj });
          const el = document.getElementById("location-input-nanny");
          if (el) el.value = displayValue;
        } catch (error) {
          setLocationLoading(false);
          fireToastMessage({ type: "error", message: "We couldn't automatically verify that location. Please try typing it out or selecting from the dropdown." });
          form.setFieldsValue({ location: null });
          setLocation("");
          throw error;
        }
      }
      setLocationLoading(false);
    });
  };

  const onFinishFailed = () => {
    if (children.some((c) => c.age === "" || c.age === null)) setChildrenError(true);
  };

  return (
    <>
      <SEOMetaData {...findNannyShareMeta()} />
      {modalState === "loading" && <LoadingModal />}

      {modalState === "success" && (
        <SuccessModal
          onClose={() => setModalState("idle")}
          recordId={recordId}
          email={email}
          name={name}
          sendQuestionnaireEmail={sendQuestionnaireEmail}
        />
      )}

      {modalState === "waitlist" && (
        <WaitlistModal
          onClose={() => setModalState("idle")}
          email={email}
          name={name}
          location={waitlistPlace}
          locationText={location}
          childAges={waitlistChildAges}
          careNeeded={careNeeded}
          setModalState={setModalState}
          hasNanny={hasNanny}
          onSuccess={() => {
            resetForm();
            setModalState("idle");
          }}
        />
      )}

      {/* Page wrapper */}
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 ">
        <div className="max-w-3xl mx-auto relative">

          <div className="px-5 sm:px-8 md:px-10 text-center mb-6">
            <h1 className="text-[28px] sm:text-[32px] font-black text-[#001243] mb-2 leading-tight">
              Hello Parents! 🏠
            </h1>
            <p className="text-[14px] sm:text-[15px] font-normal text-[#6B7280] mb-6 max-w-md mx-auto">
              Let's get you started so you can find the right nanny share fit for your family
            </p>
            <div className="flex items-center justify-center w-fit mx-auto bg-[#EEF2FF] rounded-full px-5 py-2.5 mt-0 border-none">
              <User2 className="w-4 h-4 text-[#4F46E5] mr-2" />
              <span className="font-normal text-[#374151] text-[14px]">
                Need to set up a caregiver profile?
              </span>
              <NavLink
                to="/caregiver/nannyshare"
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
              name="nannyMatchForm"
              autoComplete="off"
              layout="vertical"
              className="space-y-7"
            >
              {/* Name */}
              <div className="flex flex-col sm:flex-row gap-5 w-full">
                <div className="w-full">
                  <InputDa type="text" name="firstName" placeholder="First name" labelText="First Name" />
                </div>
                <div className="w-full">
                  <InputDa type="text" name="lastName" placeholder="Last name" labelText="Last Name" />
                </div>
              </div>

              {/* Email */}
              <InputDa name="email" placeholder="Enter your email" labelText="Email" type="email" required={true} />

              {/* Children's ages */}
              <div>
                <p className="text-base sm:text-lg Livvic-SemiBold text-primary mb-4">
                  Children's ages <span className="text-red-400">*</span>
                </p>
                <div className="flex flex-col gap-3">
                  {children.map((child, index) => (
                    <div key={child.id} className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="Livvic-Medium text-sm text-gray-600 w-16 sm:w-20 shrink-0">
                        Child {index + 1}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Age"
                        value={child.age}
                        onChange={(e) => updateChild(child.id, "age", e.target.value)}
                        status={childrenError && child.age === "" ? "error" : ""}
                        className="!w-20 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      <Select
                        value={child.unit}
                        onChange={(val) => updateChild(child.id, "unit", val)}
                        className="w-28"
                      >
                        <Select.Option value="months">Months Old</Select.Option>
                        <Select.Option value="years">Years Old</Select.Option>
                      </Select>
                      {children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChild(child.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-full text-[#AEC4FF] hover:bg-blue-50 transition-colors"
                          aria-label="Remove child"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {childrenError && (
                  <p className="text-red-400 text-xs mt-2">Please enter an age for each child.</p>
                )}
                <button
                  type="button"
                  onClick={addChild}
                  className="mt-4 flex items-center gap-2 text-primary Livvic-SemiBold text-sm hover:opacity-70 transition-opacity group"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-[#AEC4FF]" />
                  </span>
                  Add another child
                </button>
              </div>

              {/* Already have a nanny */}
              <div>
                <p className="text-base sm:text-lg Livvic-SemiBold text-primary mb-4">
                  Already have a nanny? <span className="text-red-400">*</span>
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={["Yes", "No"]}
                  name="alreadyHaveNanny"
                  resetKey={resetKey}
                  rules={[{ required: true, message: "Please select an option." }]}
                />
              </div>

              {/* Care needed */}
              <div>
                <p className="text-base sm:text-lg Livvic-SemiBold text-primary mb-4">
                  Care Needed <span className="text-red-400">*</span>
                </p>
                <OnboardingOptionSelector
                  form={form}
                  options={SHARE_SCHEDULES}
                  name="careNeeded"
                  resetKey={resetKey}
                  rules={[{ required: true, message: "Please select a care type." }]}
                />
              </div>

              {/* Location */}
              <div>
                <p className="text-base sm:text-lg Livvic-SemiBold text-primary mb-4">
                  Where are you located? <span className="text-red-400">*</span>
                </p>
                <Form.Item
                  name="location"
                  rules={[
                    { required: true, message: "Address is required" },
                    {
                      validator: (_, value) => {
                        if (value && typeof value === 'object' && value.coordinates) {
                          return Promise.resolve();
                        }
                        if (locationLoading) {
                          return Promise.reject(new Error("Please wait for the location to resolve."));
                        }
                        return Promise.reject(new Error("Please enter a valid zip code or select an address."));
                      }
                    }
                  ]}
                  className="mb-0"
                >
                  <Spin spinning={locationLoading} size="small">
                    <Autocomplete
                      id="location-input-nanny"
                      apiKey={import.meta.env.VITE_GOOGLE_KEY}
                      className="w-full sm:w-3/4 md:w-2/3 rounded-xl px-4 py-3 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-gray-400"
                      value={location}
                      onPlaceSelected={async (place) => {
                        if (!place || !place.geometry) return;
                        try {
                          const address = place.formatted_address;
                          const components = place?.address_components || [];
                          const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "";
                          const extractedCity = get("locality") || get("administrative_area_level_2");
                          const extractedNeighborhood = get("neighborhood") || get("sublocality_level_1") || get("sublocality") || extractedCity || "";
                          const lat = place?.geometry?.location?.lat();
                          const lng = place?.geometry?.location?.lng();
                          // City / neighborhood suggestions carry no postal_code — look it up.
                          const extractedZip = await zipFromPlace(place);
                          const locationObj = { type: "Point", coordinates: [lng, lat], format_location: address, city: extractedCity, neighborhood: extractedNeighborhood, zip: extractedZip };
                          
                          const displayValue = extractedNeighborhood !== extractedCity ? `${extractedCity}, ${extractedNeighborhood}` : extractedCity;
                          setLocation(displayValue);
                          form.setFieldsValue({ location: locationObj });
                          const el = document.getElementById("location-input-nanny");
                          if (el) el.value = displayValue;
                          
                          setLocationLoading(false);
                        } catch (error) {
                          setLocationLoading(false);
                          fireToastMessage({ type: "error", message: "We couldn't automatically verify that location. Please try typing it out or selecting from the dropdown." });
                          form.setFieldsValue({ location: null });
                          setLocation("");
                          throw error;
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocation(val);
                        // If they type exactly 5 digits, auto-resolve
                        if (/^\d{5}$/.test(val)) {
                          handleZipAutoGeocode(val);
                        } else {
                          setLocationLoading(false);
                          // Reset form value to a string so the validator catches it
                          form.setFieldsValue({ location: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setTimeout(() => {
                            const el = document.getElementById("location-input-nanny");
                            if (el && el.value !== location) el.value = location;
                          }, 10);
                        }
                      }}
                      onBlur={() => {
                        setLocationLoading(false);
                        setTimeout(() => {
                          const el = document.getElementById("location-input-nanny");
                          if (el && el.value !== location) el.value = location;
                        }, 10);
                      }}
                      options={{ types: ["geocode"], componentRestrictions: { country: "us" } }}
                      placeholder="Enter zipcode"
                    />
                  </Spin>
                </Form.Item>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4">
                <Button
                  btnText="Go Back"
                  action={() => navigate("/")}
                  className="w-full sm:w-40 py-3 flex items-center justify-center rounded-full text-base Livvic-Bold text-primary border border-gray-200 hover:bg-gray-50 transition-all"
                />
                <FormItem className="mb-0 w-full sm:w-auto">
                  <Button
                    btnText="Get Matched"
                    htmlType="submit"
                    className="w-full sm:w-44 bg-[#AEC4FF] py-3 flex items-center justify-center rounded-full text-base Livvic-Bold text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={modalState === "loading"}
                  />
                </FormItem>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
};

export default NannyShareMatchForm;