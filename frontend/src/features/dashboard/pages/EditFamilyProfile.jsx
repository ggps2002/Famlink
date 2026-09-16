import cameraIcons from "@/assets/images/cameraIcon.png";
import { Form, Input, Select, Spin, Checkbox, TimePicker, DatePicker } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { editUserThunk, updateNannyProfileThunk } from "@features/auth/store/authSlice";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import { fireToastMessage } from "@shared/ui/toast";
import Avatar from "react-avatar";
import Autocomplete from "react-google-autocomplete";
import { formatSentence, toCamelCase } from "@shared/lib/toCamelCase";
import { useNavigate, NavLink } from "react-router-dom";
import OptionSelector from "@shared/ui/LanguageSelector";
import CustomButton from "@shared/ui/Button";
import { ChevronLeft, Camera, User as UserIcon, Info, Calendar as CalendarIcon, Clock, Baby, Eye, EyeOff, X, Save } from "lucide-react";
import dayjs from "dayjs";
import { FamilyProfile } from "@features/nanny-share/components/profileCard";
import { zipFromPlace } from "@shared/lib/serviceArea";

const parseTime = (time) => {
  return time ? dayjs(time) : null;
};

const getValidDate = (dateString) => {
  if (!dateString) return null;
  const d = dayjs(dateString);
  return d.isValid() ? d : null;
};

import { useCallback, useEffect, useState } from "react";
import { SHARE_SCHEDULES } from "@shared/lib/scheduleFormat";

