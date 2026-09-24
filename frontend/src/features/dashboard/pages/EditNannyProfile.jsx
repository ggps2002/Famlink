import { useCallback, useEffect, useState, useMemo } from "react";
import { Form, Input, Select, DatePicker } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { fireToastMessage } from "@shared/ui/toast";
import { editUserThunk, updateNannyProfileThunk } from "@features/auth/store/authSlice";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import AutocompleteModule from "react-google-autocomplete";
import OptionSelector from "@shared/ui/LanguageSelector";
import {
  AGE_GROUPS,
  CARE_EXPERIENCE,
  CERTIFICATIONS,
  CHILD_HELP,
  HOUSEHOLD_TASKS,
  LANGUAGES,
  NOT_APPLICABLE,
  normalizeAnswer,
  readList,
  toSelectOptions,
} from "@shared/lib/profileOptions";
import dayjs from "dayjs";
const getValidDate = (dateString) => {
  if (!dateString) return null;
  const cleanDate = typeof dateString === 'string' ? dateString.replace(/^"|"$/g, "") : dateString;
  const d = dayjs(cleanDate);
  return d.isValid() ? d : null;
};
import { NannyProfile } from "@features/nanny-share/components/profileCard";
import { childAgesFromCaregiverForm } from "@features/dashboard/lib/profilePreview";
import SelectChildrenAge from "@features/nanny-share/post/SelectChildrenAge";
import { resolveChildrenAges } from "@shared/lib/children";
import { deparseHourlyRate, parseHourlyRate } from "@shared/lib/rates";
import { zipFromPlace } from "@shared/lib/serviceArea";
import { User, Users, MapPin, Circle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  EditProfileLayout,
  EditSection,
  FieldLabel,
  PreviewToggle,
  ProfileIdentity,
  WeeklySchedule,
} from "@features/dashboard/components/EditProfileLayout";
import { SHARE_SCHEDULES, normalizeShareSchedule } from "@shared/lib/scheduleFormat";

const parseTime = (time) => {
  return time ? dayjs(time) : null;
};

