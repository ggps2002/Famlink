import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchNannyShareByIdThunk,
  updateNannyShareThunk,
} from "@features/nanny-share/store/nannyShareSlice";
import Loader from "@shared/ui/Loader";
import CustomButton from "@shared/ui/Button";
import { Input, Select, Checkbox, TimePicker, Form, Space } from "antd";
import StartEndDatePicker from "@features/nanny-share/post/StartEndDatePicker";
import OnboardingDaySelector from "@features/onboarding/components/OnboardingDaySelector";
import SelectChildrenAge from "@features/nanny-share/post/SelectChildrenAge";
import { fireToastMessage } from "@shared/ui/toast";

// Ant Design's TimePicker is backed by dayjs and calls dayjs-only methods
// (e.g. .locale()) on its value. Passing a moment object crashes rc-picker,
// so convert to dayjs here to match what TimePicker expects.
import dayjs from "dayjs";
import { SHARE_SCHEDULES, normalizeShareSchedule } from "@shared/lib/scheduleFormat";

const parseTime = (time) => (time ? dayjs(time) : null);

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ── Option lists (values match DB exactly) ───────────────────────────────────
// ── Option lists (Q1–Q17 from official form spec) ────────────────────────────

// Q1
// Two options, stored in the one spelling the rest of the app uses. The five
// that used to sit here — pickup/drop-off, after-school, summer/seasonal,
// weekend, other — described services the product does not offer, and this form
// additionally stored them lowercased, giving the same share a third spelling.
const SHARE_TYPE_OPTIONS = SHARE_SCHEDULES.map((value) => ({ value, label: value }));

// Q1B
const HAS_NANNY_OPTIONS = [
  { value: "yes – we already have a nanny", label: "Yes – we already have a nanny" },
  { value: "no – we are looking for a nanny", label: "No – we are looking for a nanny" },
  { value: "not sure / open to either", label: "Not sure / open to either" },
];

// Q1C
const SHARE_LOCATION_OPTIONS = [
  { value: "near our home / in our neighborhood", label: "Near our home / in our neighborhood" },
  { value: "nearby neighborhoods within ~10–15 minutes", label: "Nearby neighborhoods within ~10–15 minutes" },
  { value: "anywhere in the city that's reasonably close", label: "Anywhere in the city that's reasonably close" },
  { value: "near my workplace", label: "Near my workplace" },
];

// Q3
const FLEXIBILITY_OPTIONS = [
  { value: "very flexible", label: "Very flexible" },
  { value: "somewhat flexible", label: "Somewhat flexible" },
  { value: "not flexible", label: "Not flexible" },
];

// Q3B
const NANNY_SHARE_START_OPTIONS = [
  { value: "within the next month", label: "Within the next month" },
  { value: "in 1–3 months", label: "In 1–3 months" },
  { value: "in 3+ months / flexible", label: "In 3+ months / flexible" },
];

// Q3C
const URGENCY_OPTIONS = [
  { value: "urgent – i need care soon", label: "Urgent – I need care soon" },
  { value: "actively looking", label: "Actively looking" },
  { value: "just exploring", label: "Just exploring" },
];

// Q4
const HOSTING_OPTIONS = [
  { value: "my home", label: "My home" },
  { value: "other family's home", label: "Other family's home" },
  { value: "rotating between homes", label: "Rotating between homes" },
  { value: "neutral location (e.g., school pickup spot)", label: "Neutral location (e.g., school pickup spot)" },
];

// Q8
const ALLERGIES_OPTIONS = [
  { value: "food allergies", label: "Food allergies" },
  { value: "environmental allergies", label: "Environmental allergies" },
  { value: "asthma", label: "Asthma" },
  { value: "medication needs", label: "Medication needs" },
  { value: "none", label: "None" },
];

// Q – Child responsibilities (Page 4)
const RESPONSIBILITIES_OPTIONS = [
  { value: "transportation", label: "Transportation" },
  { value: "educational activities", label: "Educational activities" },
  { value: "outdoor play", label: "Outdoor play" },
  { value: "storytime / reading", label: "Storytime / reading" },
  { value: "meal/snack prep for kids", label: "Meal/snack prep for kids" },
  { value: "homework help", label: "Homework help" },
  { value: "nap/bedtime support", label: "Nap/bedtime support" },
  { value: "not applicable", label: "Not applicable" },
];

