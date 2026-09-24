import { Form, Input, Select, DatePicker } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { editUserThunk, updateNannyProfileThunk } from "@features/auth/store/authSlice";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import { fireToastMessage } from "@shared/ui/toast";
import AutocompleteModule from "react-google-autocomplete";
import { formatSentence, toCamelCase } from "@shared/lib/toCamelCase";
import { useNavigate } from "react-router-dom";
import {
  EditProfileLayout,
  EditSection,
  PreviewToggle,
  ProfileIdentity,
  WeeklySchedule,
} from "@features/dashboard/components/EditProfileLayout";
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
import {
  ALLERGIES_HEALTH,
  BACKUP_CARE,
  CHILD_HELP,
  COMMUNICATION,
  DAILY_ROUTINE,
  FLEXIBILITY,
  HOUSE_RULES,
  HOUSEHOLD_TASKS,
  NOT_APPLICABLE,
  PARENTING_STYLE,
  PETS,
  URGENCY,
  normalizeAnswer,
  readList,
  toSelectOptions,
} from "@shared/lib/profileOptions";

export default function EditProfile() {
  const Autocomplete = AutocompleteModule.default;
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
        flexible: normalizeAnswer(getAdditionalInfo("flexible")),
        nannyshareStart: getValidDate(getAdditionalInfo("nannyshareStart")),
        urgency: normalizeAnswer(getAdditionalInfo("urgency")),
        hosting: getAdditionalInfo("hosting"),
        hourlyRateSplit: deparseHourlyRate(getAdditionalInfo("hourlyRateSplit")),
        prefferedCommunication: normalizeAnswer(getAdditionalInfo("prefferedCommunication")),
        backupAvailable: normalizeAnswer(getAdditionalInfo("backupAvailable")),
        careDescription: getAdditionalInfo("careDescription"),
        openNotes: getAdditionalInfo("openNotes"),
        allergiesHealth: normalizeAnswer(readList(getAdditionalInfo("allergiesHealth"))),
        childResponsibilities: normalizeAnswer(readList(getAdditionalInfo("childResponsibilities"))),
        householdAddOns: normalizeAnswer(readList(getAdditionalInfo("householdAddOns"))),
        parentingStyle: normalizeAnswer(readList(getAdditionalInfo("parentingStyle"))),
        houseRules: normalizeAnswer(readList(getAdditionalInfo("houseRules"))),
        dailyRoutine: normalizeAnswer(readList(getAdditionalInfo("dailyRoutine"))),
        pets: normalizeAnswer(readList(getAdditionalInfo("pets"))),
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

  const sections = [
    { id: "preview", label: "Card preview" },
    { id: "basics", label: "Basic information" },
    { id: "children", label: "Children" },
    { id: "about", label: "About your family" },
    { id: "share", label: "Share preferences" },
    { id: "home", label: "Home & routine" },
    { id: "schedule", label: "Weekly schedule" },
  ];

  return (
    <EditProfileLayout
      title="Edit profile"
      subtitle="Caregivers and other families see this when they browse."
      backTo="/dashboard"
      onDiscard={() => navigate("/dashboard")}
      onSave={() => form.submit()}
      saving={loading}
      viewProfileHref={`/dashboard/family-profile-view/${user?._id}`}
      sections={sections}
      identity={
        <ProfileIdentity
          image={image}
          name={formValues?.fullName || user?.name}
          location={location || user?.location?.format_location}
          onImageChange={handleImageChange}
          hint="A clear family photo helps caregivers feel connected to you."
        />
      }
    >
      <Form
        id="editProfileForm"
        onFinish={onFinish}
        autoComplete="off"
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        <EditSection
          id="preview"
          stacked
          title="Card preview"
          description="How your card looks in search results. It updates as you type."
          action={<PreviewToggle shown={showPreview} onToggle={() => setShowPreview((v) => !v)} />}
        >
          {showPreview && (
            <div className="pointer-events-none rounded-2xl bg-[#F7F9FA] p-3 md:p-4" aria-hidden="true">
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
          )}
        </EditSection>

        <EditSection id="basics" title="Basic information" description="Your email stays private. Others see your name and area.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
            <Form.Item label="Full name" name="fullName" initialValue={user?.name}>
              <Input placeholder="Enter your full name" />
            </Form.Item>

            <Form.Item label="Email address" name="email" initialValue={user?.email}>
              <Input type="email" placeholder="Enter your email address" />
            </Form.Item>

            <Form.Item
              label="Address"
              name="location"
              initialValue={user?.location?.format_location}
              rules={[{ required: true, message: "Add your address so nearby families can find you." }]}
            >
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_KEY}
                className="fl-field w-full"
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

            <Form.Item label="Zip code" name="zipCode" initialValue={user?.zipCode || zipCode}>
              <Input placeholder="Enter zip code" onChange={(e) => setZipCode(e.target.value)} />
            </Form.Item>

            <Form.Item label="Gender" name="gender" initialValue={user?.gender}>
              <Select placeholder="Select gender">
                <Select.Option value="Male">Male</Select.Option>
                <Select.Option value="Female">Female</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Age" name="age" initialValue={user?.age}>
              <Input type="number" placeholder="Enter your age" />
            </Form.Item>
          </div>
        </EditSection>

        <EditSection id="children" title="Children" description="Ages help caregivers and families judge whether a share fits.">
          <Form.Item label="Number of children" name="totalChild" initialValue={selectedChildren} className="md:max-w-[240px]">
            <Select onChange={handleChildrenChange} placeholder="How many children?">
              {[1, 2, 3, 4, 5].map((num) => (
                <Select.Option key={num} value={num}>{num}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {childrenAges.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
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
                  <Form.Item key={index} label={`Child ${index + 1}`}>
                    <div className="flex gap-2">
                      <Form.Item name={`Child${index + 1}`} initialValue={initialNum} noStyle>
                        <Input type="number" placeholder="Age" className="flex-1" />
                      </Form.Item>
                      <Form.Item name={`ChildUnit${index + 1}`} initialValue={initialUnit} noStyle>
                        <Select className="!w-[112px] shrink-0">
                          <Select.Option value="years">Years</Select.Option>
                          <Select.Option value="months">Months</Select.Option>
                        </Select>
                      </Form.Item>
                    </div>
                  </Form.Item>
                );
              })}
            </div>
          )}
        </EditSection>

        <EditSection id="about" title="About your family" description="Your values and what you're looking for. This is the first thing people read.">
          <Form.Item name="description" initialValue={user?.aboutMe} className="mb-0">
            <TextArea
              rows={16}
              showCount
              className="Livvic-Medium"
              placeholder="Tell caregivers about your family, your values, and what you're looking for…"
            />
          </Form.Item>
        </EditSection>

        <EditSection id="share" title="Share preferences" description="The kind of share you want, where, and when.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
            <Form.Item label="Type of nanny share" name="nannyShareType" initialValue={getAdditionalInfo("nannyShareType")}>
              {/* Two options, in the one spelling every surface stores.
                  "Full-time care" here and "Full-time" in the caregiver
                  questionnaire described the same share and read as two. */}
              <Select placeholder="Select type">
                {SHARE_SCHEDULES.map((schedule) => (
                  <Select.Option key={schedule} value={schedule}>{schedule}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="Already have a nanny?" name="hasNanny" initialValue={getAdditionalInfo("hasNanny") === true ? "Yes-we already have a nanny" : getAdditionalInfo("hasNanny") === false ? "No-we are looking for a nanny" : getAdditionalInfo("hasNanny")}>
              <Select placeholder="Select an option">
                <Select.Option value="Yes-we already have a nanny">Yes, we already have a nanny</Select.Option>
                <Select.Option value="No-we are looking for a nanny">No, we’re looking for a nanny</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Where the share could be" name="shareLocation" initialValue={getAdditionalInfo("shareLocation")}>
              <Select mode="multiple" placeholder="Select locations">
                <Select.Option value="Near our home / in our neighborhood">Near our home / in our neighborhood</Select.Option>
                <Select.Option value="Nearby neighborhoods within ~10–15 minutes">Nearby neighborhoods within ~10–15 minutes</Select.Option>
                <Select.Option value="Anywhere in City that’s reasonably close">Anywhere in City that’s reasonably close</Select.Option>
                <Select.Option value="Near my workplace">Near my workplace</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Workplace area (if near work)" name="specifyNearbyWorkplace" initialValue={getAdditionalInfo("specifyNearbyWorkplace")}>
              <Input placeholder="e.g. Downtown" />
            </Form.Item>

            <Form.Item label="Scheduling flexibility" name="flexible" initialValue={normalizeAnswer(getAdditionalInfo("flexible"))}>
                  <Select placeholder="Select flexibility" options={toSelectOptions(FLEXIBILITY)} />
            </Form.Item>

            <Form.Item label="Start date" name="nannyshareStart" initialValue={getValidDate(getAdditionalInfo("nannyshareStart"))}>
              <DatePicker className="w-full" format="MMMM D, YYYY" />
            </Form.Item>

            <Form.Item label="How soon you need care" name="urgency" initialValue={normalizeAnswer(getAdditionalInfo("urgency"))}>
                  <Select placeholder="Select urgency" options={toSelectOptions(URGENCY)} />
            </Form.Item>

            <Form.Item label="Hosting preference" name="hosting" initialValue={getAdditionalInfo("hosting")}>
              <Select placeholder="Select hosting">
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
              label="Our hourly share"
              extra={<span className="Livvic-Medium text-gray-400 text-xs">What your family pays per hour. The caregiver’s rate is split between both families.</span>}
              name="hourlyRateSplit"
              initialValue={getAdditionalInfo("hourlyRateSplit")}
            >
              <Select placeholder="Select budget">
                <Select.Option value="$10 - $15 per hour">$10 - $15 per hour</Select.Option>
                <Select.Option value="$15 - $20 per hour">$15 - $20 per hour</Select.Option>
                <Select.Option value="$20 - $25 per hour">$20 - $25 per hour</Select.Option>
                <Select.Option value="$25 - $30 per hour">$25 - $30 per hour</Select.Option>
                <Select.Option value="$30 - $35 per hour">$30 - $35 per hour</Select.Option>
                <Select.Option value="$35 - $40 per hour">$35 - $40 per hour</Select.Option>
                <Select.Option value="$40+ per hour">$40+ per hour</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Preferred communication" name="prefferedCommunication" initialValue={normalizeAnswer(getAdditionalInfo("prefferedCommunication"))}>
                  <Select placeholder="Select communication" options={toSelectOptions(COMMUNICATION)} />
            </Form.Item>

            <Form.Item label="Backup care" name="backupAvailable" initialValue={normalizeAnswer(getAdditionalInfo("backupAvailable"))}>
                  <Select placeholder="Select backup" options={toSelectOptions(BACKUP_CARE)} />
            </Form.Item>
          </div>

          <Form.Item label="The care you're looking for" name="careDescription" initialValue={getAdditionalInfo("careDescription")}>
            <TextArea rows={4} className="Livvic-Medium" placeholder="Describe the type of care you're looking for…" />
          </Form.Item>
        </EditSection>

        <EditSection id="home" title="Home & routine" description="Day-to-day details a caregiver needs to know.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
            <Form.Item label="Allergies & health" name="allergiesHealth" initialValue={normalizeAnswer(readList(getAdditionalInfo("allergiesHealth")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions(ALLERGIES_HEALTH)} />
            </Form.Item>

            <Form.Item label="Childcare responsibilities" name="childResponsibilities" initialValue={normalizeAnswer(readList(getAdditionalInfo("childResponsibilities")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions([...CHILD_HELP, NOT_APPLICABLE])} />
            </Form.Item>

            <Form.Item label="Household help" name="householdAddOns" initialValue={normalizeAnswer(readList(getAdditionalInfo("householdAddOns")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions([...HOUSEHOLD_TASKS, NOT_APPLICABLE])} />
            </Form.Item>

            <Form.Item label="Parenting style" name="parentingStyle" initialValue={normalizeAnswer(readList(getAdditionalInfo("parentingStyle")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions(PARENTING_STYLE)} />
            </Form.Item>

            <Form.Item label="House rules" name="houseRules" initialValue={normalizeAnswer(readList(getAdditionalInfo("houseRules")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions(HOUSE_RULES)} />
            </Form.Item>

            <Form.Item label="Daily routine" name="dailyRoutine" initialValue={normalizeAnswer(readList(getAdditionalInfo("dailyRoutine")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions([...DAILY_ROUTINE, NOT_APPLICABLE])} />
            </Form.Item>

            <Form.Item label="Pets" name="pets" initialValue={normalizeAnswer(readList(getAdditionalInfo("pets")))}>
                  <Select mode="multiple" placeholder="Select all that apply" options={toSelectOptions(PETS)} />
            </Form.Item>
          </div>

          <Form.Item label="Anything else to know" name="openNotes" initialValue={getAdditionalInfo("openNotes")}>
            <TextArea rows={4} className="Livvic-Medium" placeholder="Anything else another family should know?" />
          </Form.Item>
        </EditSection>

        <EditSection id="schedule" title="Weekly schedule" description="Tick the days you need care and set the hours.">
          <WeeklySchedule
            days={daysOfWeek}
            state={daysState}
            onToggle={handleCheckboxChange}
            onTimeChange={handleTimeChange}
          />
        </EditSection>
      </Form>
    </EditProfileLayout>
  );
}
