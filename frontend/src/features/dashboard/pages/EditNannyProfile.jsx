import { useCallback, useEffect, useState, useMemo } from "react";
import cameraIcons from "@/assets/images/cameraIcon.png";
import { Form, Input, Checkbox, Select, Button, TimePicker, Spin, DatePicker } from "antd";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "react-avatar";
import { fireToastMessage } from "@shared/ui/toast";
import { editUserThunk, updateNannyProfileThunk } from "@features/auth/store/authSlice";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import Autocomplete from "react-google-autocomplete";
import OptionSelector from "@shared/ui/LanguageSelector";
import dayjs from "dayjs";
const getValidDate = (dateString) => {
  if (!dateString) return null;
  const cleanDate = typeof dateString === 'string' ? dateString.replace(/^"|"$/g, "") : dateString;
  const d = dayjs(cleanDate);
  return d.isValid() ? d : null;
};
import { NannyProfile } from "@features/nanny-share/components/profileCard";
import SelectChildrenAge from "@features/nanny-share/post/SelectChildrenAge";
import { resolveChildrenAges } from "@shared/lib/children";
import { deparseHourlyRate, parseHourlyRate } from "@shared/lib/rates";
import { zipFromPlace } from "@shared/lib/serviceArea";
import {
  ChevronLeft,
  User,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Languages,
  Briefcase,
  Baby,
  FileText,
  Camera,
  Save,
  X,
  Users,
  Sparkles,
  Eye,
  EyeOff,
  Info,
  Circle,
  CheckCircle2
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { SHARE_SCHEDULES, normalizeShareSchedule } from "@shared/lib/scheduleFormat";

const parseTime = (time) => {
  return time ? dayjs(time) : null;
};

export default function EditProfileNanny() {
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

  const options = ["English", "Spanish", "French", "Mandarin", "Cantonese", "Arabic"];
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
        language: defaultCheckedValues,
        firstChild: salaryExp?.firstChild,
        secChild: salaryExp?.secChild,
        thirdChild: salaryExp?.thirdChild,
        fourthChild: salaryExp?.fourthChild,
        fiveOrMoreChild: salaryExp?.fiveOrMoreChild,

        avaiForWorking: getInfo("avaiForWorking", "careType"),
        availability: getValidDate(getInfo("availability", "startAvailability")),
        experience: getInfo("experience", "careExperience"),
        ageGroupsExp: getInfo("ageGroupsExp", "ageGroupsExp") || (nannyProfile?.preferredAges ? nannyProfile.preferredAges.map(a => a.label) : undefined),
        additionalDetails: getInfo("additionalDetails", "additionalDetails"),
        jobDescription: nannyProfile?.bio || jobDescription,
        certifications: getInfo("certifications", "certifications"),
        customCertifications: getInfo("customCertifications", "customCertifications"),
        skills: getInfo("skills", "skills"),

        // Onboarding / Nanny Share Fields
        shareExperience: getInfo("shareExperience", "shareExperience"),
        multiFamilyComfort: getInfo("multiFamilyComfort", "multiFamilyComfort"),
        childrenCapacity: getInfo("childrenCapacity", "childrenCapacity"),
        preferredAges: getInfo("preferredAges", "preferredAges")?.map(a => typeof a === 'object' ? a.label : a) || undefined,
        workSetup: getInfo("workSetup", "workSetup"),
        responsibilities: getInfo("responsibilities", "responsibilities"),
        householdHelp: getInfo("householdHelp", "householdHelp"),
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

  const options2 = [
    { value: "Full-time", label: "Full-time" },
    { value: "Part-time", label: "Part-time" },
    { value: "Occasional", label: "Occasional" },
    { value: "Weekends only", label: "Weekends only" },
    { value: "Nights only", label: "Nights only" },
    { value: "Flexible", label: "Flexible" },
  ];

  const defaultCheckedValues2 = user?.additionalInfo.find((info) => info.key === "avaiForWorking")?.value.option;

  const options3 = [
    { value: "Immediate", label: "Immediate" },
    { value: "Start within 1 month", label: "Start within 1 month" },
    { value: "Flexible start date", label: "Flexible start date" },
  ];

  const defaultCheckedValues3 = user?.additionalInfo.find((info) => info.key === "availability")?.value.option;

  const options4 = [
    { value: "Less than 1 year", label: "Less than 1 year" },
    { value: "1-3 years", label: "1-3 years" },
    { value: "3-5 years", label: "3-5 years" },
    { value: "Over 5 years", label: "Over 5 years" },
  ];

  const defaultCheckedValues4 = user?.additionalInfo.find((info) => info.key === "experience")?.value.option;

  const options5 = [
    "Infants (0-1)",
    "Toddlers (1-3)",
    "Preschoolers (3-5)",
    "School-aged (5+)",
  ];

  const options6 = [
    "CPR",
    "First Aid",
    "Water Safety",
    "Early Childhood Education",
    "Special Needs",
  ];

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
        navigate("/nanny");
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

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <NavLink to="/nanny" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-primary" />
            </NavLink>
            <h1 className="Livvic-Bold text-xl md:text-2xl text-primary">Edit Profile</h1>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/nanny">
              <button className="hidden md:flex items-center gap-2 px-6 py-2 rounded-full border border-gray-200 text-secondary Livvic-SemiBold hover:bg-gray-50 transition-all">
                <X className="w-4 h-4" /> Discard
              </button>
            </NavLink>
            <button
              onClick={() => form.submit()}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2 rounded-full bg-primary text-primary Livvic-SemiBold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {loading ? <Spin size="small" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-4 md:mt-8 mb-12">
        <Form onFinish={onFinish} form={form} layout="vertical" autoComplete="off" className="space-y-6 md:space-y-8">

          {/* Profile Photo & Live Preview Grid */}
          <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
            {/* Profile Photo Section */}
            <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100 lg:w-[320px] shrink-0">
              <h2 className="Livvic-Bold text-lg text-primary mb-6">
                Profile Photo
              </h2>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="relative group">
                  {image ? (
                    <img src={image} className="w-32 h-32 rounded-3xl object-cover shadow-sm transition-transform group-hover:scale-105" alt="profile" />
                  ) : (
                    <div className="w-32 h-32 rounded-3xl bg-[#AEC4FF] flex items-center justify-center text-[#0D134C] text-4xl Livvic-Bold shadow-sm">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <label className="absolute -bottom-2 -right-2 bg-white text-primary w-10 h-10 rounded-full border border-gray-200 shadow-md cursor-pointer hover:scale-110 transition-transform flex items-center justify-center">
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                    <Camera className="w-4 h-4 text-primary" />
                  </label>
                </div>

                <label className="w-full">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                  <div className="w-full py-2.5 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-primary Livvic-SemiBold cursor-pointer hover:bg-gray-50 transition-colors">
                    <Camera className="w-4 h-4" /> Change Photo
                  </div>
                </label>

                <p className="Livvic text-secondary text-sm">Clear, friendly photos help families trust you more.</p>
              </div>
            </section>

            {/* Live Preview Section */}
            <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100 flex-1 flex flex-col min-w-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="Livvic-Bold text-lg text-primary flex items-center gap-2">
                    {showPreview ? (
                      <Eye className="w-5 h-5 text-primary cursor-pointer hover:text-[#AEC4FF] transition-colors" onClick={() => setShowPreview(false)} />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => setShowPreview(true)} />
                    )}
                    Live Preview
                  </h2>
                  <p className="text-secondary text-sm Livvic mt-1">This is how families will see your profile.</p>
                </div>
              </div>

              {showPreview ? (
                <div className="w-full mt-2 pointer-events-none">
                  <NannyProfile
                    name={formValues?.fullName || user?.name}
                    img={image || user?.image}
                    location={{ format_location: location || user?.location?.format_location }}
                    experience={formValues?.experience || nannyProfile?.careExperience}
                    goal={userType === 'Job' ? "Looking for a Nanny Share Position" : "Already work with a family"}
                    rateType={rateType}
                    sharedRate={userType === 'Family' ? (formValues?.hourlyBudget || (nannyProfile?.hourlyBudget ? deparseHourlyRate(typeof nannyProfile.hourlyBudget === 'string' ? JSON.parse(nannyProfile.hourlyBudget) : nannyProfile.hourlyBudget) : null)) : (formValues?.sharedRate || nannyProfile?.sharedRate)}
                    soloRate={userType === 'Family' ? "N/A" : (formValues?.soloRate || nannyProfile?.soloRate)}
                    ages={userType === 'Job' ? (formValues?.preferredAges?.map(age => typeof age === 'object' ? age.label : age) || nannyProfile?.preferredAges?.map(age => typeof age === 'object' ? age.label : age)) : ((formValues && resolveChildrenAges(formValues)?.length > 0) ? resolveChildrenAges(formValues) : nannyProfile?.childrenAges)}
                    careType={userType === 'Job' ? (formValues?.avaiForWorking || nannyProfile?.careType || "Nanny Share") : (formValues?.currentSchedule || nannyProfile?.currentSchedule)}
                    schedule={daysState}
                    distance={nannyProfile?.careDistance}
                    start={formValues?.availability || nannyProfile?.startAvailability}
                    hasFamily={userType === 'Family'}
                    childrenCount={formValues?.numberOfChildren || nannyProfile?.numberOfChildren}
                    whereCare={formValues?.whereCare || nannyProfile?.whereCare}
                    status={undefined}
                    handleMatchRequest={() => { }}
                  />
                </div>
              ) : (
                <div className="flex-1 w-full bg-[#f8f9fb] rounded-xl flex items-center justify-center border border-gray-100 p-4 text-gray-400 Livvic-Medium">
                  Preview is hidden. Click the eye icon to view.
                </div>
              )}
            </section>
          </div>

          {/* User Type Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-2">User Type</h2>
            <p className="text-secondary text-sm mb-6 Livvic">This determines the type of questions we show in your profile.</p>
            <p className="Livvic-SemiBold text-primary mb-4">Which best describes you?</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div
                onClick={() => setUserType('Job')}
                className={`p-6 border rounded-xl cursor-pointer transition-all ${userType === 'Job' ? 'border-[#AEC4FF] bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex flex-col h-full relative">
                  <div className="absolute top-0 left-0">
                    {userType === 'Job' ? <CheckCircle2 className="w-6 h-6 text-primary" fill="white" /> : <Circle className="w-6 h-6 text-gray-300" />}
                  </div>
                  <div className="flex flex-col items-center text-center mt-2">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                      <Users className="w-6 h-6 text-[#AEC4FF]" />
                    </div>
                    <h3 className="Livvic-SemiBold text-primary mb-2">I'm looking for a nanny share position</h3>
                    <p className="text-sm text-gray-500 Livvic">Get matched with two compatible families and explore nanny share roles.</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setUserType('Family')}
                className={`p-6 border rounded-xl cursor-pointer transition-all ${userType === 'Family' ? 'border-[#AEC4FF] bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex flex-col h-full relative">
                  <div className="absolute top-0 left-0">
                    {userType === 'Family' ? <CheckCircle2 className="w-6 h-6 text-green-600" fill="white" /> : <Circle className="w-6 h-6 text-gray-300" />}
                  </div>
                  <div className="flex flex-col items-center text-center mt-2">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="Livvic-SemiBold text-primary mb-2">I already work with a family and want to add a share</h3>
                    <p className="text-sm text-gray-500 Livvic">Add a second family to your current role and earn more through nanny share.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-primary Livvic-Medium h-fit self-center lg:self-center mt-4 lg:mt-0">
                <Info className="w-5 h-5 shrink-0 text-[#AEC4FF]" />
                <p>Tip: You can update your user type anytime. Your profile and matches will update automatically.</p>
              </div>
            </div>
          </section>

          {/* Basic Information Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Form.Item name="fullName" initialValue={user?.name} label="Full Name">
                <Input className="Livvic-Medium rounded-xl border-gray-200 py-3 focus:border-primary" />
              </Form.Item>

              <Form.Item name="email" initialValue={user?.email} label="Email Address">
                <Input type="email" className="Livvic-Medium rounded-xl border-gray-200 py-3 focus:border-primary" />
              </Form.Item>

              <Form.Item name="location" label="Address" rules={[{ required: true }]}>
                <div className="relative">
                  <Spin spinning={loading} size="small">
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
                  </Spin>
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                </div>
              </Form.Item>

              <Form.Item name="zipCode" label="Zip Code">
                <Input
                  className="Livvic-Medium rounded-xl border-gray-200 py-3"
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </Form.Item>

              <Form.Item name="gender" initialValue={user?.gender} label="Gender">
                <Select className="h-12 w-full rounded-xl border-gray-200" placeholder="Select gender">
                  <Select.Option value="Male">Male</Select.Option>
                  <Select.Option value="Female">Female</Select.Option>
                  <Select.Option value="Other">Other</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="age" initialValue={user?.age} label="Age">
                <Input type="number" className="Livvic-Medium rounded-xl border-gray-200 py-3" />
              </Form.Item>
            </div>
          </section>

          {/* Languages Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
              <Languages className="w-5 h-5" /> Languages
            </h2>
            <OptionSelector options={options} form={form} defaultCheckedValues={defaultCheckedValues} name="language" />
          </section>

          {/* Weekly Schedule Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="Livvic-Bold text-lg text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Weekly Availability
              </h2>
              <p className="text-secondary text-sm Livvic">Select your working days and hours.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {daysOfWeek.map((day) => (
                <div key={day} className={`p-4 rounded-2xl border transition-all ${daysState[day].checked ? 'bg-primary/5 border-primary shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <Checkbox checked={daysState[day].checked} onChange={() => handleCheckboxChange(day)}>
                      <span className="Livvic-SemiBold text-primary">{day}</span>
                    </Checkbox>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <TimePicker
                        value={daysState[day].start ? parseTime(daysState[day].start) : null}
                        placeholder="Start"
                        onChange={(time) => handleTimeChange(day, "start", time)}
                        disabled={!daysState[day].checked}
                        format="h:mm A"
                        className="rounded-lg border-gray-200 w-full"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <TimePicker
                        value={daysState[day].end ? parseTime(daysState[day].end) : null}
                        placeholder="End"
                        onChange={(time) => handleTimeChange(day, "end", time)}
                        disabled={!daysState[day].checked}
                        format="h:mm A"
                        className="rounded-lg border-gray-200 w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>



          {/* Nanny Share Pricing Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Nanny Share Rates
            </h2>
            <p className="text-secondary text-sm mb-6 Livvic">Set your nanny share specific rates for shared care vs solo care.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Form.Item name="rateType" label="Rate Billing Type">
                <Select
                  className="h-12 w-full rounded-xl"
                  value={rateType}
                  onChange={(val) => {
                    setRateType(val);
                    form.setFieldsValue({ rateType: val, sharedRate: undefined, soloRate: undefined });
                  }}
                  options={[
                    { value: "hourly", label: "Hourly Rate" },
                    { value: "weekly", label: "Weekly Rate" }
                  ]}
                />
              </Form.Item>

              <Form.Item name="sharedRate" label="Shared Care Rate (Both Families)">
                <Select
                  className="h-12 w-full rounded-xl"
                  placeholder="Select shared rate range"
                  options={RANGES[rateType]?.shared || []}
                />
              </Form.Item>

              <Form.Item name="soloRate" label="Solo Care Rate (One Family)">
                <Select
                  className="h-12 w-full rounded-xl"
                  placeholder="Select solo rate range"
                  options={RANGES[rateType]?.solo || []}
                />
              </Form.Item>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6">
              <h3 className="Livvic-SemiBold text-primary mb-4 text-[16px]">Salary Expectations (Rate Per Child)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <Form.Item name="firstChild" label="1st Child ($)">
                  <Input type="number" className="h-12 w-full rounded-xl border-gray-200" placeholder="e.g. 20" />
                </Form.Item>
                <Form.Item name="secChild" label="2nd Child ($)">
                  <Input type="number" className="h-12 w-full rounded-xl border-gray-200" placeholder="e.g. 25" />
                </Form.Item>
                <Form.Item name="thirdChild" label="3rd Child ($)">
                  <Input type="number" className="h-12 w-full rounded-xl border-gray-200" placeholder="e.g. 30" />
                </Form.Item>
                <Form.Item name="fourthChild" label="4th Child ($)">
                  <Input type="number" className="h-12 w-full rounded-xl border-gray-200" placeholder="e.g. 35" />
                </Form.Item>
                <Form.Item name="fiveOrMoreChild" label="5+ Children ($)">
                  <Input type="number" className="h-12 w-full rounded-xl border-gray-200" placeholder="e.g. 40" />
                </Form.Item>
              </div>
            </div>
          </section>

          {/* Share Compatibility / Current Setup Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            {userType === 'Job' ? (
              <>
                <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Nanny Share Compatibility
                </h2>
                <p className="text-secondary text-sm mb-6 Livvic">Configure your preferences and experiences with nanny sharing.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Form.Item name="shareExperience" label="Have you worked in a nanny share before?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                      <Select.Option value="Yes">Yes</Select.Option>
                      <Select.Option value="No">No</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="multiFamilyComfort" label="Are you comfortable caring for children from multiple families?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                      <Select.Option value="Yes">Yes</Select.Option>
                      <Select.Option value="No">No</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="childrenCapacity" label="What number of children are you most comfortable caring for?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select capacity">
                      <Select.Option value="1-2">1-2 children</Select.Option>
                      <Select.Option value="2-3">2-3 children</Select.Option>
                      <Select.Option value="3-4">3-4 children</Select.Option>
                      <Select.Option value="Flexible">Flexible</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="workSetup" label="Are you okay working in:">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select work setup">
                      <Select.Option value="One home">One home</Select.Option>
                      <Select.Option value="Rotating homes">Rotating homes</Select.Option>
                      <Select.Option value="Either">Either</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="preferredAges" className="col-span-1 md:col-span-2" label="What ages do you prefer to work with?">
                    <Select
                      mode="multiple"
                      className="w-full rounded-xl"
                      placeholder="Select preferred ages"
                      options={[
                        { value: "Infants (0–1)", label: "Infants (0–1)" },
                        { value: "Toddlers (1–3)", label: "Toddlers (1–3)" },
                        { value: "Preschool (3–5)", label: "Preschool (3–5)" },
                        { value: "School-age (5+)", label: "School-age (5+)" }
                      ]}
                    />
                  </Form.Item>
                </div>
              </>
            ) : (
              <>
                <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Current Setup
                </h2>
                <p className="text-secondary text-sm mb-6 Livvic">Tell us about the family you currently work with.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Form.Item name="forWho" label="Who is this nanny share for?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
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

                  <Form.Item name="whereCare" label="Where would care take place?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                      <Select.Option value="Current family's home">Current family's home</Select.Option>
                      <Select.Option value="Other family's home">Other family's home</Select.Option>
                      <Select.Option value="Rotating between homes">Rotating between homes</Select.Option>
                      <Select.Option value="Neutral location">Neutral location</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="currentSchedule" label="What schedule are you currently working?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select schedule">
                      {SHARE_SCHEDULES.map((schedule) => (
                        <Select.Option key={schedule} value={schedule}>{schedule}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item name="joinTiming" label="When would a second family join?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select timing">
                      <Select.Option value="Same schedule">Same schedule</Select.Option>
                      <Select.Option value="Partially overlapping">Partially overlapping</Select.Option>
                      <Select.Option value="Filling gaps">Filling gaps</Select.Option>
                      <Select.Option value="Flexible">Flexible</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="together" label="Would the children be together at the same time?">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                      <Select.Option value="Yes">Yes</Select.Option>
                      <Select.Option value="Sometimes">Sometimes</Select.Option>
                      <Select.Option value="No">No</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name="hourlyBudget" initialValue={nannyProfile?.hourlyBudget ? deparseHourlyRate(typeof nannyProfile.hourlyBudget === 'string' ? JSON.parse(nannyProfile.hourlyBudget) : nannyProfile.hourlyBudget) : undefined} label="Hourly Budget Split">
                    <Select className="h-12 w-full rounded-xl" placeholder="Select budget">
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
              </>
            )}
          </section>

          {/* Expectations, Roles & Transport Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Expectations & Safety
            </h2>
            <p className="text-secondary text-sm mb-6 Livvic">Add trust signals and clarify what chores or responsibilities you support.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Form.Item name="hasTransport" label="Do you have your own reliable transportation?">
                <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                  <Select.Option value="Yes">Yes</Select.Option>
                  <Select.Option value="No">No</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="backgroundCheck" label="Are you open to undergoing a background check?">
                <Select className="h-12 w-full rounded-xl" placeholder="Select answer">
                  <Select.Option value="Yes">Yes</Select.Option>
                  <Select.Option value="No">No</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="householdHelp" className="col-span-1 md:col-span-2" label="Are you open to helping with household tasks?">
                <Select className="h-12 w-full rounded-xl" placeholder="Select option">
                  <Select.Option value="Yes — both child-related and family-related">Yes — both child-related and family-related</Select.Option>
                  <Select.Option value="Child-related tasks only">Child-related tasks only</Select.Option>
                  <Select.Option value="No — childcare only">No — childcare only</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="responsibilities" className="col-span-1 md:col-span-2" label="What would your role typically include?">
                <Select
                  mode="multiple"
                  className="w-full rounded-xl"
                  placeholder="Select typical responsibilities"
                  options={[
                    { value: "Childcare", label: "Childcare" },
                    { value: "Meal/snack prep", label: "Meal/snack prep" },
                    { value: "Educational activities", label: "Educational activities" },
                    { value: "Outdoor play", label: "Outdoor play" },
                    { value: "Transportation", label: "Transportation" },
                    { value: "Homework help", label: "Homework help" },
                    { value: "Nap/bedtime routines", label: "Nap/bedtime routines" }
                  ]}
                />
              </Form.Item>
            </div>
          </section>

          {/* Professional Details Section */}
          <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-gray-100">
            <h2 className="Livvic-Bold text-lg text-primary mb-6 flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Professional Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Form.Item name="avaiForWorking" initialValue={defaultCheckedValues2} label="Availability">
                <Select className="h-12 w-full rounded-xl" options={options2} />
              </Form.Item>
              <Form.Item name="availability" label="Start Availability" initialValue={getValidDate(defaultCheckedValues3)}>
                <DatePicker className="h-12 w-full rounded-xl border-gray-200" format="MMMM D, YYYY" />
              </Form.Item>
              <Form.Item name="experience" initialValue={defaultCheckedValues4} label="Years of Experience">
                <Select className="h-12 w-full rounded-xl" options={options4} />
              </Form.Item>
            </div>

            <div className="mt-8">
              <label className="Livvic-Bold text-primary mb-4 block flex items-center gap-2">
                <Baby className="w-4 h-4" /> Age Group Experience
              </label>
              <OptionSelector options={options5} defaultCheckedValues={defaultCheckedValues5} form={form} name="ageGroupsExp" />
            </div>

            <div className="mt-8">
              <label className="Livvic-Bold text-primary mb-4 block flex items-center gap-2">
                <FileText className="w-4 h-4" /> About Me / Bio
              </label>
              <Form.Item name="jobDescription" initialValue={user?.additionalInfo.find((i) => i.key === "jobDescription")?.value}>
                <TextArea
                  rows={6}
                  placeholder="Tell families about your approach, skills, and background..."
                  className="rounded-2xl border-gray-200 p-4 Livvic focus:ring-primary/20 transition-all"
                />
              </Form.Item>
            </div>

            <div className="mt-8">
              <label className="Livvic-Bold text-primary mb-4 block">Certifications</label>
              <OptionSelector options={options6} defaultCheckedValues={nannyProfile?.certifications || defaultCheckedValues6} form={form} name="certifications" />
            </div>

            <div className="mt-8">
              <label className="Livvic-Bold text-primary mb-4 block">Additional Certifications & Training</label>
              <Form.Item name="customCertifications" initialValue={nannyProfile?.customCertifications}>
                <Input placeholder="E.g., Water Safety Instructor" className="Livvic-Medium rounded-xl border-gray-200 py-3 focus:border-primary" />
              </Form.Item>
            </div>

            <div className="mt-8">
              <label className="Livvic-Bold text-primary mb-4 block">Special Skills</label>
              <Form.Item name="skills" initialValue={nannyProfile?.skills}>
                <Input placeholder="E.g., Sign Language, Music" className="Livvic-Medium rounded-xl border-gray-200 py-3 focus:border-primary" />
              </Form.Item>
            </div>
          </section>

          {/* Bottom Actions for Mobile */}
          <div className="md:hidden flex flex-col gap-3 mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary Livvic-Bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Save Changes
            </button>
            <NavLink to="/nanny/profile">
              <button className="w-full bg-white text-secondary border border-gray-200 Livvic-Bold py-4 rounded-2xl">
                Discard Changes
              </button>
            </NavLink>
          </div>
        </Form>
      </div>
    </div>
  );
}
