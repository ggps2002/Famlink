import React, { useEffect, useState } from "react";
import { Form, Spin, Input } from "antd";
import AutocompleteModule from "react-google-autocomplete";

// The package is CommonJS: depending on the bundler's interop the default
// import is the component or `{ default: component }`. Rendering the object is
// React error #130, which is what crashed this page.
const Autocomplete = AutocompleteModule.default ?? AutocompleteModule;
import OnboardingOptionSelector from "@features/onboarding/components/OnboardingOptionSelector";
import { NavLink } from "react-router-dom";
import { Users } from "lucide-react";
import { zipFromPlace } from "@shared/lib/serviceArea";
import { fireToastMessage } from "@shared/ui/toast";

import { CARE_EXPERIENCE, TRAVEL_DISTANCE } from "@shared/lib/profileOptions";
const step1Data = {
    experience: CARE_EXPERIENCE,
    // A share is one or the other — see SHARE_SCHEDULES in shared/lib/scheduleFormat.js.
    schedule: ["Full-time", "Part-time"],
    distance: TRAVEL_DISTANCE,
};

function Screen1({ formRef }) {
    const [form] = Form.useForm();
    const [location, setLocation] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (formRef) formRef.current = form;
    }, [formRef, form]);

    const handleZipAutoGeocode = (zipcode) => {
        if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;
        setLoading(true);
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
                    const el = document.getElementById("location-input-job");
                    if (el) el.value = displayValue;
                } catch (error) {
                    setLoading(false);
                    fireToastMessage({ type: "error", message: "We couldn't automatically verify that location. Please try typing it out or selecting from the dropdown." });
                    form.setFieldsValue({ location: null });
                    setLocation("");
                    throw error;
                }
            }
            setLoading(false);
        });
    };

    return (
        <div className="relative px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto relative">
                <div className='flex md:flex-row flex-col-reverse justify-between items-start'>
                    {/* Header */}
                    <div className="mb-4">
                        <p className="text-primary Livvic-Bold text-4xl mb-2">
                            Tell us about your experience
                        </p>
                        <p className="text-gray-500 Livvic-Medium text-base sm:text-lg max-w-md mb-2">
                            Answer a few quick questions so we can connect you with compatible families near you.
                        </p>
                    </div>
                    {/* Banner — stacks on mobile, floats right on lg+ */}
                    <div className="flex justify-center mb-6 ">
                        <div className="shadow-soft rounded-2xl bg-white py-4 px-6 w-fit">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 shrink-0">
                                    <Users className="w-5 h-5 text-[#AEC4FF]" />
                                </div>
                                <div>
                                    <p className="Livvic-SemiBold text-sm text-gray-700 leading-tight"> Need to set up a family profile?</p>
                                    <NavLink
                                        to="/find-nanny-share"
                                        className="text-[#AEC4FF] Livvic-Medium text-sm hover:opacity-80 transition-opacity no-underline"
                                    >
                                        Click Here
                                    </NavLink>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Form form={form} name="validateOnly" autoComplete="off">
                    <div className="mx-auto max-w-3xl">

                        <p className="text-lg Livvic-SemiBold text-primary mb-4">
                            How many years of childcare experience?
                        </p>
                        <OnboardingOptionSelector
                            form={form}
                            options={step1Data.experience}
                            name="experience"
                        />

                        <p className="text-lg Livvic-SemiBold text-primary mt-6 mb-4">
                            What schedule are you looking for?
                        </p>
                        <OnboardingOptionSelector
                            form={form}
                            options={step1Data.schedule}
                            name="nannyShareType"
                        />

                        <p className="text-lg Livvic-SemiBold text-primary mt-6 mb-4">
                            Where are you based?
                        </p>
                        <div className="relative">
                            <Form.Item
                                name="location"
                                rules={[
                                    { required: true, message: "Address is required" },
                                    {
                                        validator: (_, value) => {
                                            if (value && typeof value === 'object' && value.coordinates) {
                                                return Promise.resolve();
                                            }
                                            if (loading) {
                                                return Promise.reject(new Error("Please wait for the location to resolve."));
                                            }
                                            return Promise.reject(new Error("Please enter a valid zip code or select an address."));
                                        }
                                    }
                                ]}
                            >
                                <Spin spinning={loading} size="small">
                                    <Autocomplete
                                        id="location-input-job"
                                        apiKey={import.meta.env.VITE_GOOGLE_KEY}
                                        className="fl-field w-full md:w-[55%]"
                                        value={location}
                                        onPlaceSelected={async (place) => {
                                            if (!place || !place.geometry) return;
                                            try {
                                                const address = place.formatted_address;
                                                const components = place?.address_components || [];

                                                const get = (type) =>
                                                    components.find((c) => c.types.includes(type))?.long_name || "";

                                                const extractedCity =
                                                    get("locality") || get("administrative_area_level_2");

                                                const extractedNeighborhood =
                                                    get("neighborhood") ||
                                                    get("sublocality_level_1") ||
                                                    get("sublocality");

                                                const lat = place?.geometry?.location?.lat();
                                                const lng = place?.geometry?.location?.lng();

                                                // City / neighborhood suggestions carry no postal_code — look it
                                                // up, otherwise the service-area check waitlists a valid caregiver.
                                                const zip = await zipFromPlace(place);

                                                const locationObj = {
                                                    type: "Point",
                                                    coordinates: [lng, lat],
                                                    format_location: address,
                                                    city: extractedCity,
                                                    neighborhood: extractedNeighborhood,
                                                    zip,
                                                };
                                                
                                                const displayValue = extractedNeighborhood !== extractedCity ? `${extractedCity}, ${extractedNeighborhood}` : extractedCity;
                                                setLocation(displayValue);
                                                form.setFieldsValue({
                                                    location: locationObj,
                                                });
                                                const el = document.getElementById("location-input-job");
                                                if (el) el.value = displayValue;

                                                setLoading(false);
                                            } catch (error) {
                                                setLoading(false);
                                                fireToastMessage({ type: "error", message: "We couldn't automatically verify that location. Please try typing it out or selecting from the dropdown." });
                                                form.setFieldsValue({ location: null });
                                                setLocation("");
                                                throw error;
                                            }
                                        }}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocation(val);
                                            if (/^\d{5}$/.test(val)) {
                                                handleZipAutoGeocode(val);
                                            } else {
                                                setLoading(false);
                                                form.setFieldsValue({ location: val });
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setTimeout(() => {
                                                    const el = document.getElementById("location-input-job");
                                                    if (el && el.value !== location) el.value = location;
                                                }, 10);
                                            }
                                        }}
                                        onBlur={() => {
                                            setLoading(false);
                                            setTimeout(() => {
                                                const el = document.getElementById("location-input-job");
                                                if (el && el.value !== location) el.value = location;
                                            }, 10);
                                        }}
                                        options={{
                                            types: ["geocode"],
                                            componentRestrictions: { country: "us" },
                                        }}
                                    />
                                </Spin>
                            </Form.Item>
                        </div>

                        <p className="text-lg Livvic-SemiBold text-primary mb-4">
                            How far are you willing to travel?
                        </p>
                        <OnboardingOptionSelector
                            form={form}
                            options={step1Data.distance}
                            name="distance"
                        />

                    </div>
                </Form>
            </div>
        </div>
    );
}

export default Screen1;