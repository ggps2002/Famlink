import React, { useState } from "react";
import SEOMetaData from "@shared/seo/SEOMetaData";
import Form from "antd/es/form/Form";
import FormItem from "antd/es/form/FormItem";
import { Input, Select } from "antd";
import { Plus, X } from "lucide-react";
import AutocompleteModule from "react-google-autocomplete";

// The package is CommonJS: depending on the bundler's interop the default
// import is the component or `{ default: component }`. Rendering the object is
// React error #130, which is what crashed this page.
const Autocomplete = AutocompleteModule.default ?? AutocompleteModule;
import { Spin } from "antd";
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import CustomButton from "@shared/ui/Button";
import { InputDa } from "@shared/ui/Input";
import { useSearchParams } from "react-router-dom";
import { sendWaitlistConfirmation } from "@features/waitlist/waitlistEmail";
import { buildDetails, submitWaitlistEntry, WAITLIST_SOURCE } from "@features/waitlist/waitlistSubmit";
import { fireToastMessage } from "@shared/ui/toast";
import { fullNameFrom } from "@shared/lib/formName";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";

/* ─────────────────────────────────────────
   Loading Modal
───────────────────────────────────────── */
const LoadingModal = () => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }}
    >
        <div
            className="relative bg-white rounded-3xl shadow-2xl px-10 py-10 flex flex-col items-center text-center max-w-xs w-full mx-4"
            style={{ animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
            <div className="mb-5" style={{ width: 64, height: 64 }}>
                <svg viewBox="0 0 64 64" fill="none" style={{ animation: "spin 1s linear infinite", width: 64, height: 64 }}>
                    <circle cx="32" cy="32" r="26" stroke="#aec4ff" strokeWidth="6" strokeOpacity="0.25" />
                    <path d="M32 6 a26 26 0 0 1 26 26" stroke="#aec4ff" strokeWidth="6" strokeLinecap="round" />
                </svg>
            </div>
            <h2 className="text-xl Livvic-Bold text-gray-900 mb-1">Adding you to the list…</h2>
            <p className="text-gray-400 text-sm leading-relaxed">Saving your spot on the waitlist!</p>
            <div className="flex gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="block rounded-full bg-[#aec4ff]"
                        style={{ width: 8, height: 8, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
                    />
                ))}
            </div>
        </div>
        <style>{`
      @keyframes popIn  { 0% { opacity:0; transform:scale(0.85); } 100% { opacity:1; transform:scale(1); } }
      @keyframes spin   { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      @keyframes bounce { 0%,80%,100% { transform:translateY(0); opacity:0.4; } 40% { transform:translateY(-6px); opacity:1; } }
    `}</style>
    </div>
);

/* ─────────────────────────────────────────
   Success Modal
───────────────────────────────────────── */
const WaitlistSuccessModal = ({ onClose }) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.35)" }}
    >
        <div
            className="relative bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center text-center max-w-sm w-full mx-4"
            style={{ animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
            {/* Confetti dots */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full pointer-events-none" aria-hidden="true">
                {[
                    { left: "18%", color: "#aec4ff", size: 7, delay: "0.3s" },
                    { left: "33%", color: "#aec4ff", size: 5, delay: "0.4s" },
                    { left: "50%", color: "#aec4ff", size: 6, delay: "0.25s" },
                    { left: "66%", color: "#aec4ff", size: 5, delay: "0.45s" },
                    { left: "80%", color: "#aec4ff", size: 7, delay: "0.35s" },
                ].map((dot, i) => (
                    <span
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            left: dot.left, top: 0,
                            width: dot.size, height: dot.size,
                            background: dot.color,
                            animation: `confettiFall 0.6s ${dot.delay} cubic-bezier(0.22,1,0.36,1) both`,
                        }}
                    />
                ))}
            </div>

            {/* Check icon */}
            <div
                className="flex items-center justify-center rounded-full mb-5"
                style={{
                    width: 72, height: 72,
                    background: "linear-gradient(135deg,#aec4ff 0%,#aec4ff 100%)",
                    boxShadow: "0 8px 24px rgba(255,173,225,0.45)",
                    animation: "scaleIn 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
            >
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <path
                        d="M8 17.5L14 23.5L26 11"
                        stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        style={{ strokeDasharray: 32, strokeDashoffset: 0, animation: "drawCheck 0.45s 0.35s ease both" }}
                    />
                </svg>
            </div>

            <h2 className="text-2xl Livvic-Bold text-gray-900 mb-2 leading-snug">You're on the list! 🎊</h2>
            <p className="text-gray-500 text-sm mb-2 leading-relaxed">
                We’ll notify you when nanny share becomes available near you.
                <span className="Livvic-SemiBold text-gray-700">first to know.</span>
            </p>
            <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                Keep an eye on your inbox — we'll reach out as soon as we're live near you.
            </p>

            <CustomButton
                type="button"
                onClick={onClose}
                className="w-full block text-center bg-[#aec4ff] hover:bg-[#aec4ff] transition-colors rounded-full py-3 text-base Livvic-Bold text-black mb-3 px-0"
            >
                Done
            </CustomButton>
        </div>
        <style>{`
      @keyframes popIn       { 0% { opacity:0; transform:scale(0.85); } 100% { opacity:1; transform:scale(1); } }
      @keyframes scaleIn     { 0% { transform:scale(0); } 100% { transform:scale(1); } }
      @keyframes drawCheck   { from { stroke-dashoffset:32; } to { stroke-dashoffset:0; } }
      @keyframes confettiFall {
        0%   { opacity:0; transform:translateY(-12px) scale(0); }
        60%  { opacity:1; transform:translateY(4px) scale(1.2); }
        100% { opacity:0.7; transform:translateY(0) scale(1); }
      }
    `}</style>
    </div>
);

/* ─────────────────────────────────────────
   Standalone Waitlist Form
───────────────────────────────────────── */
const WaitlistForm = () => {
    const [form] = Form.useForm();
    const [resetKey, setResetKey] = useState(0);
    const [modalState, setModalState] = useState("idle"); // "idle" | "loading" | "success"
    const [searchParams] = useSearchParams();
    const city = searchParams.get("city");

    const [location, setLocation] = useState(city);
    const [locationLoading, setLocationLoading] = useState(false);

    // Children state (same pattern as NannyShareMatchForm)
    const defaultChild = () => ({ id: Date.now() + Math.random(), age: "", unit: "years" });
    const [children, setChildren] = useState([defaultChild()]);
    const [childrenError, setChildrenError] = useState(false);


    const addChild = () => setChildren((prev) => [...prev, defaultChild()]);
    const removeChild = (id) => { if (children.length > 1) setChildren((prev) => prev.filter((c) => c.id !== id)); };
    const updateChild = (id, field, value) => {
        setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
        setChildrenError(false);
    };

    const resetForm = () => {
        form.resetFields();
        setChildren([defaultChild()]);
        setChildrenError(false);
        setLocation("");
        setResetKey((k) => k + 1);
    };
    const onFinish = async (values) => {
        // Validate children
        if (children.some((c) => !c.age)) {
            setChildrenError(true);
            return;
        }

        setModalState("loading");

        const childrenAges = children.map((c) => `${c.age} ${c.unit}`);

        // The place object is the good source; `location` is the text in the box,
        // used when someone typed an address the autocomplete never resolved.
        const locationText =
            typeof values.location === "object"
                ? values.location.format_location || location
                : location || "";

        // Built once and sent to both the sheet and our own waitlist record,
        // so the two can't drift apart.
        const details = buildDetails([["Children", childrenAges]]);
        const fullName = fullNameFrom(values);

        try {
            await submitWaitlistEntry({
                source: WAITLIST_SOURCE.WAITLIST_PAGE,
                name: fullName,
                email: values.email,
                location: values.location,
                locationText,
                details,
            });
        } catch (error) {
            console.error("Waitlist error:", error);
            fireToastMessage({
                type: "error",
                message: "Couldn't add you to the waitlist. Please try again.",
            });
            setModalState("idle");
            return;
        }

        await sendWaitlistConfirmation({
            email: values.email,
            name: values.name,
            city: (typeof values.location === "object" && values.location.city) || city,
            location: values.location || locationText,
            userType: "Parents",
            details,
        });

        resetForm();
        setModalState("success");
    };

    const onFinishFailed = () => {
        if (children.some((c) => !c.age)) setChildrenError(true);
    };

    return (
        <>
            <SEOMetaData
                title="Join the FamLink Waitlist | Nanny Share Near You"
                description="Join the FamLink waitlist to be the first to know when nanny share matches become available in your neighborhood."
                canonical="https://famlink.care/waitlist"
            />
            {modalState === "loading" && <LoadingModal />}
            {modalState === "success" && (
                <WaitlistSuccessModal onClose={() => setModalState("idle")} />
            )}

            <div className="mb-6 container mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-primary Livvic-Bold text-center text-2xl sm:text-2xl md:text-3xl lg:text-4xl px-4 mb-2 leading-tight">
                    Join the Waitlist
                </p>
                <p className="text-center text-gray-400 text-sm mb-6">
                    We're growing fast — be first to know when we're in your area.
                </p>

                <div className="flex justify-center mt-4 py-4">
                    <Form
                        form={form}
                        onFinish={onFinish}
                        onFinishFailed={onFinishFailed}
                        name="waitlistForm"
                        autoComplete="off"
                        layout="vertical"
                        className="w-full max-w-2xl space-y-6 bg-white/5 p-6 rounded-2xl"
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

                        {/* Email */}
                        <InputDa name="email" placeholder="Enter your email" labelText="Email" type="email" required={true} />

                        {/* Children's ages */}
                        {/* <div>
              <p className="text-lg Livvic-SemiBold text-primary mb-4">
                Children's ages <span className="text-red-400">*</span>
              </p>
              <div className="flex flex-col gap-3">
                {children.map((child, index) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <span className="text-primary Livvic-Medium w-20 shrink-0">Child {index + 1}</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Age"
                      value={child.age}
                      onChange={(e) => updateChild(child.id, "age", e.target.value)}
                      status={childrenError && !child.age ? "error" : ""}
                      style={{ width: 80 }}
                    />
                    <Select
                      value={child.unit}
                      onChange={(val) => updateChild(child.id, "unit", val)}
                      style={{ width: 100 }}
                    >
                      <Select.Option value="months">Months</Select.Option>
                      <Select.Option value="years">Years</Select.Option>
                    </Select>
                    {children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChild(child.id)}
                        className="text-red-400 hover:text-red-600 leading-none"
                        aria-label="Remove child"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {childrenError && (
                <p className="text-red-400 text-xs mt-2">Please enter an age for each child.</p>
              )}
              <CustomButton
                type="button"
                onClick={addChild}
                className="mt-4 flex items-center gap-2 text-primary Livvic-SemiBold hover:opacity-70 transition-opacity px-0 py-0 rounded-none"
              >
                <span className="text-2xl leading-none"><Plus size={18} /></span>
                <span className="text-sm">Add another child</span>
              </CustomButton>
            </div> */}

                        {/* Already have a nanny */}
                        {/* <div>
                            <p className="text-lg Livvic-SemiBold text-primary mb-4">
                                Already have a nanny? <span className="text-red-400">*</span>
                            </p>
                            <OnboardingOptionSelector
                                form={form}
                                options={["Yes", "No"]}
                                name="alreadyHaveNanny"
                                resetKey={resetKey}
                                rules={[{ required: true, message: "Please select an option." }]}
                            />
                        </div> */}

                        {/* Care needed */}
                        {/* <div>
                            <p className="text-lg Livvic-SemiBold text-primary mb-4">
                                Care Needed <span className="text-red-400">*</span>
                            </p>
                            <OnboardingOptionSelector
                                form={form}
                                options={SHARE_SCHEDULES}
                                name="careNeeded"
                                resetKey={resetKey}
                                rules={[{ required: true, message: "Please select a care type." }]}
                            />
                        </div> */}

                        {/* Location */}
                        {/* <div>
              <p className="text-lg Livvic-SemiBold text-primary mb-4">
                Where are you located? <span className="text-red-400">*</span>
              </p>
              <div className="relative">
                <FormItem
                  name="location"
                  rules={[{ required: true, message: "Address is required" }]}
                >
                  <Spin spinning={locationLoading} size="small">
                    <Autocomplete
                      apiKey={import.meta.env.VITE_GOOGLE_KEY}
                      className="fl-field w-full md:w-[55%]"
                      value={location}
                      onPlaceSelected={(place) => {
                        const address = place.formatted_address;
                        const components = place?.address_components || [];
                        const get = (type) =>
                          components.find((c) => c.types.includes(type))?.long_name || "";
                        const extractedCity = get("locality") || get("administrative_area_level_2");
                        const extractedNeighborhood =
                          get("neighborhood") || get("sublocality_level_1") || get("sublocality") || extractedCity || "";
                        const lat = place?.geometry?.location?.lat();
                        const lng = place?.geometry?.location?.lng();
                        const locationObj = {
                          type: "Point",
                          coordinates: [lng, lat],
                          format_location: address,
                          city: extractedCity,
                          neighborhood: extractedNeighborhood,
                        };
                        setLocation(
                          extractedNeighborhood !== extractedCity
                            ? `${extractedCity}, ${extractedNeighborhood}`
                            : extractedCity
                        );
                        form.setFieldsValue({ location: locationObj });
                        setLocationLoading(false);
                      }}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setLocationLoading(e.target.value.length > 0);
                      }}
                      onBlur={() => setLocationLoading(false)}
                      options={{ types: ["geocode"], componentRestrictions: { country: "us" } }}
                    />
                  </Spin>
                </FormItem>
              </div>
            </div> */}
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
                            <CustomButton
                                type="button"
                                onClick={addChild}
                                className="mt-4 flex items-center gap-2 text-primary Livvic-SemiBold text-sm hover:opacity-70 transition-opacity group px-0 py-0 rounded-none"
                            >
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 transition-colors">
                                    <Plus className="w-3.5 h-3.5 text-[#AEC4FF]" />
                                </span>
                                Add another child
                            </CustomButton>
                        </div>
                        {/* Location */}
                        <div>
                            <p className="text-base sm:text-lg Livvic-SemiBold text-primary mb-4">
                                Where are you located? <span className="text-red-400">*</span>
                            </p>
                            <Form.Item name="location" rules={[{ required: true, message: "Address is required" }]} className="mb-0">
                                <Spin spinning={locationLoading} size="small">
                                    <Autocomplete
                                        apiKey={import.meta.env.VITE_GOOGLE_KEY}
                                        className="fl-field w-full sm:w-3/4 md:w-2/3"
                                        value={location}
                                        onPlaceSelected={async (place) => {
                                            const address = place.formatted_address;
                                            const components = place?.address_components || [];
                                            const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "";
                                            const extractedCity = get("locality") || get("administrative_area_level_2");
                                            const extractedNeighborhood = get("neighborhood") || get("sublocality_level_1") || get("sublocality") || extractedCity || "";
                                            const lat = place?.geometry?.location?.lat();
                                            const lng = place?.geometry?.location?.lng();
                                            const locationObj = { type: "Point", coordinates: [lng, lat], format_location: address, city: extractedCity, neighborhood: extractedNeighborhood };
                                            setLocation(extractedNeighborhood !== extractedCity ? `${extractedCity}, ${extractedNeighborhood}` : extractedCity);
                                            form.setFieldsValue({ location: locationObj });
                                            setLocationLoading(false);
                                        }}
                                        onChange={(e) => {
                                            setLocation(e.target.value);
                                            setLocationLoading(e.target.value.length > 0);
                                        }}
                                        onBlur={() => setLocationLoading(false)}
                                        options={{ types: ["geocode"], componentRestrictions: { country: "us" } }}
                                        placeholder="Enter zipcode"
                                    />
                                </Spin>
                            </Form.Item>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-center pt-6 w-full max-w-lg mx-auto">
                            <FormItem className="mb-0 w-full sm:w-auto">
                                <CustomButton
                                    btnText="Join Waitlist"
                                    htmlType="submit"
                                    disabled={modalState === "loading"}
                                    className="bg-[#aec4ff] hover:bg-[#aec4ff] w-full px-10 py-3 sm:py-4 flex items-center justify-center rounded-full text-lg Livvic-Bold text-black transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                />
                            </FormItem>
                        </div>
                    </Form>
                </div>
            </div>
        </>
    );
};

export default WaitlistForm;