export default function EditProfile() {
  const { TextArea } = Input;
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();

  const [nannyProfile, setNannyProfile] = useState(null);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (user?._id) {
      dispatch(fetchNannyByIdThunk(user._id))
        .unwrap()
        .then((res) => {
          setNannyProfile(res?.nannyProfile || {});
        })
        // The form falls back to the auth user's own fields, so a failed fetch
        // leaves it usable rather than empty — nothing to report to the user.
        .catch(() => { });
    }
  }, [user?._id, dispatch]);

  const getAdditionalInfo = useCallback((key) => {
    const keyMap = {
      specificDaysAndTime: "specificDays",
      flexible: "flexibility",
      hosting: "hostingPreference",
      prefferedCommunication: "communicationPreference",
      backupAvailable: "backupCare",
      hourlyRateSplit: "hourlyBudget"
    };
    const profileKey = keyMap[key] || key;

    if (nannyProfile && Object.keys(nannyProfile).length > 0) {
      let val = nannyProfile[profileKey];

      if (Array.isArray(val)) {
        val = val.map(item => {
          if (typeof item === 'string' && (item.startsWith('{') || item.startsWith('['))) {
            try { return JSON.parse(item); } catch (e) { return item; }
          }
          return item;
        }).flat();
      } else if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch (e) { }
      }
      return val;
    }

    return Array.isArray(user?.additionalInfo)
      ? user.additionalInfo.find(info => info.key === key)?.value
      : user?.additionalInfo?.[key];
  }, [nannyProfile, user]);

  const navigate = useNavigate();
  const [form] = Form.useForm();
  const formValues = Form.useWatch([], form);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [selectedChildren, setSelectedChildren] = useState(
    user?.noOfChildren?.length || 0
  );
  const [childrenAges, setChildrenAges] = useState(() => {
    const info = user?.noOfChildren?.info || {};
    const len = user?.noOfChildren?.length || 0;
    return Array.from({ length: len }, (_, i) => info[`Child${i + 1}`] || "");
  });

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const [daysState, setDaysState] = useState(() => {
    return daysOfWeek.reduce((acc, day) => {
      acc[day] = {
        checked: false,
        start: null,
        end: null,
      };
      return acc;
    }, {});
  });

  const deparseHourlyRate = (rateObj) => {
    if (!rateObj) return undefined;
    if (typeof rateObj === 'string') return rateObj;
    const { minShare, maxShare } = rateObj;
    if (minShare === 10 && maxShare === 15) return "$10 - $15 per hour";
    if (minShare === 15 && maxShare === 20) return "$15 - $20 per hour";
    if (minShare === 20 && maxShare === 25) return "$20 - $25 per hour";
    if (minShare === 25 && maxShare === 30) return "$25 - $30 per hour";
    if (minShare === 30 && maxShare === 35) return "$30 - $35 per hour";
    if (minShare === 35 && maxShare === 40) return "$35 - $40 per hour";
    if (minShare === 40 && !maxShare) return "$40+ per hour";
    // Both bounds or nothing. The unguarded template that used to live here
    // wrote "$20 - $undefined per hour" into the DB whenever a profile had a
    // floor but no ceiling, and that string then rendered verbatim on the
    // profile card and the details page.
    if (minShare && maxShare) return `$${minShare} - $${maxShare} per hour`;
    if (minShare || maxShare) return `$${minShare || maxShare}+ per hour`;
    return undefined;
  };

  useEffect(() => {
    if (user || nannyProfile) {
      const shareFields = {
        nannyShareType: getAdditionalInfo("nannyShareType"),
        hasNanny: getAdditionalInfo("hasNanny") === true ? "Yes-we already have a nanny" : getAdditionalInfo("hasNanny") === false ? "No-we are looking for a nanny" : getAdditionalInfo("hasNanny"),
        shareLocation: getAdditionalInfo("shareLocation"),
        specifyNearbyWorkplace: getAdditionalInfo("specifyNearbyWorkplace"),
        flexible: getAdditionalInfo("flexible"),
        nannyshareStart: getValidDate(getAdditionalInfo("nannyshareStart")),
        urgency: getAdditionalInfo("urgency"),
        hosting: getAdditionalInfo("hosting"),
        hourlyRateSplit: deparseHourlyRate(getAdditionalInfo("hourlyRateSplit")),
        prefferedCommunication: getAdditionalInfo("prefferedCommunication"),
        backupAvailable: getAdditionalInfo("backupAvailable"),
        careDescription: getAdditionalInfo("careDescription"),
        openNotes: getAdditionalInfo("openNotes"),
        allergiesHealth: getAdditionalInfo("allergiesHealth"),
        childResponsibilities: getAdditionalInfo("childResponsibilities"),
        householdAddOns: getAdditionalInfo("householdAddOns"),
        parentingStyle: getAdditionalInfo("parentingStyle"),
        houseRules: getAdditionalInfo("houseRules"),
        dailyRoutine: getAdditionalInfo("dailyRoutine"),
        pets: getAdditionalInfo("pets")
      };

      const numChildren = getAdditionalInfo("numberOfChildren") || user?.noOfChildren?.length || 0;
      const ages = getAdditionalInfo("childrenAges");

      if (numChildren) {
        setSelectedChildren(Number(numChildren));
        shareFields.totalChild = Number(numChildren);
      }

      if (ages && Array.isArray(ages) && ages.length > 0) {
        const agesMapped = ages.map(a => typeof a === 'object' ? a.label : String(a));
        setChildrenAges(agesMapped);

        agesMapped.forEach((ageStr, i) => {
          let initialNum = ageStr;
          let initialUnit = "years";
          if (typeof ageStr === "string") {
            if (ageStr.includes("month") || ageStr.includes("mo")) {
              initialNum = ageStr.replace(/[^0-9]/g, '');
              initialUnit = "months";
            } else {
              initialNum = ageStr.replace(/[^0-9]/g, '');
            }
          }
          shareFields[`Child${i + 1}`] = initialNum;
          shareFields[`ChildUnit${i + 1}`] = initialUnit;
        });
      } else if (user?.noOfChildren?.info) {
        const info = user.noOfChildren.info;
        const len = Number(numChildren);
        const mappedAges = Array.from({ length: len }, (_, i) => info[`Child${i + 1}`] || "");
        setChildrenAges(mappedAges);

        mappedAges.forEach((ageStr, i) => {
          let initialNum = String(ageStr);
          let initialUnit = "years";
          if (typeof ageStr === "string" && (ageStr.includes("month") || ageStr.includes("mo"))) {
            initialNum = ageStr.replace(/[^0-9]/g, '');
            initialUnit = "months";
          } else if (typeof ageStr === "string") {
            initialNum = ageStr.replace(/[^0-9]/g, '');
          }
          shareFields[`Child${i + 1}`] = initialNum;
          shareFields[`ChildUnit${i + 1}`] = initialUnit;
        });
      }

      form.setFieldsValue(shareFields);

      const specificDaysAndTime = getAdditionalInfo("specificDaysAndTime");
      if (specificDaysAndTime) {
        setDaysState(daysOfWeek.reduce((acc, day) => {
          const specificDay = specificDaysAndTime?.[day];
          acc[day] = {
            checked: !!specificDay?.checked,
            start: specificDay?.start || null,
            end: specificDay?.end || null,
          };
          return acc;
        }, {}));
      }
    }
  }, [user, nannyProfile, form, getAdditionalInfo]);

  const handleCheckboxChange = useCallback((day) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        checked: !prevState[day].checked,
      },
    }));
  }, []);

  const handleTimeChange = (day, field, time) => {
    setDaysState((prevState) => ({
      ...prevState,
      [day]: {
        ...prevState[day],
        [field]: time ? time.toISOString() : null,
      },
    }));
  };

  const [image, setImage] = useState(user?.imageUrl);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (user) {
      const addr = user?.location?.format_location || "";
      setLocation(addr);
      setZipCode(user?.zipCode || "");
      if (user?.location) {
        setCoordinates(
          user?.location
        );
      }
    }
  }, [user, form]);

  const handleImageChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const imageUrl = URL.createObjectURL(selectedFile);
      setImage(imageUrl);
      setFile(selectedFile);
    }
  };

  const handleChildrenChange = (value) => {
    setSelectedChildren(value);
    setChildrenAges((prevAges) => {
      const updatedAges = [...prevAges];
      if (value > updatedAges.length) {
        return [...updatedAges, ...Array(value - updatedAges.length).fill("")];
      } else {
        return updatedAges.slice(0, value);
      }
    });
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      if (coordinates) {
        formData.append("location", JSON.stringify(coordinates));
      }

      // Never send an empty zip: the backend would overwrite the stored one,
      // and the dashboard falls back to it when a user has no coordinates.
      const finalZipCode = values.zipCode || zipCode || user?.zipCode;
      if (finalZipCode) {
        formData.append("zipCode", finalZipCode);
      }
      if (values.fullName) formData.append("name", values.fullName);
      if (values.email) formData.append("email", values.email);
      if (values.age) formData.append("age", values.age);
      if (values.gender) formData.append("gender", values.gender);
      if (values.description) formData.append("aboutMe", values.description);
      if (file) formData.append("imageUrl", file);

      const childrenInfo = {};
      for (let i = 1; i <= selectedChildren; i++) {
        const ageKey = `Child${i}`;
        if (values[ageKey]) {
          childrenInfo[ageKey] = values[ageKey];
        }
      }

      const noOfChildren = {
        length: Object.keys(childrenInfo).length,
        info: childrenInfo,
      };
      formData.append("noOfChildren", JSON.stringify(noOfChildren));

      // Handle Schedule
      const checkedDays = Object.entries(daysState)
        .filter(([_, data]) => data.checked === true)
        .reduce((acc, [day, data]) => {
          acc[day] = {
            checked: true,
            start: data.start ? parseTime(data.start).toISOString() : null,
            end: data.end ? parseTime(data.end).toISOString() : null,
          };
          return acc;
        }, {});

      const nannyShareFields = [
        "nannyShareType", "hasNanny", "shareLocation", "specifyNearbyWorkplace",
        "careDescription", "flexible", "nannyshareStart", "urgency", "hosting",
        "hourlyRateSplit", "prefferedCommunication", "backupAvailable", "openNotes",
        "allergiesHealth", "childResponsibilities", "householdAddOns",
        "parentingStyle", "houseRules", "dailyRoutine", "pets"
      ];

      if (values.services?.length > 0) {
        const camelCaseServices = values.services.map((s) =>
          typeof s === "string" ? toCamelCase(s) : s
        );
        formData.append("services", JSON.stringify(camelCaseServices));
      }

      // --- Family Profile Specific Data for backend schema ---
      const keyMap = {
        flexible: "flexibility",
        hosting: "hostingPreference",
        prefferedCommunication: "communicationPreference",
        backupAvailable: "backupCare",
        hourlyRateSplit: "hourlyBudget"
      };

      const familyFormData = new FormData();
      nannyShareFields.forEach(field => {
        const val = values[field] !== undefined && values[field] !== null ? values[field] : "";
        const backendKey = keyMap[field] || field;
        if (field === "hasNanny") {
          const boolValue = val === "Yes-we already have a nanny" ? true : val === true ? true : false;
          familyFormData.append(backendKey, boolValue);
        } else if (Array.isArray(val)) {
          familyFormData.append(backendKey, JSON.stringify(val));
        } else if (field === "nannyshareStart" && val && typeof val.toISOString === "function") {
          familyFormData.append(backendKey, val.toISOString());
        } else {
          familyFormData.append(backendKey, val);
        }
      });
      familyFormData.append("specificDays", JSON.stringify(checkedDays));
      familyFormData.append("specificDaysAndTime", JSON.stringify(checkedDays));

      const numChildren = values.totalChild || selectedChildren;
      familyFormData.append("numberOfChildren", numChildren);

      const agesArray = [];
      for (let i = 1; i <= numChildren; i++) {
        if (values[`Child${i}`]) {
          const unit = values[`ChildUnit${i}`] || "years";
          const numValue = Number(values[`Child${i}`]);
          agesArray.push({
            label: `${numValue} ${unit}`,
            value: unit === "months" ? parseFloat((numValue / 12).toFixed(4)) : numValue,
            unit: unit
          });
        }
      }
      if (agesArray.length > 0) {
        familyFormData.append("childrenAges", JSON.stringify(agesArray));
      }

      if (file) familyFormData.append("imageFile", file);

      await dispatch(updateNannyProfileThunk(familyFormData)).unwrap();
      await dispatch(editUserThunk(formData)).unwrap();

      fireToastMessage({
        success: true,
        message: "Profile updated successfully!",
      });

      // Small delay to let the toast be seen before navigating
      setTimeout(() => {
        navigate("/dashboard");
      }, 600);
    } catch (error) {
      console.error("Update Error:", error);
      fireToastMessage({
        type: "error",
        message: error?.message || "Failed to update profile. Please check your information.",
      });
    } finally {
      setLoading(false);
    }
  };


  const options5 = [
    "Nanny",
    "Private Educator",
    "Swim Instructor",
    "Specialized Caregiver",
    "Sports Coaches",
    "Music Instructor",
    "House Manager",
  ];
  const formattedServiceLabels = user?.services?.map((s) => formatSentence(s)) || [];

  return (
    <div className="min-h-screen pb-24 bg-gray-50/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <NavLink to="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#001243]" />
            </NavLink>
            <div className="flex flex-col">
              <h1 className="Livvic-Bold text-xl md:text-2xl text-[#001243]">Edit Profile</h1>
              <p className="text-gray-500 text-sm md:text-base Livvic-Medium mt-1">Keep your family information up to date</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard">
              <button className="hidden md:flex items-center gap-2 px-6 py-2 rounded-full border border-gray-200 text-gray-500 Livvic-SemiBold hover:bg-gray-50 transition-all cursor-pointer bg-transparent">
                <X className="w-4 h-4" /> Discard
              </button>
            </NavLink>
            <button
              onClick={() => form.submit()}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2 rounded-full bg-[#AEC4FF] text-[#001243] Livvic-SemiBold shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer border-none"
            >
              {loading ? <Spin size="small" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 mt-4 md:mt-8 mb-12">
        <Form
          id="editProfileForm"
          onFinish={onFinish}
          autoComplete="off"
          form={form}
          layout="vertical"
        >
          <div className="flex flex-col xl:flex-row gap-6 mb-8 items-stretch">
            {/* Profile Photo */}
            <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100 w-full xl:w-[320px] shrink-0 text-center flex flex-col justify-center">
              <h3 className="text-lg Livvic-Bold text-[#001243] mb-6">Profile Photo</h3>

              <div className="relative w-32 h-32 md:w-48 md:h-48 mx-auto">
                {image ? (
                  <img
                    src={image}
                    alt="Profile"
                    className="rounded-[32px] w-full h-full object-cover shadow-md transition-transform"
                  />
                ) : (
                  <div className="flex justify-center items-center w-full h-full">
                    <Avatar
                      name={user?.name}
                      size="100%"
                      round="32px"
                      color="#AEC4FF"
                      fgColor="#001243"
                      className="shadow-md Livvic-Bold"
                    />
                  </div>
                )}

                <label className="absolute -bottom-2 -right-2 bg-white p-2.5 md:p-3 rounded-2xl shadow-xl cursor-pointer hover:bg-gray-50 border border-gray-100 transition-all active:scale-95 flex items-center justify-center z-10">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageChange}
                  />
                  <Camera size={window.innerWidth < 768 ? 20 : 24} className="text-[#AEC4FF]" />
                </label>
              </div>

              <p className="text-gray-400 text-xs md:text-sm Livvic-Medium mt-6 md:mt-8 leading-relaxed px-2 md:px-4">
                Upload a clear photo of your family. This helps nannies feel more connected to you.
              </p>
            </section>

            {/* Live Preview Section */}
            <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100 flex-1 flex flex-col min-w-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="Livvic-Bold text-lg text-[#001243] flex items-center gap-2">
                    {showPreview ? (
                      <Eye className="w-5 h-5 text-[#001243] cursor-pointer hover:text-[#AEC4FF] transition-colors" onClick={() => setShowPreview(false)} />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => setShowPreview(true)} />
                    )}
                    Live Preview
                  </h2>
                  <p className="text-gray-400 text-sm Livvic-Medium mt-1">This is how nannies will see your profile.</p>
                </div>
              </div>

              <div className="relative flex-1 w-full mt-2">
                <div className={`w-full pointer-events-none ${showPreview ? "block" : "invisible"}`}>
                  <FamilyProfile
                    name={formValues?.fullName || user?.name}
                    userId={user?._id}
                    id={user?._id}
                    sharedRate={formValues?.hourlyRateSplit || deparseHourlyRate(nannyProfile?.hourlyBudget) || "N/A"}
                    ages={childrenAges}
                    childrenCount={selectedChildren || nannyProfile?.numberOfChildren}
                    hasNanny={formValues?.hasNanny === "Yes-we already have a nanny" ? true : formValues?.hasNanny === "No-we are looking for a nanny" ? false : nannyProfile?.hasNanny}
                    img={image || user?.image}
                    careType={formValues?.nannyShareType || nannyProfile?.nannyShareType}
                    schedule={daysState}
                    location={{ format_location: location || user?.location?.format_location }}
                    hosting={formValues?.hosting || nannyProfile?.hostingPreference}
                    start={formValues?.nannyshareStart || nannyProfile?.nannyshareStart}
                    shareLocation={formValues?.shareLocation || nannyProfile?.shareLocation}
                  />
                </div>
                {!showPreview && (
                  <div className="absolute inset-0 w-full h-full bg-[#f8f9fb] rounded-xl flex items-center justify-center border border-gray-100 p-4 text-gray-400 Livvic-Medium">
                    Preview is hidden. Click the eye icon to view.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Form Fields - Main Column */}
          <div className="space-y-8 w-full">

            {/* Card 1: Basic Information */}
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl Livvic-Bold text-[#001243] mb-6 flex items-center gap-2">
                <UserIcon size={20} className="text-[#AEC4FF]" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Full Name</span>}
                  name="fullName"
                  initialValue={user?.name}
                >
                  <Input
                    className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium focus:border-[#AEC4FF] focus:ring-0"
                    placeholder="Enter your full name"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Email Address</span>}
                  name="email"
                  initialValue={user?.email}
                >
                  <Input
                    type="email"
                    className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium focus:border-[#AEC4FF] focus:ring-0"
                    placeholder="Enter your email address"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Address</span>}
                  name="location"
                  initialValue={user?.location?.format_location}
                  rules={[{ required: true, message: "Address is required" }]}
                >
                  <Autocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_KEY}
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      padding: "0.75rem",
                      border: "1px solid #D6DDEB",
                    }}
                    value={location || ""}
                    onPlaceSelected={async (place) => {
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

                      const locationObj = {
                        type: "Point",
                        coordinates: [lng, lat],
                        format_location: address,
                        city: extractedCity,
                        neighborhood: extractedNeighborhood,
                      };
                      const displayValue = extractedNeighborhood !== extractedCity ? `${extractedCity}, ${extractedNeighborhood}` : extractedCity;
                      setLocation(displayValue)
                      setCoordinates(locationObj);
                      form.setFieldsValue({
                        location: displayValue,
                      });

                      // Move the zip with the address, or it keeps pointing at where the
                      // user used to live. Google omits postal_code from city-level picks.
                      const placeZip = await zipFromPlace(place);
                      if (placeZip) {
                        setZipCode(placeZip);
                        form.setFieldsValue({ zipCode: placeZip });
                      }
                      setLoading(false);
                    }}
                    onChange={(e) => {
                      setLocation(e.target.value);
                    }}
                    options={{
                      types: ["geocode"],
                      componentRestrictions: { country: "us" },
                    }}
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Zip Code</span>}
                  name="zipCode"
                  initialValue={user?.zipCode || zipCode}
                >
                  <Input
                    className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium focus:border-[#AEC4FF] focus:ring-0"
                    placeholder="Enter zip code"
                    onChange={(e) => setZipCode(e.target.value)}
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Gender</span>}
                  name="gender"
                  initialValue={user?.gender}
                >
                  <Select
                    className="w-full h-[50px] Livvic-Medium"
                    placeholder="Select gender"
                  >
                    <Select.Option value="Male">Male</Select.Option>
                    <Select.Option value="Female">Female</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Age</span>}
                  name="age"
                  initialValue={user?.age}
                >
                  <Input
                    type="number"
                    className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium focus:border-[#AEC4FF]"
                    placeholder="Enter your age"
                  />
                </Form.Item>
              </div>
            </div>

            {/* Card 2: Children Details */}
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl Livvic-Bold text-[#001243] mb-6 flex items-center gap-2">
                <Baby size={20} className="text-[#AEC4FF]" />
                Children Details
              </h3>

              <Form.Item
                label={<span className="Livvic-SemiBold text-gray-500">Number of Children</span>}
                name="totalChild"
                initialValue={selectedChildren}
              >
                <Select
                  onChange={handleChildrenChange}
                  className="w-full h-[50px] Livvic-Medium"
                  placeholder="How many children?"
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <Select.Option key={num} value={num}>{num}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {childrenAges.map((age, index) => {
                  let initialNum = age;
                  let initialUnit = "years";
                  if (typeof age === "string") {
                    if (age.includes("month") || age.includes("mo")) {
                      initialNum = age.replace(/[^0-9]/g, '');
                      initialUnit = "months";
                    } else {
                      initialNum = age.replace(/[^0-9]/g, '');
                    }
                  }

                  return (
                    <Form.Item
                      key={index}
                      label={<span className="Livvic-SemiBold text-gray-500">Age of Child {index + 1}</span>}
                      className="mb-0"
                    >
                      <div className="flex gap-2">
                        <Form.Item
                          name={`Child${index + 1}`}
                          initialValue={initialNum}
                          className="mb-0 flex-1"
                        >
                          <Input
                            type="number"
                            className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium"
                            placeholder="Age"
                          />
                        </Form.Item>
                        <Form.Item
                          name={`ChildUnit${index + 1}`}
                          initialValue={initialUnit}
                          className="mb-0"
                        >
                          <Select className="h-[48px] min-w-[100px] rounded-xl Livvic-Medium">
                            <Select.Option value="years">Years</Select.Option>
                            <Select.Option value="months">Months</Select.Option>
                          </Select>
                        </Form.Item>
                      </div>
                    </Form.Item>
                  );
                })}
              </div>
            </div>

            {/* Card 3: About Your Family */}
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl Livvic-Bold text-[#001243] mb-6 flex items-center gap-2">
                <Info size={20} className="text-[#AEC4FF]" />
                About Your Family
              </h3>
              <Form.Item
                name="description"
                initialValue={user?.aboutMe}
              >
                <TextArea
                  rows={6}
                  className="rounded-2xl border-gray-200 p-4 Livvic-Medium focus:border-[#AEC4FF] resize-none"
                  placeholder="Tell nannies about your family, your values, and what you're looking for..."
                />
              </Form.Item>
            </div>

            {/* Card: Nanny Share Preferences */}
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl Livvic-Bold text-[#001243] mb-6 flex items-center gap-2">
                <Info size={20} className="text-[#AEC4FF]" />
                Nanny Share Preferences
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Type of Nanny Share</span>} name="nannyShareType" initialValue={getAdditionalInfo("nannyShareType")}>
                  {/* Two options, in the one spelling every surface stores.
                      "Full-time care" here and "Full-time" in the caregiver
                      questionnaire described the same share and read as two. */}
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select type">
                    {SHARE_SCHEDULES.map((schedule) => (
                      <Select.Option key={schedule} value={schedule}>{schedule}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Already have a nanny?</span>} name="hasNanny" initialValue={getAdditionalInfo("hasNanny") === true ? "Yes-we already have a nanny" : getAdditionalInfo("hasNanny") === false ? "No-we are looking for a nanny" : getAdditionalInfo("hasNanny")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select option">
                    <Select.Option value="Yes-we already have a nanny">Yes-we already have a nanny</Select.Option>
                    <Select.Option value="No-we are looking for a nanny">No-we are looking for a nanny</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Location preference</span>} name="shareLocation" initialValue={getAdditionalInfo("shareLocation")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select locations">
                    <Select.Option value="Near our home / in our neighborhood">Near our home / in our neighborhood</Select.Option>
                    <Select.Option value="Nearby neighborhoods within ~10–15 minutes">Nearby neighborhoods within ~10–15 minutes</Select.Option>
                    <Select.Option value="Anywhere in City that’s reasonably close">Anywhere in City that’s reasonably close</Select.Option>
                    <Select.Option value="Near my workplace">Near my workplace</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Work location (if near workplace)</span>} name="specifyNearbyWorkplace" initialValue={getAdditionalInfo("specifyNearbyWorkplace")}>
                  <Input className="rounded-xl border-gray-200 py-3 px-4 Livvic-Medium" placeholder="Enter work location" />
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Scheduling Flexibility</span>} name="flexible" initialValue={getAdditionalInfo("flexible")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select flexibility">
                    <Select.Option value="Very flexible">Very flexible</Select.Option>
                    <Select.Option value="Somewhat flexible">Somewhat flexible</Select.Option>
                    <Select.Option value="Not flexible">Not flexible</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Start Date</span>} name="nannyshareStart" initialValue={getValidDate(getAdditionalInfo("nannyshareStart"))}>
                  <DatePicker className="w-full h-[50px] rounded-xl border-gray-200 Livvic-Medium" format="MMMM D, YYYY" />
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Search Urgency</span>} name="urgency" initialValue={getAdditionalInfo("urgency")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select urgency">
                    <Select.Option value="Urgent – I need care soon">Urgent – I need care soon</Select.Option>
                    <Select.Option value="Actively looking">Actively looking</Select.Option>
                    <Select.Option value="Just exploring">Just exploring</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Hosting Preference</span>} name="hosting" initialValue={getAdditionalInfo("hosting")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select hosting">
                    <Select.Option value="My home">My home</Select.Option>
                    <Select.Option value="Other family’s home">Other family’s home</Select.Option>
                    <Select.Option value="Rotating between homes">Rotating between homes</Select.Option>
                    <Select.Option value="Neutral location (e.g., school pickup spot)">Neutral location</Select.Option>
                  </Select>
                </Form.Item>

                {/* A family states one rate: their own share. The options here
                    carry no "(Each family pays …)" clause, which is exactly how
                    the shared parser reads them — the range IS the split. */}
                <Form.Item
                  label={<span className="Livvic-SemiBold text-gray-500">Our Hourly Share</span>}
                  extra={<span className="Livvic-Medium text-gray-400 text-xs">What your family pays per hour. In a share the caregiver's rate is split between both families.</span>}
                  name="hourlyRateSplit"
                  initialValue={getAdditionalInfo("hourlyRateSplit")}
                >
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select budget">
                    <Select.Option value="$10 - $15 per hour">$10 - $15 per hour</Select.Option>
                    <Select.Option value="$15 - $20 per hour">$15 - $20 per hour</Select.Option>
                    <Select.Option value="$20 - $25 per hour">$20 - $25 per hour</Select.Option>
                    <Select.Option value="$25 - $30 per hour">$25 - $30 per hour</Select.Option>
                    <Select.Option value="$30 - $35 per hour">$30 - $35 per hour</Select.Option>
                    <Select.Option value="$35 - $40 per hour">$35 - $40 per hour</Select.Option>
                    <Select.Option value="$40+ per hour">$40+ per hour</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Preferred Communication</span>} name="prefferedCommunication" initialValue={getAdditionalInfo("prefferedCommunication")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select communication">
                    <Select.Option value="Group chat">Group chat</Select.Option>
                    <Select.Option value="Shared calendar">Shared calendar</Select.Option>
                    <Select.Option value="Email updates">Email updates</Select.Option>
                    <Select.Option value="Phone calls">Phone calls</Select.Option>
                    <Select.Option value="Regular in-person meetings">Regular in-person meetings</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Backup Care</span>} name="backupAvailable" initialValue={getAdditionalInfo("backupAvailable")}>
                  <Select className="w-full h-[50px] Livvic-Medium" placeholder="Select backup">
                    <Select.Option value="Family members">Family members</Select.Option>
                    <Select.Option value="Backup nanny service">Backup nanny service</Select.Option>
                    <Select.Option value="Friends or neighbors">Friends or neighbors</Select.Option>
                    <Select.Option value="Local daycare">Local daycare</Select.Option>
                    <Select.Option value="No backup options">No backup options</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Allergies & Health</span>} name="allergiesHealth" initialValue={getAdditionalInfo("allergiesHealth")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select allergies">
                    <Select.Option value="food allergies">Food allergies</Select.Option>
                    <Select.Option value="environmental allergies">Environmental allergies</Select.Option>
                    <Select.Option value="asthma">Asthma</Select.Option>
                    <Select.Option value="medication needs">Medication needs</Select.Option>
                    <Select.Option value="none">None</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Child Responsibilities</span>} name="childResponsibilities" initialValue={getAdditionalInfo("childResponsibilities")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select responsibilities">
                    <Select.Option value="transportation">Transportation</Select.Option>
                    <Select.Option value="educational activities">Educational activities</Select.Option>
                    <Select.Option value="outdoor play">Outdoor play</Select.Option>
                    <Select.Option value="storytime / reading">Storytime / reading</Select.Option>
                    <Select.Option value="meal/snack prep for kids">Meal/snack prep for kids</Select.Option>
                    <Select.Option value="homework help">Homework help</Select.Option>
                    <Select.Option value="nap/bedtime support">Nap/bedtime support</Select.Option>
                    <Select.Option value="not applicable">Not applicable</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Household Add-ons</span>} name="householdAddOns" initialValue={getAdditionalInfo("householdAddOns")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select household tasks">
                    <Select.Option value="light housekeeping">Light housekeeping</Select.Option>
                    <Select.Option value="grocery shopping">Grocery shopping</Select.Option>
                    <Select.Option value="errands">Errands</Select.Option>
                    <Select.Option value="meal preparation for family">Meal preparation for family</Select.Option>
                    <Select.Option value="not applicable">Not applicable</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Parenting Style</span>} name="parentingStyle" initialValue={getAdditionalInfo("parentingStyle")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select style">
                    <Select.Option value="montessori">Montessori</Select.Option>
                    <Select.Option value="attachment parenting">Attachment parenting</Select.Option>
                    <Select.Option value="rie">RIE</Select.Option>
                    <Select.Option value="authoritative">Authoritative</Select.Option>
                    <Select.Option value="permissive">Permissive</Select.Option>
                    <Select.Option value="strict">Strict</Select.Option>
                    <Select.Option value="flexible">Flexible</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">House Rules</span>} name="houseRules" initialValue={getAdditionalInfo("houseRules")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select rules">
                    <Select.Option value="screen time limits">Screen time limits</Select.Option>
                    <Select.Option value="dietary restrictions">Dietary restrictions</Select.Option>
                    <Select.Option value="behavior expectations">Behavior expectations</Select.Option>
                    <Select.Option value="hygiene practices">Hygiene practices</Select.Option>
                    <Select.Option value="chore responsibilities">Chore responsibilities</Select.Option>
                    <Select.Option value="seatbelts always">Seatbelts always</Select.Option>
                    <Select.Option value="no food in car">No food in car</Select.Option>
                    <Select.Option value="screen use in car">Screen use in car</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Daily Routine</span>} name="dailyRoutine" initialValue={getAdditionalInfo("dailyRoutine")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select routines">
                    <Select.Option value="nap times">Nap times</Select.Option>
                    <Select.Option value="outdoor play">Outdoor play</Select.Option>
                    <Select.Option value="educational activities">Educational activities</Select.Option>
                    <Select.Option value="structured meal times">Structured meal times</Select.Option>
                    <Select.Option value="storytime">Storytime</Select.Option>
                    <Select.Option value="arts & crafts">Arts & crafts</Select.Option>
                    <Select.Option value="playdates/outings">Playdates/outings</Select.Option>
                    <Select.Option value="not applicable">Not applicable</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Pets</span>} name="pets" initialValue={getAdditionalInfo("pets")}>
                  <Select mode="multiple" className="w-full h-[50px] Livvic-Medium" placeholder="Select pets">
                    <Select.Option value="no pets">No pets</Select.Option>
                    <Select.Option value="dog(s)">Dog(s)</Select.Option>
                    <Select.Option value="cat(s)">Cat(s)</Select.Option>
                    <Select.Option value="small animals">Small animals</Select.Option>
                    <Select.Option value="birds">Birds</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>
              </div>

              <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Care Description</span>} name="careDescription" initialValue={getAdditionalInfo("careDescription")} className="mt-4">
                <TextArea rows={4} className="rounded-2xl border-gray-200 p-4 Livvic-Medium" placeholder="Describe the type of care you're looking for..." />
              </Form.Item>

              <Form.Item label={<span className="Livvic-SemiBold text-gray-500">Additional Notes</span>} name="openNotes" initialValue={getAdditionalInfo("openNotes")}>
                <TextArea rows={4} className="rounded-2xl border-gray-200 p-4 Livvic-Medium" placeholder="Anything else another family should know?" />
              </Form.Item>
            </div>

            {/* Card 4: Weekly Schedule */}
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl Livvic-Bold text-[#001243] mb-6 flex items-center gap-2">
                <CalendarIcon size={20} className="text-[#AEC4FF]" />
                Weekly Schedule
              </h3>

              <div className="space-y-4">
                {daysOfWeek.map((day) => (
                  <div key={day} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border transition-all ${daysState[day].checked ? 'border-[#AEC4FF] bg-[#FFF8FA]' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <Checkbox
                        checked={daysState[day].checked}
                        onChange={() => handleCheckboxChange(day)}
                        className="scale-110"
                      />
                      <span className={`Livvic-Bold text-lg ${daysState[day].checked ? 'text-[#001243]' : 'text-gray-400'}`}>
                        {day}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <TimePicker
                        value={daysState[day].start ? parseTime(daysState[day].start) : null}
                        placeholder="Start Time"
                        onChange={(time) => handleTimeChange(day, "start", time)}
                        disabled={!daysState[day].checked}
                        format="h:mm A"
                        className="rounded-xl border-gray-200 py-2 Livvic-Medium w-32"
                        suffixIcon={<Clock size={14} />}
                      />
                      <span className="text-gray-300">to</span>
                      <TimePicker
                        value={daysState[day].end ? parseTime(daysState[day].end) : null}
                        placeholder="End Time"
                        onChange={(time) => handleTimeChange(day, "end", time)}
                        disabled={!daysState[day].checked}
                        format="h:mm A"
                        className="rounded-xl border-gray-200 py-2 Livvic-Medium w-32"
                        suffixIcon={<Clock size={14} />}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