export default function EditProfileNanny() {
  const Autocomplete = AutocompleteModule.default;
  const { TextArea } = Input;
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [form] = Form.useForm();
  const [rateType, setRateType] = useState("hourly");
  const [nannyProfile, setNannyProfile] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [userType, setUserType] = useState(
    (user?.goal === "Nanny adding a share" || user?.goal === "I already work with a family and want to add a share") ? "Family" : "Job"
  );
  const formValues = Form.useWatch([], form);

  useEffect(() => {
    if (user?._id) {
      dispatch(fetchNannyByIdThunk(user._id))
        .unwrap()
        .then((res) => {
          setNannyProfile(res?.nannyProfile || {});
          if (res?.nannyProfile?.imageFile) {
            setImage(prev => prev || res?.nannyProfile?.imageFile);
          }
        })
        // The form falls back to the auth user's own fields, so a failed fetch
        // leaves it usable rather than empty — nothing to report to the user.
        .catch(() => {});
    }
  }, [user?._id, dispatch]);

  const RANGES = {
    hourly: {
      shared: [
        { label: "$25-30 / hr", value: "25-30" },
        { label: "$30-35 / hr", value: "30-35" },
        { label: "$35-40 / hr", value: "35-40" },
        { label: "$40-45 / hr", value: "40-45" },
        { label: "$45-50+ / hr", value: "45-50+" },
      ],
      solo: [
        { label: "$20-25 / hr", value: "20-25" },
        { label: "$25-30 / hr", value: "25-30" },
        { label: "$30-35 / hr", value: "30-35" },
        { label: "$35-40 / hr", value: "35-40" },
        { label: "$40-45+ / hr", value: "40-45+" },
      ],
    },
    weekly: {
      shared: [
        { label: "$800-900 / wk", value: "800-900" },
        { label: "$900-1000 / wk", value: "900-1000" },
        { label: "$1000-1100 / wk", value: "1000-1100" },
        { label: "$1100-1200 / wk", value: "1100-1200" },
        { label: "$1200+ / wk", value: "1200+" },
      ],
      solo: [
        { label: "$600-700 / wk", value: "600-700" },
        { label: "$700-800 / wk", value: "700-800" },
        { label: "$800-900 / wk", value: "800-900" },
        { label: "$900-1000 / wk", value: "900-1000" },
        { label: "$1000+ / wk", value: "1000+" },
      ],
    },
  };

  const languageSkills = user?.additionalInfo?.find((info) => info.key === "language")?.value;
  const defaultCheckedValues = languageSkills?.option;
  // let parsedLanguages = nannyProfile?.languages;
  // if (typeof parsedLanguages === 'string') { try { parsedLanguages = JSON.parse(parsedLanguages); } catch (e) { } }
  // const defaultCheckedValues = parsedLanguages || languageSkills?.option;

  const daysOfWeek = useMemo(() => ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], []);
  const specificDaysAndTime = user?.additionalInfo?.find((info) => info.key === "specificDaysAndTime")?.value;
  const salaryExp = user?.additionalInfo?.find((info) => info.key === "salaryExp")?.value;
  const jobDescription = user?.additionalInfo.find((i) => i.key === "jobDescription")?.value;

  const [daysState, setDaysState] = useState(() => {
    return daysOfWeek.reduce((acc, day) => {
      const specificDay = specificDaysAndTime?.[day];
      acc[day] = {
        checked: !!specificDay,
        start: specificDay?.start || null,
        end: specificDay?.end || null,
      };
      return acc;
    }, {});
  });

  useEffect(() => {
    if (user) {
      const getInfo = (key, profileKey) => {
        const fallback = user?.additionalInfo?.find((info) => info.key === key)?.value;
        let val;
        if (nannyProfile && Object.keys(nannyProfile).length > 0) {
          val = nannyProfile[profileKey];
        } else {
          val = fallback?.option !== undefined ? fallback.option : fallback;
        }
        
        // If it's an array with one string, extract the string
        if (Array.isArray(val) && val.length === 1 && typeof val[0] === 'string') {
          val = val[0];
        }

        if (typeof val === 'string') {
          const knownOptions = [
            "A family I currently work with", "Myself (bringing my own child)",
            "Full-time", "Part-time",
            "Same schedule", "Partially overlapping", "Filling gaps",
            "Yes", "Sometimes", "No"
          ];
          const match = knownOptions.find(o => o.toLowerCase().trim() === val.toLowerCase().trim());
          if (match) return match;
        }
        return val;
      };

      const initialRateType = getInfo("rateType", "rateType") || "hourly";
      setRateType(initialRateType);

      form.setFieldsValue({
        fullName: user.name,
        gender: user.gender,
        age: user.age,
        location: user.location?.format_location,
        zipCode: user.zipCode,
        language: normalizeAnswer(readList(nannyProfile?.languages).length ? readList(nannyProfile.languages) : readList(defaultCheckedValues)),
        firstChild: salaryExp?.firstChild,
        secChild: salaryExp?.secChild,
        thirdChild: salaryExp?.thirdChild,
        fourthChild: salaryExp?.fourthChild,
        fiveOrMoreChild: salaryExp?.fiveOrMoreChild,

        avaiForWorking: normalizeShareSchedule(getInfo("avaiForWorking", "careType")),
        availability: getValidDate(getInfo("availability", "startAvailability")),
        experience: normalizeAnswer(getInfo("experience", "careExperience")),
        ageGroupsExp: normalizeAnswer(readList(getInfo("ageGroupsExp", "ageGroupsExp"))),
        additionalDetails: getInfo("additionalDetails", "additionalDetails"),
        jobDescription: nannyProfile?.bio || jobDescription,
        certifications: normalizeAnswer(readList(getInfo("certifications", "certifications"))),
        customCertifications: getInfo("customCertifications", "customCertifications"),
        skills: getInfo("skills", "skills"),

        // Onboarding / Nanny Share Fields
        shareExperience: getInfo("shareExperience", "shareExperience"),
        multiFamilyComfort: getInfo("multiFamilyComfort", "multiFamilyComfort"),
        childrenCapacity: getInfo("childrenCapacity", "childrenCapacity"),
        preferredAges: normalizeAnswer(readList(getInfo("preferredAges", "preferredAges"))),
        workSetup: getInfo("workSetup", "workSetup"),
        responsibilities: normalizeAnswer(readList(getInfo("responsibilities", "responsibilities"))),
        householdHelp: normalizeAnswer(readList(getInfo("householdHelp", "householdHelp"))),
        hasTransport: getInfo("hasTransport", "hasTransport"),
        backgroundCheck: getInfo("backgroundCheck", "backgroundCheck"),
        rateType: initialRateType,
        sharedRate: getInfo("sharedRate", "sharedRate"),
        soloRate: getInfo("soloRate", "soloRate"),
        forWho: getInfo("forWho", "forWho"),
        numberOfChildren: getInfo("numberOfChildren", "numberOfChildren"),
        childrenAges: getInfo("childrenAges", "childrenAges"),
        // Normalised on the way in: a share is full-time or part-time, and a
        // profile answered before that — "Flexible", "full-time care" — would
        // otherwise preselect nothing and be blanked by the next save.
        currentSchedule: normalizeShareSchedule(getInfo("currentSchedule", "currentSchedule")),
        joinTiming: getInfo("joinTiming", "joinTiming"),
        together: getInfo("together", "together"),
        whereCare: getInfo("whereCare", "whereCare"),
        hourlyBudget: nannyProfile?.hourlyBudget ? deparseHourlyRate(typeof nannyProfile.hourlyBudget === 'string' ? JSON.parse(nannyProfile.hourlyBudget) : nannyProfile.hourlyBudget) : undefined,
      });

      let parsedSpecificDays = nannyProfile?.specificDays;
      if (typeof parsedSpecificDays === 'string') {
        try {
          parsedSpecificDays = JSON.parse(parsedSpecificDays);
        } catch (e) { }
      }

      const sourceDays = parsedSpecificDays || specificDaysAndTime;

      setDaysState(daysOfWeek.reduce((acc, day) => {
        const specificDay = sourceDays?.[day];
        acc[day] = {
          checked: !!specificDay?.checked || !!specificDay,
          start: specificDay?.start || null,
          end: specificDay?.end || null,
        };
        return acc;
      }, {}));
    }
  }, [user, form, daysOfWeek, specificDaysAndTime, salaryExp, defaultCheckedValues, jobDescription, nannyProfile]);

  useEffect(() => {
    if (user) {
      const addr = user?.location?.format_location || "";
      setLocation(addr);
      if (user?.location) {
        setCoordinates(
          user?.location
        );
      }
    }
  }, [user, form]);


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

  const [image, setImage] = useState(user.imageUrl);
  const [file, setFile] = useState(null);

  const handleImageChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const imageUrl = URL.createObjectURL(selectedFile);
      setImage(imageUrl);
      setFile(selectedFile);
    }
  };


  const defaultCheckedValues2 = user?.additionalInfo.find((info) => info.key === "avaiForWorking")?.value.option;

  const options3 = [
    { value: "Immediate", label: "Immediate" },
    { value: "Start within 1 month", label: "Start within 1 month" },
    { value: "Flexible start date", label: "Flexible start date" },
  ];

  const defaultCheckedValues3 = user?.additionalInfo.find((info) => info.key === "availability")?.value.option;


  const defaultCheckedValues4 = user?.additionalInfo.find((info) => info.key === "experience")?.value.option;



  const defaultCheckedValues5 = user?.additionalInfo?.find((info) => info.key === "ageGroupsExp")?.value?.option;
  const defaultCheckedValues6 = user?.additionalInfo?.find((info) => info.key === "additionalDetails")?.value?.option;
  // let parsedAgeGroups = nannyProfile?.ageGroupsExp;
  // if (typeof parsedAgeGroups === 'string') { try { parsedAgeGroups = JSON.parse(parsedAgeGroups); } catch (e) { } }
  // const defaultCheckedValues5 = parsedAgeGroups || user?.additionalInfo?.find((info) => info.key === "ageGroupsExp")?.value?.option;

  // let parsedDetails = nannyProfile?.additionalDetails;
  // if (typeof parsedDetails === 'string') { try { parsedDetails = JSON.parse(parsedDetails); } catch (e) { } }
  // const defaultCheckedValues6 = parsedDetails || user?.additionalInfo?.find((info) => info.key === "additionalDetails")?.value?.option;

  const transformObject = (obj) => {
    const additionalInfo = [];
    const keysSet = new Set();
    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value) && value.length > 0) {
        if (value.some((item) => item !== undefined) && !keysSet.has(key)) {
          additionalInfo.push({ key: key, value: { option: value } });
          keysSet.add(key);
        }
      }
    }
    const additionalProperties = [
      "language", "avaiForWorking", "availability", "experience", "ageGroupsExp", "additionalDetails",
      "shareExperience", "multiFamilyComfort", "childrenCapacity", "preferredAges", "workSetup",
      "responsibilities", "householdHelp", "hasTransport", "backgroundCheck", "sharedRate", "soloRate", "rateType",
      // "agesCare", "currentSchedule", "forWho", "numChildrenCare", "joinTiming", "together"
    ];
    additionalProperties.forEach((prop) => {
      if (obj[prop] !== undefined && obj[prop] !== null) {
        if (Array.isArray(obj[prop]) && obj[prop].some((item) => item !== undefined) && !keysSet.has(prop)) {
          additionalInfo.push({ key: prop, value: { option: obj[prop] } });
          keysSet.add(prop);
        } else if (typeof obj[prop] === "string" && !keysSet.has(prop)) {
          additionalInfo.push({ key: prop, value: { option: obj[prop] } });
          keysSet.add(prop);
        }
      }
    });
    return { additionalInfo };
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const transformedObject = transformObject(values);
      const salaryExpObject = {
        key: "salaryExp",
        value: {
          firstChild: values.firstChild,
          secChild: values.secChild,
          thirdChild: values.thirdChild,
          fourthChild: values.fourthChild,
          fiveOrMoreChild: values.fiveOrMoreChild,
        },
      };

      const salaryRange = {
        key: "salaryRange",
        value: {
          min: Number(values.firstChild),
          max: Number(values.fiveOrMoreChild),
        },
      };

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

      const selectedDays = Object.entries(checkedDays);
      if (selectedDays.length === 0) {
        setLoading(false);
        return fireToastMessage({ type: "error", message: "At least one day must be selected." });
      }

      const invalidDays = selectedDays
        .filter(([_, { start, end }]) => {
          const parsedStart = parseTime(start);
          const parsedEnd = parseTime(end);
          return !parsedStart || !parsedEnd || !parsedStart.isValid() || !parsedEnd.isValid() || parsedStart.isSame(parsedEnd) || parsedEnd.isBefore(parsedStart);
        })
        .map(([day]) => day);

      if (invalidDays.length > 0) {
        setLoading(false);
        return fireToastMessage({ type: "error", message: `Invalid times for: ${invalidDays.join(", ")}` });
      }

      const specificDaysAndTime = { key: "specificDaysAndTime", value: checkedDays };
      let addData = transformedObject;
      addData?.additionalInfo.push(salaryExpObject, specificDaysAndTime, salaryRange);
      if (values.jobDescription) {
        addData.additionalInfo.push({ key: "jobDescription", value: values.jobDescription });
      }

      const formData = new FormData();
      const finalZipCode = values.zipCode || zipCode;

      if (!finalZipCode) {
        setLoading(false);
        return fireToastMessage({ type: "error", message: "Zip code is missing." });
      }

      if (coordinates) {
        formData.append("location", JSON.stringify(coordinates));
      }
      formData.append("zipCode", finalZipCode);
      if (values.fullName) formData.append("name", values.fullName);
      if (values.email) formData.append("email", values.email);
      if (values.age) formData.append("age", values.age);
      if (values.gender) formData.append("gender", values.gender);
      // We no longer save additionalInfo to the User schema to avoid duplicates and adhere to Single Source of Truth
      if (file) formData.append("imageUrl", file);

      // --- Nanny Profile Specific Data ---
      const nannyFormData = new FormData();
      const nannyFieldsMap = {
        shareExperience: "shareExperience",
        multiFamilyComfort: "multiFamilyComfort",
        childrenCapacity: "childrenCapacity",
        workSetup: "workSetup",
        responsibilities: "responsibilities",
        householdHelp: "householdHelp",
        hasTransport: "hasTransport",
        backgroundCheck: "backgroundCheck",
        sharedRate: "sharedRate",
        soloRate: "soloRate",
        rateType: "rateType",
        avaiForWorking: "careType",
        availability: "startAvailability",
        experience: "careExperience",
        jobDescription: "bio",
        // The dynamic fields moved from additionalInfo
        language: "languages",
        ageGroupsExp: "ageGroupsExp",
        certifications: "certifications",
        customCertifications: "customCertifications",
        skills: "skills",
        forWho: "forWho",
        numberOfChildren: "numberOfChildren",
        childrenAges: "childrenAges",
        currentSchedule: "currentSchedule",
        joinTiming: "joinTiming",
        together: "together",
        whereCare: "whereCare",
        goal: "goal"
      };

      const resolvedAges = resolveChildrenAges(values);

      formData.append("goal", userType === "Job" ? "Looking for nanny share job" : "Nanny adding a share");
      nannyFormData.append("hasFamily", userType === "Job" ? false : true);

      Object.entries(nannyFieldsMap).forEach(([formField, dbField]) => {
        if (formField !== "childrenAges" && formField !== "numberOfChildren") {
          const val = values[formField] !== undefined && values[formField] !== null ? values[formField] : "";
          if (Array.isArray(val)) {
            nannyFormData.append(dbField, JSON.stringify(val));
          } else {
            nannyFormData.append(dbField, val);
          }
        }
      });
      if (userType !== "Job") {
        nannyFormData.append("numberOfChildren", resolvedAges.length);
        nannyFormData.append("childrenAges", JSON.stringify(resolvedAges));
        if (values.hourlyBudget) {
          nannyFormData.append("hourlyBudget", JSON.stringify(parseHourlyRate(values.hourlyBudget)));
        }
      }
      nannyFormData.append("specificDays", JSON.stringify(checkedDays));

      // Handle preferredAges correctly
      if (values.preferredAges) {
        const preferredAgesArray = values.preferredAges.map(ageStr => {
          let min = 0;
          let max = 0;
          if (ageStr.includes("0–1") || ageStr.includes("0-1")) { min = 0; max = 1; }
          else if (ageStr.includes("1–3") || ageStr.includes("1-3")) { min = 1; max = 3; }
          else if (ageStr.includes("3–5") || ageStr.includes("3-5")) { min = 3; max = 5; }
          else if (ageStr.includes("5+")) { min = 5; max = 18; }
          return { label: ageStr, min, max };
        });
        nannyFormData.append("preferredAges", JSON.stringify(preferredAgesArray));
      }

      // Handle hourlyRate structure
      const parseRate = (valStr) => {
        if (!valStr) return { min: 0, max: 0 };
        const clean = valStr.replace('+', '').replace('$', '').trim();
        const parts = clean.split('-');
        if (parts.length === 2) {
          return { min: Number(parts[0]), max: Number(parts[1]) };
        } else {
          const num = Number(parts[0]);
          return { min: num, max: num };
        }
      };

      const soloRateParsed = parseRate(values.soloRate);
      const sharedRateParsed = parseRate(values.sharedRate);

      const hourlyRate = {
        Solo: { min: soloRateParsed.min, max: soloRateParsed.max },
        Shared: { min: sharedRateParsed.min, max: sharedRateParsed.max }
      };
      nannyFormData.append("hourlyRate", JSON.stringify(hourlyRate));

      const nannySalaryExpObject = {
        firstChild: values.firstChild,
        secChild: values.secChild,
        thirdChild: values.thirdChild,
        fourthChild: values.fourthChild,
        fiveOrMoreChild: values.fiveOrMoreChild,
      };
      nannyFormData.append("salaryExp", JSON.stringify(nannySalaryExpObject));

      const nannySalaryRangeObject = {
        min: Number(values.firstChild),
        max: Number(values.fiveOrMoreChild),
      };
      nannyFormData.append("salaryRange", JSON.stringify(nannySalaryRangeObject));

      if (file) nannyFormData.append("imageFile", file);

      // Fire both dispatches
      await dispatch(updateNannyProfileThunk(nannyFormData)).unwrap();
      const { status } = await dispatch(editUserThunk(formData)).unwrap();

      if (status === 200) {
        // Fetch fresh data immediately so the UI is perfectly in sync
        const freshData = await dispatch(fetchNannyByIdThunk(user._id)).unwrap();
        setNannyProfile(freshData?.nannyProfile || {});

        fireToastMessage({ success: true, message: "User updated successfully" });
        navigate("/dashboard");
      }
    } catch (error) {
      fireToastMessage({ success: false, message: "Failed to update user." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLocation(user?.location?.format_location || "");
    setZipCode(user?.zipCode || "");
  }, [user]);

  const cardRate = (v) =>
    v ? deparseHourlyRate(typeof v === "string" ? JSON.parse(v) : v) : undefined;

  const sections = [
    { id: "preview", label: "Card preview" },
    { id: "role", label: "Your role" },
    { id: "basics", label: "Basic information" },
    { id: "about", label: "About you" },
    { id: "schedule", label: "Weekly availability" },
    { id: "rates", label: "Rates" },
    { id: "share", label: userType === "Job" ? "Nanny share fit" : "Current setup" },
    { id: "experience", label: "Experience" },
    { id: "expectations", label: "Expectations & safety" },
  ];

  const roleOptions = [
    {
      value: "Job",
      icon: Users,
      title: "I'm looking for a nanny share position",
      body: "Get matched with two compatible families.",
    },
    {
      value: "Family",
      icon: User,
      title: "I already work with a family and want to add a share",
      body: "Add a second family to your current role.",
    },
  ];

  return (
    <EditProfileLayout
      title="Edit profile"
      subtitle="Families see this when they browse caregivers."
      backTo="/dashboard"
      onDiscard={() => navigate("/dashboard")}
      onSave={() => form.submit()}
      saving={loading}
      viewProfileHref={`/dashboard/nanny-profile-view/${user?._id}`}
      sections={sections}
      identity={
        <ProfileIdentity
          image={image}
          name={formValues?.fullName || user?.name}
          location={location || user?.location?.format_location}
          onImageChange={handleImageChange}
          hint="A clear, friendly photo helps families trust you."
        />
      }
    >
      <Form onFinish={onFinish} form={form} layout="vertical" autoComplete="off" requiredMark={false}>
        <EditSection
          id="preview"
          stacked
          title="Card preview"
          description="How your card looks in search results. It updates as you type."
          action={<PreviewToggle shown={showPreview} onToggle={() => setShowPreview((v) => !v)} />}
        >
          {showPreview && (
            <div className="pointer-events-none rounded-2xl bg-[#F7F9FA] p-3 md:p-4" aria-hidden="true">
              <NannyProfile
                name={formValues?.fullName || user?.name}
                img={image || user?.image}
                location={{ format_location: location || user?.location?.format_location }}
                experience={formValues?.experience || nannyProfile?.careExperience}
                goal={userType === "Job" ? "Looking for a Nanny Share Position" : "Already work with a family"}
                rateType={rateType}
                sharedRate={userType === "Family" ? (formValues?.hourlyBudget || cardRate(nannyProfile?.hourlyBudget) || null) : (formValues?.sharedRate || nannyProfile?.sharedRate)}
                soloRate={userType === "Family" ? "N/A" : (formValues?.soloRate || nannyProfile?.soloRate)}
                ages={userType === "Job" ? (formValues?.preferredAges?.map(age => typeof age === "object" ? age.label : age) || nannyProfile?.preferredAges?.map(age => typeof age === "object" ? age.label : age)) : (childAgesFromCaregiverForm(formValues).length > 0 ? childAgesFromCaregiverForm(formValues) : nannyProfile?.childrenAges)}
                careType={userType === "Job" ? (formValues?.avaiForWorking || nannyProfile?.careType || "Nanny Share") : (formValues?.currentSchedule || nannyProfile?.currentSchedule)}
                schedule={daysState}
                distance={nannyProfile?.careDistance}
                start={formValues?.availability || nannyProfile?.startAvailability}
                hasFamily={userType === "Family"}
                childrenCount={formValues?.numberOfChildren || nannyProfile?.numberOfChildren}
                whereCare={formValues?.whereCare || nannyProfile?.whereCare}
                status={undefined}
                handleMatchRequest={() => { }}
              />
            </div>
          )}
        </EditSection>

        <EditSection
          id="role"
          title="Your role"
          description="This decides which questions appear below. You can switch any time."
        >
          <div role="radiogroup" aria-label="Your role" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roleOptions.map(({ value, icon: Icon, title, body }) => {
              const selected = userType === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setUserType(value)}
                  className={`text-left flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${selected ? "border-[#AEC4FF] bg-[#EEF3FF]" : "border-[#E3E7EF] bg-white hover:border-[#AEC4FF]"}`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${selected ? "bg-white" : "bg-[#F3F5F9]"}`}>
                    <Icon className="w-4 h-4 text-[#001243]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block Livvic-SemiBold text-sm text-[#001243] leading-5">{title}</span>
                    <span className="block Livvic-Medium text-xs text-gray-500 mt-1">{body}</span>
                  </span>
                  {selected ? <CheckCircle2 className="w-5 h-5 text-[#001243] shrink-0" /> : <Circle className="w-5 h-5 text-gray-300 shrink-0" />}
                </button>
              );
            })}
          </div>
        </EditSection>

        <EditSection id="basics" title="Basic information" description="Your email stays private. Families see your name and area.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
            <Form.Item name="fullName" initialValue={user?.name} label="Full name">
              <Input />
            </Form.Item>

            <Form.Item name="email" initialValue={user?.email} label="Email address">
              <Input type="email" />
            </Form.Item>

            <Form.Item name="location" label="Address" rules={[{ required: true, message: "Add your address so families nearby can find you." }]}>
              <div className="relative">
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
                <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              </div>
            </Form.Item>

            <Form.Item name="zipCode" label="Zip code">
              <Input onChange={(e) => setZipCode(e.target.value)} />
            </Form.Item>

            <Form.Item name="gender" initialValue={user?.gender} label="Gender">
              <Select placeholder="Select gender">
                <Select.Option value="Male">Male</Select.Option>
                <Select.Option value="Female">Female</Select.Option>
                <Select.Option value="Other">Other</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="age" initialValue={user?.age} label="Age">
              <Input type="number" />
            </Form.Item>
          </div>
        </EditSection>

        <EditSection id="about" title="About you" description="Your approach to care, in your own words. This is the first thing families read.">
          <Form.Item name="jobDescription" label="Bio" initialValue={user?.additionalInfo.find((i) => i.key === "jobDescription")?.value}>
            <TextArea
              rows={6}
              showCount
              placeholder="Tell families about your approach, skills, and background…"
              className="Livvic-Medium"
            />
          </Form.Item>

          <FieldLabel>Languages you speak</FieldLabel>
          <OptionSelector key={nannyProfile ? "loaded" : "initial"} options={LANGUAGES} form={form} defaultCheckedValues={normalizeAnswer(readList(nannyProfile?.languages).length ? readList(nannyProfile.languages) : readList(defaultCheckedValues))} name="language" />
        </EditSection>

        <EditSection id="schedule" title="Weekly availability" description="Tick the days you can work and set your hours. At least one day is needed.">
          <WeeklySchedule
            days={daysOfWeek}
            state={daysState}
            onToggle={handleCheckboxChange}
            onTimeChange={handleTimeChange}
          />
        </EditSection>

        <EditSection id="rates" title="Rates" description="Shared care is when both families' children are with you. Solo is one family.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
            <Form.Item name="rateType" label="Billed">
              <Select
                value={rateType}
                onChange={(val) => {
                  setRateType(val);
                  form.setFieldsValue({ rateType: val, sharedRate: undefined, soloRate: undefined });
                }}
                options={[
                  { value: "hourly", label: "Hourly" },
                  { value: "weekly", label: "Weekly" }
                ]}
              />
            </Form.Item>

            <Form.Item name="sharedRate" label="Shared care rate">
              <Select placeholder="Select a range" options={RANGES[rateType]?.shared || []} />
            </Form.Item>

            <Form.Item name="soloRate" label="Solo care rate">
              <Select placeholder="Select a range" options={RANGES[rateType]?.solo || []} />
            </Form.Item>
          </div>

          <FieldLabel className="mt-2">Rate by number of children</FieldLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4">
            <Form.Item name="firstChild" label="1 child">
              <Input type="number" prefix="$" placeholder="20" />
            </Form.Item>
            <Form.Item name="secChild" label="2 children">
              <Input type="number" prefix="$" placeholder="25" />
            </Form.Item>
            <Form.Item name="thirdChild" label="3 children">
              <Input type="number" prefix="$" placeholder="30" />
            </Form.Item>
            <Form.Item name="fourthChild" label="4 children">
              <Input type="number" prefix="$" placeholder="35" />
            </Form.Item>
            <Form.Item name="fiveOrMoreChild" label="5+ children">
              <Input type="number" prefix="$" placeholder="40" />
            </Form.Item>
          </div>
        </EditSection>

        {userType === "Job" ? (
          <EditSection id="share" title="Nanny share fit" description="Helps us match you with families whose setup suits you.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
              <Form.Item name="shareExperience" label="Worked in a nanny share before?">
                <Select placeholder="Select an answer">
                  <Select.Option value="Yes">Yes</Select.Option>
                  <Select.Option value="No">No</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="multiFamilyComfort" label="Comfortable caring for children from two families?">
                <Select placeholder="Select an answer">
                  <Select.Option value="Yes">Yes</Select.Option>
                  <Select.Option value="No">No</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="childrenCapacity" label="How many children at once?">
                <Select placeholder="Select a number">
                  <Select.Option value="1-2">1-2 children</Select.Option>
                  <Select.Option value="2-3">2-3 children</Select.Option>
                  <Select.Option value="3-4">3-4 children</Select.Option>
                  <Select.Option value="Flexible">Flexible</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="workSetup" label="Where you're happy to work">
                <Select placeholder="Select a setup">
                  <Select.Option value="One home">One home</Select.Option>
                  <Select.Option value="Rotating homes">Rotating homes</Select.Option>
                  <Select.Option value="Either">Either</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="preferredAges" className="md:col-span-2" label="Ages you prefer to work with">
                <Select
                  mode="multiple"
                  placeholder="Select ages"
                  options={toSelectOptions(AGE_GROUPS)}
                />
              </Form.Item>
            </div>
          </EditSection>
        ) : (
          <EditSection id="share" title="Current setup" description="Tell a second family about the family you already work with.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
              <Form.Item name="forWho" label="Who is this share for?">
                <Select placeholder="Select an answer">
                  <Select.Option value="A family I currently work with">A family I currently work with</Select.Option>
                  <Select.Option value="Myself (bringing my own child)">Myself (bringing my own child)</Select.Option>
                </Select>
              </Form.Item>

              <SelectChildrenAge
                form={form}
                opt={[1, 2, 3, 4, 5]}
                selectedValue={form.getFieldValue("numberOfChildren")}
                handleSelectChange={(val) => form.setFieldsValue({ numberOfChildren: val })}
                numberOfChildren={nannyProfile?.numberOfChildren}
                childrenAges={
                  nannyProfile?.childrenAges?.length
                    ? nannyProfile.childrenAges.map((age) => age.label).join(", ")
                    : ""
                }
              />
              <Form.Item name="numberOfChildren" hidden><Input /></Form.Item>

              <Form.Item name="whereCare" label="Where care takes place">
                <Select placeholder="Select an answer">
                  <Select.Option value="Current family's home">Current family’s home</Select.Option>
                  <Select.Option value="Other family's home">Other family’s home</Select.Option>
                  <Select.Option value="Rotating between homes">Rotating between homes</Select.Option>
                  <Select.Option value="Neutral location">Neutral location</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="currentSchedule" label="Your current schedule">
                <Select placeholder="Select a schedule">
                  {SHARE_SCHEDULES.map((schedule) => (
                    <Select.Option key={schedule} value={schedule}>{schedule}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="joinTiming" label="When a second family would join">
                <Select placeholder="Select timing">
                  <Select.Option value="Same schedule">Same schedule</Select.Option>
                  <Select.Option value="Partially overlapping">Partially overlapping</Select.Option>
                  <Select.Option value="Filling gaps">Filling gaps</Select.Option>
                  <Select.Option value="Flexible">Flexible</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="together" label="Would the children be together?">
                <Select placeholder="Select an answer">
                  <Select.Option value="Yes">Yes</Select.Option>
                  <Select.Option value="Sometimes">Sometimes</Select.Option>
                  <Select.Option value="No">No</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="hourlyBudget" className="md:col-span-2" initialValue={cardRate(nannyProfile?.hourlyBudget)} label="Hourly rate, split between families">
                <Select placeholder="Select a rate">
                  <Select.Option value="$10 - $15 per hour (Each family pays $5 - $7.50)">$10 - $15 per hour (Each family pays $5 - $7.50)</Select.Option>
                  <Select.Option value="$15 - $20 per hour (Each family pays $7.50 - $10)">$15 - $20 per hour (Each family pays $7.50 - $10)</Select.Option>
                  <Select.Option value="$20 - $25 per hour (Each family pays $10 - $12.50)">$20 - $25 per hour (Each family pays $10 - $12.50)</Select.Option>
                  <Select.Option value="$25 - $30 per hour (Each family pays $12.50 - $15)">$25 - $30 per hour (Each family pays $12.50 - $15)</Select.Option>
                  <Select.Option value="$30 - $35 per hour (Each family pays $15 - $17.50)">$30 - $35 per hour (Each family pays $15 - $17.50)</Select.Option>
                  <Select.Option value="$35 - $40 per hour (Each family pays $17.50 - $20)">$35 - $40 per hour (Each family pays $17.50 - $20)</Select.Option>
                  <Select.Option value="$40+ per hour (Each family pays $20+)">$40+ per hour (Each family pays $20+)</Select.Option>
                </Select>
              </Form.Item>
            </div>
          </EditSection>
        )}

        <EditSection id="experience" title="Experience" description="Your background and training.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
            <Form.Item name="avaiForWorking" initialValue={normalizeShareSchedule(defaultCheckedValues2)} label="Care type">
              <Select options={SHARE_SCHEDULES.map((v) => ({ value: v, label: v }))} placeholder="Select" />
            </Form.Item>
            <Form.Item name="availability" label="Can start from" initialValue={getValidDate(defaultCheckedValues3)}>
              <DatePicker className="w-full" format="MMMM D, YYYY" />
            </Form.Item>
            <Form.Item name="experience" initialValue={normalizeAnswer(defaultCheckedValues4)} label="Years of experience">
              <Select options={toSelectOptions(CARE_EXPERIENCE)} placeholder="Select" />
            </Form.Item>
          </div>

          <FieldLabel>Age groups you’ve cared for</FieldLabel>
          <OptionSelector key={nannyProfile ? "loaded" : "initial"} options={AGE_GROUPS} defaultCheckedValues={normalizeAnswer(readList(nannyProfile?.ageGroupsExp).length ? readList(nannyProfile.ageGroupsExp) : readList(defaultCheckedValues5))} form={form} name="ageGroupsExp" />

          <FieldLabel className="mt-6">Certifications</FieldLabel>
          <OptionSelector key={nannyProfile ? "loaded" : "initial"} options={CERTIFICATIONS} defaultCheckedValues={normalizeAnswer(readList(nannyProfile?.certifications).length ? readList(nannyProfile.certifications) : readList(defaultCheckedValues6))} form={form} name="certifications" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 mt-6">
            <Form.Item name="customCertifications" initialValue={nannyProfile?.customCertifications} label="Other certifications or training">
              <Input placeholder="e.g. Water safety instructor" />
            </Form.Item>
            <Form.Item name="skills" initialValue={nannyProfile?.skills} label="Special skills">
              <Input placeholder="e.g. Sign language, music" />
            </Form.Item>
          </div>
        </EditSection>

        <EditSection id="expectations" title="Expectations & safety" description="What you'll help with, and the checks families look for.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
            <Form.Item name="hasTransport" label="Own reliable transportation?">
              <Select placeholder="Select an answer">
                <Select.Option value="Yes">Yes</Select.Option>
                <Select.Option value="No">No</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="backgroundCheck" label="Open to a background check?">
              <Select placeholder="Select an answer">
                <Select.Option value="Yes">Yes</Select.Option>
                <Select.Option value="No">No</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="householdHelp" className="md:col-span-2" label="Household tasks you're open to">
              <Select
                mode="multiple"
                placeholder="Select all that apply"
                options={toSelectOptions([...HOUSEHOLD_TASKS, NOT_APPLICABLE])}
              />
            </Form.Item>

            <Form.Item name="responsibilities" className="md:col-span-2" label="What your role usually includes">
              <Select
                mode="multiple"
                placeholder="Select all that apply"
                options={toSelectOptions(CHILD_HELP)}
              />
            </Form.Item>
          </div>
        </EditSection>
      </Form>
    </EditProfileLayout>
  );
}