// Q – Household add-ons (Page 4)
const HOUSEHOLD_ADDONS_OPTIONS = [
  { value: "light housekeeping", label: "Light housekeeping" },
  { value: "grocery shopping", label: "Grocery shopping" },
  { value: "errands", label: "Errands" },
  { value: "meal preparation for family", label: "Meal preparation for family" },
  { value: "not applicable", label: "Not applicable" },
];

// Q9
const PARENTING_STYLE_OPTIONS = [
  { value: "montessori", label: "Montessori" },
  { value: "attachment parenting", label: "Attachment parenting" },
  { value: "rie", label: "RIE" },
  { value: "authoritative", label: "Authoritative" },
  { value: "permissive", label: "Permissive" },
  { value: "strict", label: "Strict" },
  { value: "flexible", label: "Flexible" },
  { value: "other", label: "Other" },
];

// Q10
const HOUSE_RULES_OPTIONS = [
  { value: "screen time limits", label: "Screen time limits" },
  { value: "dietary restrictions", label: "Dietary restrictions" },
  { value: "behavior expectations", label: "Behavior expectations" },
  { value: "hygiene practices", label: "Hygiene practices" },
  { value: "chore responsibilities", label: "Chore responsibilities" },
  { value: "other", label: "Other" },
];

// Q11
const DAILY_ROUTINE_OPTIONS = [
  { value: "nap times", label: "Nap times" },
  { value: "outdoor play", label: "Outdoor play" },
  { value: "educational activities", label: "Educational activities" },
  { value: "structured meal times", label: "Structured meal times" },
  { value: "storytime", label: "Storytime" },
  { value: "arts & crafts", label: "Arts & crafts" },
  { value: "playdates/outings", label: "Playdates/outings" },
  { value: "not applicable", label: "Not applicable" },
];

// Q13
const PETS_OPTIONS = [
  { value: "no pets", label: "No pets" },
  { value: "dog(s)", label: "Dog(s)" },
  { value: "cat(s)", label: "Cat(s)" },
  { value: "small animals", label: "Small animals" },
  { value: "birds", label: "Birds" },
  { value: "other", label: "Other" },
];

// Q14
const COMMUNICATION_OPTIONS = [
  { value: "group chat", label: "Group chat" },
  { value: "shared calendar", label: "Shared calendar" },
  { value: "email updates", label: "Email updates" },
  { value: "phone calls", label: "Phone calls" },
  { value: "regular in-person meetings", label: "Regular in-person meetings" },
  { value: "other", label: "Other" },
];

// Q15
const BACKUP_CARE_OPTIONS = [
  { value: "family members", label: "Family members" },
  { value: "backup nanny service", label: "Backup nanny service" },
  { value: "friends or neighbors", label: "Friends or neighbors" },
  { value: "local daycare", label: "Local daycare" },
  { value: "no backup options", label: "No backup options" },
  { value: "other", label: "Other" },
];

// Q16
const INVOLVEMENT_OPTIONS = [
  { value: "very involved", label: "Very involved" },
  { value: "moderately involved", label: "Moderately involved" },
  { value: "minimal involvement", label: "Minimal involvement" },
];

// ── Component ────────────────────────────────────────────────────────────────
function EditNannyShare() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, isLoading } = useSelector((state) => state.postNannyShare);
  const [selectedValue, setSelectedValue] = useState(null);
  const updateSelectedValue = (updatedSelectedValue) => {
    setSelectedValue(updatedSelectedValue);
  };

  const [daysState, setDaysState] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = { checked: false, start: null, end: null };
      return acc;
    }, {})
  );

  const [form] = Form.useForm();

  const [seasonalStart, setSeasonalStart] = useState(null);
  const [seasonalEnd, setSeasonalEnd] = useState(null);

  // Watch fields needed for conditional "specify" inputs
  const communicationPreference = Form.useWatch("communicationPreference", form);
  const backupCare = Form.useWatch("backupCare", form);
  const shareLocation = Form.useWatch("shareLocation", form);
  const parentingStyle = Form.useWatch("parentingStyle", form);
  const houseRules = Form.useWatch("houseRules", form);
  const pets = Form.useWatch("pets", form);
  const allergiesHealth = Form.useWatch("allergiesHealth", form);
  const nannyShareType = Form.useWatch("nannyShareType", form);

  useEffect(() => {
    dispatch(fetchNannyShareByIdThunk(id));
  }, [dispatch, id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!data) return;

    const iv = {};

    // Share type. Normalised on the way in, so a share stored as "Full-time
    // care", "full-time care" or one of the retired types preselects the option
    // that is actually offered instead of showing an empty Select.
    const storedType = data.nannyShareType || data.otherShareTypeSpecify;
    if (storedType) iv.nannyShareType = normalizeShareSchedule(storedType);

    // Basic fields
    if (data.flexibility) iv.flexibility = data.flexibility;
    if (data.hostingPreference) iv.hostingPreference = data.hostingPreference;
    if (data.hasNanny) iv.hasNanny = data.hasNanny;

    // Children
    if (data.numberOfChildren != null) {
      iv.numberOfChildren = data.numberOfChildren;
      setSelectedValue(data.numberOfChildren);
    }
    if (data.childrenAges?.length) iv.childrenAges = data.childrenAges;
    // childrenSchools can be "" — always set if key exists
    if ("childrenSchools" in data) iv.childrenSchools = data.childrenSchools;

    // Allergies
    if (data.allergiesHealth?.length) iv.allergiesHealth = data.allergiesHealth;
    // allergiesHealthSpecify can be ""
    if ("allergiesHealthSpecify" in data) iv.allergiesHealthSpecify = data.allergiesHealthSpecify;

    // Communication
    if (data.communicationPreference) iv.communicationPreference = data.communicationPreference;
    // communicationSpecify can be ""
    if ("communicationSpecify" in data) iv.communicationSpecify = data.communicationSpecify;

    // Backup care
    if (data.backupCare) iv.backupCare = data.backupCare;
    // backupCareSpecify can be ""
    if ("backupCareSpecify" in data) iv.backupCareSpecify = data.backupCareSpecify;

    // Involvement — can be ""
    if ("involvementLevel" in data) iv.involvementLevel = data.involvementLevel;

    // Share location
    if (data.shareLocation?.length) iv.shareLocation = data.shareLocation;
    if (data.specifyNearbyWorkplace) iv.specifyNearbyWorkplace = data.specifyNearbyWorkplace;

    // Timeline
    if (data.nannyshareStart) iv.nannyshareStart = data.nannyshareStart;
    if (data.urgency) iv.urgency = data.urgency;

    // Responsibilities / add-ons
    if (data.childResponsibilities?.length) iv.childResponsibilities = data.childResponsibilities;
    if (data.householdAddOns?.length) iv.householdAddOns = data.householdAddOns;

    // Parenting style
    if (data.parentingStyle?.length) iv.parentingStyle = data.parentingStyle;
    if (data.parentingStyleSpecify) iv.parentingStyleSpecify = data.parentingStyleSpecify;

    // House rules
    if (data.houseRules?.length) iv.houseRules = data.houseRules;
    if (data.houseRulesSpecify) iv.houseRulesSpecify = data.houseRulesSpecify;

    // Daily routine
    if (data.dailyRoutine?.length) iv.dailyRoutine = data.dailyRoutine;

    // Pets
    if (data.pets?.length) iv.pets = data.pets;
    if (data.petsSpecify) iv.petsSpecify = data.petsSpecify;

    // Budget
    // Only the share: `min`/`max` is the caregiver's full rate for the share and
    // this form no longer asks a family for it.
    if (data.hourlyBudget) {
      iv.hourlyBudget = {
        minShare: data.hourlyBudget.minShare,
        maxShare: data.hourlyBudget.maxShare,
      };
    }
    if (data.hourlyBudgetSpecify) iv.hourlyBudgetSpecify = data.hourlyBudgetSpecify;

    // Notes / description
    if (data.careDescription) iv.careDescription = data.careDescription;
    if (data.openNotes) iv.openNotes = data.openNotes;

    // Seasonal dates — managed via local state only, NOT via form fields
    // to avoid Ant Design's date validator expecting dayjs/moment objects
    if (data.Seasonal?.startDate) {
      setSeasonalStart(new Date(data.Seasonal.startDate));
    }
    if (data.Seasonal?.endDate) {
      setSeasonalEnd(new Date(data.Seasonal.endDate));
    }

    // Schedule days
    if (data.specificDays) {
      setDaysState(
        Object.fromEntries(
          daysOfWeek.map((day) => [
            day,
            {
              checked: data.specificDays[day]?.checked || false,
              start: data.specificDays[day]?.start
                ? parseTime(data.specificDays[day].start)
                : null,
              end: data.specificDays[day]?.end
                ? parseTime(data.specificDays[day].end)
                : null,
            },
          ])
        )
      );
    }

    form.setFieldsValue(iv);
  }, [data, form]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleFinish = async (values) => {
    try {
      const childrenAges = Object.entries(values)
        .filter(([key, val]) => key.includes("_age") && val)
        .map(([key, ageStr]) => {
          const childIndex = key.split("_")[0];
          const unitKey = `${childIndex}_unit`;
          const unit = values[unitKey] || "years";
          const num = Number(ageStr);

          if (isNaN(num) || num <= 0) {
            fireToastMessage({
              type: "error",
              message: `Each child's age must be greater than 0`,
            });
            throw new Error("stop-processing");
          }

          return unit === "months" ? `${(num / 12).toFixed(2)} yrs` : `${num} yrs`;
        });

      const selectedDays = Object.entries(daysState).filter(
        ([, { checked }]) => checked
      );

      if (selectedDays.length === 0) {
        fireToastMessage({ type: "error", message: "Atleast select one day and time." });
        return;
      }

      let allValid = true;
      let invalidDays = [];

      selectedDays.forEach(([day, { start, end }]) => {
        if (!start || !end) {
          allValid = false;
          invalidDays.push(day);
        } else if (start.isSame(end) || end.isBefore(start)) {
          allValid = false;
          invalidDays.push(day);
        }
      });

      if (!allValid) {
        fireToastMessage({
          type: "error",
          message: `Invalid start/end times for: ${invalidDays.join(", ")}`,
        });
        return;
      }

      const checkedDays = Object.entries(daysState)
        .filter(([, d]) => d.checked)
        .reduce((acc, [day, d]) => {
          // d.start / d.end are dayjs objects (from parseTime / TimePicker) —
          // dayjs.isDayjs() guards against any raw value slipping through
          acc[day] = {
            ...d,
            start: dayjs.isDayjs(d.start) ? d.start.toISOString() : new Date(d.start).toISOString(),
            end: dayjs.isDayjs(d.end) ? d.end.toISOString() : new Date(d.end).toISOString(),
          };
          return acc;
        }, {});

      const updatePayload = {
        ...values,
        childrenAges,
        numberOfChildren: childrenAges.length,
        Seasonal: {
          startDate: seasonalStart instanceof Date ? seasonalStart.toISOString() : seasonalStart,
          endDate: seasonalEnd instanceof Date ? seasonalEnd.toISOString() : seasonalEnd,
        },
        specificDays: checkedDays,
      };

      // Strip raw Child age/unit keys
      Object.keys(updatePayload).forEach((key) => {
        if (key.includes("Child") && (key.includes("_age") || key.includes("_unit"))) {
          delete updatePayload[key];
        }
      });

      const { message } = await dispatch(
        updateNannyShareThunk({ id, body: updatePayload })
      ).unwrap();
      fireToastMessage({ message });
      navigate(-1);
    } catch (err) {
      if (err.message !== "stop-processing") console.error(err);
    }
  };

  if (isLoading || !data) return <Loader />;

  // ── Segment helpers (derived from live form value so edits reflect instantly) ──
  const shareType = nannyShareType || data.nannyShareType || "";
  const isFullOrPart = ["full-time care", "part-time care", "weekend nanny share"].includes(shareType);
  const isPickupDropoff = shareType === "pickup/drop-off (carpool style)";
  const isAfterSchool = shareType === "after-school care";
  const isSeasonal = shareType === "summer/seasonal";
  const isOther = shareType === "other";

  // Fields shown for ALL segments
  const showScheduleDays = !isSeasonal;
  const showSeasonalDates = isSeasonal;
  const showFlexibility = true;
  const showHosting = true;
  const showBudget = true;
  const showCommunication = true;
  const showOpenNotes = true;

  // Segment-specific visibility
  const showChildren = !isOther;
  const showSchools = isFullOrPart || isAfterSchool;
  const showAllergies = !isOther;
  const showParentingStyle = isFullOrPart;
  const showResponsibilities = isFullOrPart || isAfterSchool || isSeasonal;
  const showHouseholdAddons = isFullOrPart; // skipped for pickup, after-school, seasonal
  const showDailyRoutine = isFullOrPart || isSeasonal;
  const showHouseRules = isFullOrPart || isPickupDropoff || isAfterSchool;
  const showPets = isFullOrPart;
  const showBackupCare = !isOther;
  const showInvolvement = isFullOrPart;
  const showCareDescription = isOther; // "Other" gets free-text description

  // Responsibilities options differ by segment
  const RESPONSIBILITIES_BY_SEGMENT = isAfterSchool
    ? [
      { value: "transportation", label: "Transportation" },
      { value: "meal/snack prep for kids", label: "Snacks/meal prep" },
      { value: "homework help", label: "Homework help" },
      { value: "educational activities", label: "Educational activities" },
      { value: "outdoor play", label: "Outdoor / active play" },
      { value: "not applicable", label: "Not applicable" },
    ]
    : isSeasonal
      ? [
        { value: "educational activities", label: "Educational activities" },
        { value: "outdoor play", label: "Outdoor play / outings" },
        { value: "meal/snack prep for kids", label: "Meals / snacks" },
        { value: "storytime / reading", label: "Storytime / reading" },
        { value: "arts & crafts / enrichment", label: "Arts & crafts / enrichment" },
        { value: "not applicable", label: "Not applicable" },
      ]
      : RESPONSIBILITIES_OPTIONS; // full list for full-time / part-time / weekend

  // House rules options differ for pickup/drop-off
  const HOUSE_RULES_BY_SEGMENT = isPickupDropoff
    ? [
      { value: "seatbelts always", label: "Seatbelts always" },
      { value: "no food in car", label: "No food in car" },
      { value: "screen use in car", label: "Screen use in car" },
      { value: "behavior expectations", label: "Behavior expectations" },
      { value: "other", label: "Other" },
    ]
    : HOUSE_RULES_OPTIONS;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="padding-navbar1 w-full flex flex-col items-center">
      <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px]">
        <h1 className="Livvic-SemiBold text-2xl text-primary mb-6">
          Edit Nanny Share
        </h1>
        <Form layout="vertical" form={form} onFinish={handleFinish} className="space-y-4">

          {/* ══ PAGE 1 · BASIC INFO ══════════════════════════════════════════ */}

          {/* Q1 – Share Type */}
          <Form.Item label="Type of Nanny Share" name="nannyShareType">
            <Select options={SHARE_TYPE_OPTIONS} />
          </Form.Item>

          {/* Q1B – Has nanny (NEW — always shown) */}
          <Form.Item label="Do you already have a nanny?" name="hasNanny">
            <Select options={HAS_NANNY_OPTIONS} placeholder="Select an option" />
          </Form.Item>

          {/* Q1C – Share location (NEW — always shown) */}
          <Form.Item label="Where are you open to the nanny share taking place?" name="shareLocation">
            <Select mode="multiple" options={SHARE_LOCATION_OPTIONS} placeholder="Select all that apply" />
          </Form.Item>
          {(shareLocation?.includes("near my workplace") || data.specifyNearbyWorkplace) && (
            <Form.Item label="Work location or nearest major intersection" name="specifyNearbyWorkplace">
              <Input placeholder="e.g. Downtown SF, Market & 5th" />
            </Form.Item>
          )}

          {/* Q3B – Start timeline (NEW — always shown) */}
          <Form.Item label="When do you want to start the nanny share?" name="nannyshareStart">
            <Select options={NANNY_SHARE_START_OPTIONS} placeholder="Select a timeline" />
          </Form.Item>

          {/* Q3C – Urgency (NEW — always shown) */}
          <Form.Item label="How urgent is your childcare search?" name="urgency">
            <Select options={URGENCY_OPTIONS} placeholder="Select urgency" />
          </Form.Item>

          {/* ══ PAGE 2 · SCHEDULE & HOSTING ══════════════════════════════════ */}
          <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Schedule & Hosting</h2>

          {/* Q2 – Schedule days (skipped for seasonal → use date range instead) */}
          {showScheduleDays && data.specificDays && (
            <OnboardingDaySelector
              daysState={daysState}
              setDaysState={setDaysState}
              head="Days & Times"
              subHead="Select the days and times you need care"
            />
          )}

          {/* Q2 seasonal – date range */}
          {showSeasonalDates && (
            <StartEndDatePicker
              startDate={seasonalStart}
              endDate={seasonalEnd}
              setStartDate={setSeasonalStart}
              setEndDate={setSeasonalEnd}
            />
          )}
          {/* seasonal also shows weekly days/times */}
          {isSeasonal && data.specificDays && (
            <OnboardingDaySelector
              daysState={daysState}
              setDaysState={setDaysState}
              head="Weekly Days & Times"
              subHead="Which days each week do you need care?"
            />
          )}

          {/* Q3 – Flexibility */}
          {showFlexibility && (
            <Form.Item label="How flexible are you with scheduling?" name="flexibility">
              <Select options={FLEXIBILITY_OPTIONS} />
            </Form.Item>
          )}

          {/* Q4 – Hosting */}
          {showHosting && (
            <Form.Item label="Hosting preference" name="hostingPreference">
              <Select options={HOSTING_OPTIONS} />
            </Form.Item>
          )}

          {/* ══ PAGE 3 · CHILDREN'S DETAILS ══════════════════════════════════ */}
          {showChildren && (
            <>
              <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Children's Details</h2>

              {/* Q5 + Q6 – Number & ages */}
              <SelectChildrenAge
                form={form}
                opt={Array.from({ length: 4 }, (_, i) => i + 1)}
                selectedValue={selectedValue}
                handleSelectChange={updateSelectedValue}
              />

              {/* Q7 – Schools (only for full/part/after-school) */}
              {showSchools && (
                <Form.Item label="Which school(s) do they attend? (optional)" name="childrenSchools">
                  <Input placeholder="e.g. Lincoln Elementary" />
                </Form.Item>
              )}

              {/* Q8 – Allergies */}
              {showAllergies && (
                <>
                  <Form.Item label="Allergies & health considerations" name="allergiesHealth">
                    <Select mode="multiple" options={ALLERGIES_OPTIONS} placeholder="Select all that apply" />
                  </Form.Item>
                  <Form.Item label="Health considerations (specify, optional)" name="allergiesHealthSpecify">
                    <Input placeholder="Describe any specific health needs" />
                  </Form.Item>
                </>
              )}
            </>
          )}

          {/* ══ PAGE 4 · RESPONSIBILITIES ════════════════════════════════════ */}
          {showResponsibilities && (
            <>
              <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Responsibilities</h2>
              <Form.Item label="Child-related responsibilities" name="childResponsibilities">
                <Select mode="multiple" options={RESPONSIBILITIES_BY_SEGMENT} placeholder="Select all that apply" />
              </Form.Item>
            </>
          )}
          {showHouseholdAddons && (
            <Form.Item label="Household add-ons (optional)" name="householdAddOns">
              <Select mode="multiple" options={HOUSEHOLD_ADDONS_OPTIONS} placeholder="Select all that apply" />
            </Form.Item>
          )}

          {/* ══ PAGE 5 · PARENTING STYLE & HOUSE RULES ═══════════════════════ */}
          {(showParentingStyle || showHouseRules) && (
            <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Parenting Style & House Rules</h2>
          )}

          {/* Q9 – Parenting style (full/part/weekend only) */}
          {showParentingStyle && (
            <>
              <Form.Item label="Parenting style or philosophy (optional)" name="parentingStyle">
                <Select mode="multiple" options={PARENTING_STYLE_OPTIONS} placeholder="Select all that apply" />
              </Form.Item>
              {(parentingStyle?.includes("other") || data.parentingStyleSpecify) && (
                <Form.Item label="Parenting style (specify)" name="parentingStyleSpecify">
                  <Input placeholder="Describe your parenting philosophy" />
                </Form.Item>
              )}
            </>
          )}

          {/* Q10 – House rules */}
          {showHouseRules && (
            <>
              <Form.Item label="House rules or guidelines (optional)" name="houseRules">
                <Select mode="multiple" options={HOUSE_RULES_BY_SEGMENT} placeholder="Select all that apply" />
              </Form.Item>
              {(houseRules?.includes("other") || data.houseRulesSpecify) && (
                <Form.Item label="House rules (specify)" name="houseRulesSpecify">
                  <Input placeholder="Describe any specific house rules" />
                </Form.Item>
              )}
            </>
          )}

          {/* ══ PAGE 6 · DAILY ROUTINE ═══════════════════════════════════════ */}
          {showDailyRoutine && (
            <>
              <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Daily Routine / Activities</h2>
              <Form.Item label="Daily routine or activities (optional)" name="dailyRoutine">
                <Select mode="multiple" options={DAILY_ROUTINE_OPTIONS} placeholder="Select all that apply" />
              </Form.Item>
            </>
          )}

          {/* ══ PAGE 7 · BUDGET & PETS ═══════════════════════════════════════ */}
          <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Budget</h2>

          {/* Q12 – Budget */}
          {showBudget && (
            <>
              {/* One rate, and it is this family's own share. The pair that used
                  to sit above these asked for the caregiver's full rate for the
                  whole share — a number a family does not set, and one that read
                  on their profile as a standalone price they were offering. */}
              <p className="Livvic-Medium text-sm text-[#666666] -mt-1 mb-2">
                What your family pays per hour. In a share the caregiver's rate is
                split between both families.
              </p>
              <Space wrap>
                <Form.Item
                  label="Min share ($/hr per family)"
                  name={["hourlyBudget", "minShare"]}
                  rules={[{ required: true, message: "Required" }]}
                >
                  <Input type="number" min={0} />
                </Form.Item>
                <Form.Item label="Max share ($/hr per family)" name={["hourlyBudget", "maxShare"]}>
                  <Input type="number" min={0} />
                </Form.Item>
              </Space>
              {data.hourlyBudgetSpecify && (
                <Form.Item label="Hourly rate (specify, optional)" name="hourlyBudgetSpecify">
                  <Input type="number" min={0} />
                </Form.Item>
              )}
            </>
          )}

          {/* Q13 – Pets (full/part/weekend only) */}
          {showPets && (
            <>
              <Form.Item label="Do you have pets?" name="pets">
                <Select mode="multiple" options={PETS_OPTIONS} placeholder="Select all that apply" />
              </Form.Item>
              {(pets?.includes("other") || data.petsSpecify) && (
                <Form.Item label="Pets (specify)" name="petsSpecify">
                  <Input placeholder="Describe your pets" />
                </Form.Item>
              )}
            </>
          )}

          {/* ══ PAGE 8 · COMMUNICATION & BACKUP ═════════════════════════════ */}
          <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Communication & Backup</h2>

          {/* Q14 – Communication */}
          {showCommunication && (
            <>
              <Form.Item label="Communication preference" name="communicationPreference">
                <Select options={COMMUNICATION_OPTIONS} placeholder="Select preferred method" />
              </Form.Item>
              {(communicationPreference === "other" || data.communicationSpecify) && (
                <Form.Item label="Communication preference (specify)" name="communicationSpecify">
                  <Input placeholder="Describe your preferred communication style" />
                </Form.Item>
              )}
            </>
          )}

          {/* Q15 – Backup care */}
          {showBackupCare && (
            <>
              <Form.Item label="Backup care if nanny is unavailable (optional)" name="backupCare">
                <Select options={BACKUP_CARE_OPTIONS} placeholder="Select an option" />
              </Form.Item>
              {(backupCare === "other" || data.backupCareSpecify) && (
                <Form.Item label="Backup care (specify)" name="backupCareSpecify">
                  <Input placeholder="Describe your backup care arrangement" />
                </Form.Item>
              )}
            </>
          )}

          {/* Q16 – Involvement (full/part/weekend only) */}
          {showInvolvement && (
            <Form.Item label="How involved do you want to be in daily activities?" name="involvementLevel">
              <Select options={INVOLVEMENT_OPTIONS} placeholder="Select involvement level" />
            </Form.Item>
          )}

          {/* ══ PAGE 9 · OPEN NOTES ══════════════════════════════════════════ */}
          <h2 className="Livvic-SemiBold text-lg text-primary pt-2">Open Notes</h2>

          {/* "Other" type – free text description */}
          {showCareDescription && (
            <Form.Item label="Describe the type of care you're looking for" name="careDescription">
              <Input.TextArea rows={3} placeholder="Describe your care needs" />
            </Form.Item>
          )}

          {/* Q17 – Open notes (always shown) */}
          <Form.Item label="Anything else another family should know? (optional)" name="openNotes">
            <Input.TextArea rows={3} placeholder="Languages spoken at home, personality fit, lifestyle notes..." />
          </Form.Item>

          {/* ── Actions ── */}
          <div className="flex gap-2 mt-4">
            <CustomButton
              btnText="Cancel"
              action={() => {
                navigate(-1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="bg-gray-200"
            />
            <CustomButton
              btnText="Save"
              htmlType="submit"
              className="bg-[#AEC4FF]"
            />
          </div>
        </Form>
      </div>
    </div>
  );
}

export default EditNannyShare;