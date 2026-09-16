import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { MapPin, Users, Heart } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import Ra from "@shared/ui/Rate";
import InfoTip from "@shared/ui/InfoTip";
import ProfileReviews from "@features/dashboard/components/ProfileReviews";
import {
  PriceRows,
  ProfileCard,
  ProfileSectionCards,
  ScheduleList,
  SectionTitle,
} from "@features/dashboard/components/profileChrome";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import { addOrRemoveFavouriteThunk } from "@features/dashboard/store/favouriteSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { CompleteProfileModal } from "@features/matching/components/CompleteProfileModal";
import { MatchRequestFormModal } from "@features/matching/components/MatchRequestFormModal";
import { RequestMatchDenied } from "@features/matching/components/RequestMatchDenied";
import { ReferAFriendModal } from "@features/referral/components/ReferAFriendModal";
import { viewCurrentUserProfileThunk } from "@features/nanny-share/store/nannyShareSlice";
import { getMatchGate, MATCH_GATE } from "@features/matching/matchGate";
import { formatStartDate } from "@shared/lib/dates";
import { sentenceCase } from "@shared/lib/toCamelCase";
import { formatCareTypeLabel } from "@shared/lib/scheduleFormat";
import {
  formatEachFamilyRate,
  formatSharedRate,
  formatSoloRate,
  formatStoredRate,
  RATE_HINTS,
} from "@shared/lib/rates";
import { getNannyTheme, getNannyGoal, ShareTypeLabel } from "@features/nanny-share/shareTypeTheme";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";

export default function NannyProfileView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { selectedNanny, isLoading, error } = useSelector((s) => s.nannyData);
  const { user, accessToken } = useSelector((state) => state.auth);

  // The viewer's own profile — hasFamily lives there, and it decides whether
  // this user is on the referral model or the subscription one.
  const { currentProfile } = useSelector((s) => s.postNannyShare);

  const [isMatchRequestDenied, setIsMatchRequestDenied] = React.useState(false);
  const [isReferModal, setIsReferModal] = React.useState(false);
  const [isFavorited, setIsFavorited] = React.useState(false);

  React.useEffect(() => {
    if (user?.favourite && id) {
      setIsFavorited(user.favourite.includes(id));
    }
  }, [user, id]);

  const favourite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!id) return;
    dispatch(addOrRemoveFavouriteThunk({ favouriteUserId: id, accessToken }));
    dispatch(refreshTokenThunk());
    setIsFavorited((prev) => !prev);
  };
  const [isProfileComplete, setIsProfileComplete] = React.useState(false);
  const [senderId, setSenderId] = React.useState(null);
  const [receiverId, setReceiverId] = React.useState(null);
  const [isRequestSubmitModal, setIsRequestSubmitModal] = React.useState(false);

  const handleMatchRequest = () => {
    if (!user.nannyProfileCompleted) {
      setIsProfileComplete(true);
      return;
    }
    // Caregivers looking for a share job refer a friend instead of subscribing.
    const gate = getMatchGate(user, currentProfile);
    if (gate === MATCH_GATE.REFER) {
      setIsReferModal(true);
      return;
    }
    if (gate === MATCH_GATE.SUBSCRIBE) {
      setIsMatchRequestDenied(true);
      return;
    }
    setSenderId(user._id);
    setReceiverId(targetUserId);
    setIsRequestSubmitModal(true);
  };

  useEffect(() => {
    if (id) {
      dispatch(fetchNannyByIdThunk(id));
    }
  }, [dispatch, id]);

  // Both feed the match gate above. This page can be opened straight from a
  // link or an email, so currentProfile isn't guaranteed to be in the store —
  // and the referral fetch refreshes referralMatchingUntil, which otherwise
  // only updates when the access token does.
  useEffect(() => {
    dispatch(viewCurrentUserProfileThunk());
    if (user?.type === "Nanny") dispatch(getMyReferralThunk());
  }, [dispatch, user?.type]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
  }

  if (error || !selectedNanny) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg Livvic-SemiBold text-gray-800">
          {error || "We couldn't load this profile."}
        </p>
        <div className="flex gap-3">
          <CustomButton
            btnText="Try again"
            action={() => id && dispatch(fetchNannyByIdThunk(id))}
            className="bg-primary"
          />
          <CustomButton
            btnText="Go back"
            action={() => navigate(-1)}
            className="bg-white border"
          />
        </div>
      </div>
    );
  }

  // Map backend data to layout
  const profile = selectedNanny?.nannyProfile || {};

  // The person this page is about. Resolved once and used both to address a
  // match request and to decide whether the review panel offers a review, so
  // the two can never disagree about who they mean.
  const targetUserId =
    selectedNanny?.userId?._id || selectedNanny?.userId || selectedNanny?._id || id;

  const totalReviews = selectedNanny?.reviews?.length ?? 0;

  // "About Sheena", not "About Sheena F." — the heading addresses her, while
  // `nanny.name` below is the abbreviated form the rest of the page displays.
  const firstName = (() => {
    const [first = ""] = String(selectedNanny?.name || "").trim().split(/\s+/);
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
  })();

  const formatLocation = () => {
    const raw = selectedNanny?.location?.format_location;
    if (!raw) return "";
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    // Find the "ST 94602" component rather than counting back from the end.
    // Counting assumed "<street>, <city>, <state zip>, <country>", so a
    // coarsened three-part address ("Glenview, Oakland, CA 94602") rendered as
    // "Glenview, Oakland" — a neighbourhood labelled as a state.
    const stateIndex = parts.findIndex((part) => /^[A-Z]{2}\b/.test(part));
    if (stateIndex > 0) {
      return `${parts[stateIndex - 1]}, ${parts[stateIndex].split(" ")[0]}`;
    }
    return raw || "Location not specified";
  };

  const additionalInfoBio = selectedNanny?.additionalInfo?.find(info => info.key === "jobDescription")?.value;

  const rateLabel = profile.rateType === "hourly" ? "hr" : profile.rateType || "hr";

  const getInfo = (key, profileKey) => {
    return profile[profileKey] || selectedNanny?.additionalInfo?.find(info => info.key === key)?.value?.option;
  };

  const formatName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";

    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();

    if (parts.length > 1) {
      const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${firstName} ${lastInitial}.`;
    }
    return firstName;
  };

  const expectedKeys = [
    "careType",
    "startAvailability",
    "careExperience",
    "languages",
    "specificDaysAndTime",
    "shareExperience",
    "multiFamilyComfort",
    "childrenCapacity",
    "preferredAges",
    "workSetup",
    "responsibilities",
    "householdHelp",
    "hasTransport",
    "backgroundCheck",
    "rateType",
    "sharedRate",
    "soloRate",
    "firstAidCert",
    "cprCert",
    "eceCert",
    "trustLineCert",
    "carpool",
    "ageGroupsExp",
    "customCertifications",
    "skills",
    "salaryExp",
    "forWho",
    "numberOfChildren",
    "childrenAges",
    "currentSchedule",
    "joinTiming",
    "together",
    "whereCare"
  ];

  // Map to friendly names if needed or fallback mapping
  const keyMapping = {
    careType: "avaiForWorking",
    startAvailability: "availability",
    careExperience: "experience",
    languages: "language",
  };

  // additionalInfo reaches us in two shapes. Most profiles carry a plain array
  // of { key, value } objects, but sheet-imported "adding a share" caregivers
  // (e.g. currentSchedule / joinTiming / forWho / together) carry a single
  // JSON-stringified array instead: ["[{\"key\":\"currentSchedule\",…}]"].
  // Flatten both into one { key, value } list so a `.find(by key)` resolves
  // either way — otherwise those answers silently render "No details provided"
  // even though the data is present.
  const flatAdditionalInfo = (() => {
    const raw = selectedNanny?.additionalInfo;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (item && typeof item === 'object' && 'key' in item) {
        out.push(item);
      } else if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const p of list) if (p && typeof p === 'object' && 'key' in p) out.push(p);
        } catch { /* non-JSON string — nothing to extract */ }
      }
    }
    return out;
  })();

  const getFallbackValue = (key) => {
    // Intercept certifications which are stored in an array or in additionalDetails
    if (key === 'firstAidCert' || key === 'cprCert' || key === 'eceCert' || key === 'trustLineCert') {
      const searchStr = key === 'firstAidCert' ? 'first aid' :
        key === 'cprCert' ? 'cpr' :
          key === 'eceCert' ? 'early childhood' : 'trustline';

      const certs = profile?.certifications || [];
      const inCerts = certs.some(c => c.toLowerCase().includes(searchStr));

      const profileAddDetails = typeof profile?.additionalDetails === 'string' ? profile.additionalDetails.toLowerCase() : JSON.stringify(profile?.additionalDetails || "").toLowerCase();

      const fallback = flatAdditionalInfo.find(info => info.key === 'additionalDetails');
      const legacyAddDetails = JSON.stringify(fallback?.value || "").toLowerCase();

      return (inCerts || profileAddDetails.includes(searchStr) || legacyAddDetails.includes(searchStr)) ? 'Yes' : 'No';
    }

    // 1. Check profile schema directly
    if (profile && profile[key] !== undefined && profile[key] !== null && profile[key] !== "") {
      return profile[key];
    }
    // 2. Check additionalInfo with the exact key
    let fallback = flatAdditionalInfo.find(info => info.key === key);
    if (fallback) return fallback.value;

    // 3. Check additionalInfo with legacy mapped keys (e.g., careType -> avaiForWorking)
    if (keyMapping[key]) {
      fallback = flatAdditionalInfo.find(info => info.key === keyMapping[key]);
      if (fallback) return fallback.value;
    }
    return null;
  };

  const formatKey = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();

  const formatValue = (key, val) => {
    if (val === false) return "No";

    // "budgetDisplay" is a synthetic key that pulls from other fields; skip the empty check for it.
    if (key !== "budgetDisplay" && (val === null || val === undefined || val === "N A" || val === "null" || (typeof val === 'string' && val.trim() === ''))) {
      return null;
    }

    let parsedVal = val;
    let iterations = 0;
    while (typeof parsedVal === 'string' && (parsedVal.startsWith('{') || parsedVal.startsWith('[')) && iterations < 3) {
      try {
        let temp = JSON.parse(parsedVal);
        if (typeof temp === 'string' && temp === parsedVal) break;
        parsedVal = temp;
      } catch (e) {
        break;
      }
      iterations++;
    }

    // Aggressive fallback for strings that look like arrays but failed parsing (e.g., single quotes)
    if (typeof parsedVal === 'string' && parsedVal.startsWith('[') && parsedVal.endsWith(']')) {
      parsedVal = parsedVal.replace(/[\[\]']/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    }

    if (key === "specificDays" || key === "specificDaysAndTime") {
      try {
        let scheduleObj = parsedVal;
        if (scheduleObj && typeof scheduleObj === 'object' && !Array.isArray(scheduleObj)) {
          const days = Object.keys(scheduleObj).filter(day => scheduleObj[day].checked);
          if (days.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mt-1">
              {days.map(day => {
                const { start, end } = scheduleObj[day];
                let timeStr = "";
                if (start && end) {
                  const s = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const e = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  timeStr = ` (${s} - ${e})`;
                }
                return <span key={day} className="inline-flex items-center gap-1.5 bg-[#E9F8FF] text-[#001243] px-3 py-1 rounded-full text-xs Livvic-Medium border border-[#AEC4FF]">{day}{timeStr}</span>
              })}
            </div>
          );
        }
      } catch (e) { /* ignore */ }
    } else if (key === "childrenAges") {
      if (!Array.isArray(parsedVal)) {
        try { parsedVal = JSON.parse(parsedVal); } catch (e) { parsedVal = [parsedVal]; }
      }
      if (Array.isArray(parsedVal)) {
        return parsedVal.map(age => {
          if (typeof age === 'object' && age !== null && age.label) return age.label;
          let cleanAge = String(age).trim().replace(/[\[\]"']/g, '');
          if (!cleanAge) return null;
          let lower = cleanAge.toLowerCase();
          if (lower.includes("year") || lower.includes("yr") || lower.includes("month") || lower.includes("mo")) {
            return cleanAge;
          }
          return `${cleanAge} years`;
        }).filter(Boolean).join(", ");
      }
      return String(parsedVal);
    } else if (key === "whereCare") {
      if (typeof parsedVal === 'string' && parsedVal.toLowerCase() === "your home") {
        return "My home";
      }
      return parsedVal;
    } else if (key === "salaryExp") {
      let expObj = parsedVal;
      if (typeof parsedVal === 'string') {
        try { expObj = JSON.parse(parsedVal); } catch (e) { }
      }
      if (expObj && typeof expObj === 'object') {
        let parts = [];
        if (expObj.firstChild) parts.push(`1st Child: $${expObj.firstChild}/hr`);
        if (expObj.secChild) parts.push(`2nd Child: $${expObj.secChild}/hr`);
        if (expObj.thirdChild) parts.push(`3rd Child: $${expObj.thirdChild}/hr`);
        if (expObj.fourthChild) parts.push(`4th Child: $${expObj.fourthChild}/hr`);
        if (expObj.fiveOrMoreChild) parts.push(`5+ Children: $${expObj.fiveOrMoreChild}/hr`);
        return parts.length > 0 ? parts.join(" | ") : null;
      }
      return null;
    } else if (key === "budgetDisplay") {
      // 1. For Nannies WITH a family (uses hourlyBudget)
      const budgetObj = getFallbackValue("hourlyBudget");
      if (budgetObj) {
        let share = formatSharedRate(budgetObj);
        let solo = formatSoloRate(budgetObj);
        const specify = getFallbackValue("hourlyBudgetSpecify");
        if (!share && !solo && specify) return `$${specify}/hr`;
        if (!share && !solo) return null;
        return (
          <>
            {solo ? solo.replace('~', '') : null}
            {solo && share && <br />}
            {share ? share.replace('~', '') : null}
          </>
        );
      }
      
      // 2. For Nannies looking for a share (uses sharedRate and soloRate)
      const sRate = getFallbackValue("sharedRate");
      const soloRate = getFallbackValue("soloRate");
      if (sRate || soloRate) {
        return (
          <>
            {sRate ? `$${sRate}/hr` : null}
            {sRate && soloRate && <br />}
            {soloRate ? `$${soloRate}/hr per family` : null}
          </>
        );
      }
      return null;
    } else if (key === "startAvailability") {
      // Stored as an ISO date from the picker, so the detail row printed the raw
      // "2026-07-15T23:00:00.000Z". Route it through the shared formatter →
      // "July 15, 2026"; non-date answers ("Immediately", "Flexible") pass
      // through untouched.
      return formatStartDate(parsedVal);
    } else if (typeof parsedVal === 'object') {
      let arr = [];
      if (Array.isArray(parsedVal)) {
        arr = parsedVal;
      } else if (parsedVal && parsedVal.option) {
        arr = Array.isArray(parsedVal.option) ? parsedVal.option : [parsedVal.option];
      } else {
        return JSON.stringify(parsedVal);
      }

      if (key === 'additionalDetails') {
        arr = arr.filter(s => typeof s === 'string' && !s.toLowerCase().includes('first aid') && !s.toLowerCase().includes('cpr'));
      }

      let res = arr.length > 0 ? arr.map(v => {
        if (v && typeof v === 'object' && v.label) return v.label;
        if (v && typeof v === 'object' && v.value) return v.value;
        return String(v).replace(/[\[\]"]/g, '');
      }).join(", ") : null;
      return typeof res === 'string' ? res.split(',').map(s => s.trim()).join(', ') : res;
    } else if (typeof parsedVal === 'boolean') {
      return parsedVal ? "Yes" : "No";
    }

    if (key === 'additionalDetails' && typeof parsedVal === 'string') {
      const filtered = parsedVal.split(',').map(s => s.trim()).filter(s => !s.toLowerCase().includes('first aid') && !s.toLowerCase().includes('cpr'));
      return filtered.length > 0 ? filtered.join(", ") : null;
    }

    return String(parsedVal).replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).join(', ');
  };

  // Sidebar stat tiles. `nanny.experience` below carries a "…not specified"
  // fallback for the detail rows; a tile with a label above it should simply
  // not appear when there is no number for it.
  const experienceTile = formatValue('careExperience', getFallbackValue('careExperience')) || null;
  // Halved, like the "Shared rate" row below: `sharedRate` is the combined rate
  // for both families, and a tile headed "Shared rate" that shows the whole of
  // it tells a reader they'd pay twice what they will.
  const rateTile = formatEachFamilyRate(profile.sharedRate, `/${rateLabel}`);

  const hasShareExp = formatValue('shareExperience', getFallbackValue('shareExperience'));
  const hasMultiExp = formatValue('multiFamilyComfort', getFallbackValue('multiFamilyComfort'));
  const hasTransp = formatValue('hasTransport', getFallbackValue('hasTransport'));
  const hasBgCheck = formatValue('backgroundCheck', getFallbackValue('backgroundCheck'));
  const workSetupVal = formatValue('workSetup', getFallbackValue('workSetup'));
  const childrenCap = formatValue('childrenCapacity', getFallbackValue('childrenCapacity'));

  const nanny = {
    name: formatName(selectedNanny.name),
    goal: selectedNanny.goal || "Looking for a family",
    experience: formatValue('careExperience', getFallbackValue('careExperience')) || "Experience not specified",
    ages: (profile.hasFamily ? formatValue('childrenAges', getFallbackValue('childrenAges')) : formatValue('preferredAges', getFallbackValue('preferredAges'))) || "Ages not specified",
    schedule: formatCareTypeLabel(formatValue('careType', getFallbackValue('careType'))) || "Schedule not specified",
    location: formatLocation(),
    availability: formatValue('startAvailability', getFallbackValue('startAvailability')) || "Availability not specified",
    bio: profile.bio || additionalInfoBio || selectedNanny.aboutMe || "No bio provided.",
    img: selectedNanny.imageUrl || profile.imageFile,
    certifications: profile.certifications || [],
    compatibility: [
      hasShareExp === "Yes" ? "Has Share Experience" : null,
      hasMultiExp === "Yes" ? "Comfortable with Multiple Families" : null,
      hasTransp === "Yes" ? "Has Transportation" : null,
      hasBgCheck === "Yes" ? "Background Checked" : null,
      workSetupVal ? `Work Setup: ${workSetupVal}` : null,
      childrenCap ? `Capacity: ${childrenCap}` : null
    ].filter(Boolean)
  };

  /* Content, in the design's vocabulary — the same five box kinds as the
     caregiver profile page, and for the same reason: a question and its answer
     belong in a LABELLED ROW, where the answers line up down the right edge,
     rather than folded into a tick line the reader has to parse. Tick lists are
     kept for sets of things that are simply true.

     This replaced six "Professional Experience"-style groups of icon rows,
     which read nothing like the design however the cards around them were
     styled. */

  // The schema-required boolean the card badge, the filter and the shared theme
  // all key off, so the sections shown here are driven by the same source
  // rather than a brittle match on the free-text `goal` string.
  const isFamilyNanny = !!profile?.hasFamily;

  const asText = (key) => {
    const value = formatValue(key, getFallbackValue(key));
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const asList = (key) => (asText(key) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const isYes = (key) => String(asText(key) || "").toLowerCase() === "yes";

  const timeOfDay = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Read straight off the stored object rather than through formatValue, which
  // renders this key as a row of pills — the design wants day over time.
  const scheduleRows = (() => {
    const raw = getFallbackValue("specificDays") || getFallbackValue("specificDaysAndTime");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    return Object.entries(raw)
      .filter(([, slot]) => slot?.checked)
      .map(([day, slot]) => ({
        day,
        time: slot.start && slot.end ? `${timeOfDay(slot.start)} - ${timeOfDay(slot.end)}` : null,
      }));
  })();

  // The design's "Services" box: what they charge, one line per rate.
  //
  // Every row here is a number someone would actually pay, and each carries the
  // ⓘ that says which number it is. The two questionnaires disagree about what
  // they store, so both are reduced to the same pair: the cost in a share, and
  // the cost without one.
  const rateRows = (() => {
    const rows = [];
    const shared = formatSharedRate(getFallbackValue("hourlyBudget"));
    const solo = formatSoloRate(getFallbackValue("hourlyBudget"));
    if (shared) {
      rows.push({
        label: "Each family",
        value: shared.replace("~", "").replace(" per family", ""),
        hint: RATE_HINTS.eachFamily,
      });
    }
    if (solo) {
      rows.push({ label: "Total rate", value: solo.replace("~", ""), hint: RATE_HINTS.shareTotal });
    }
    if (!rows.length) {
      // `sharedRate` is the caregiver's COMBINED rate for both families and
      // `soloRate` is their rate for one family. Printed side by side as stored,
      // the share came out larger than going solo — so the shared figure is
      // halved into the one number a family is deciding on: their own side of
      // the split, which is always the smaller of the two.
      const eachFamily = formatEachFamilyRate(
        getFallbackValue("sharedRate"),
        `/${rateLabel} per family`
      );
      const onTheirOwn = formatStoredRate(getFallbackValue("soloRate"), `/${rateLabel}`);
      if (eachFamily) {
        rows.push({ label: "Shared rate", value: eachFamily, hint: RATE_HINTS.eachFamily });
      }
      if (onTheirOwn) {
        rows.push({ label: "On their own", value: onTheirOwn, hint: RATE_HINTS.solo });
      }
    }

    // salaryExp is a per-child price list — exactly the design's Services box.
    let salary = getFallbackValue("salaryExp");
    if (typeof salary === "string") {
      try { salary = JSON.parse(salary); } catch { salary = null; }
    }
    if (salary && typeof salary === "object") {
      for (const [label, key] of [
        ["1 child", "firstChild"],
        ["2 children", "secChild"],
        ["3 children", "thirdChild"],
        ["4 children", "fourthChild"],
        ["5 or more", "fiveOrMoreChild"],
      ]) {
        if (salary[key]) rows.push({ label, value: `$${salary[key]}/h`, hint: RATE_HINTS.perChild });
      }
    }
    return rows;
  })();

  const credentials = [
    isYes("firstAidCert") ? "First aid certified" : null,
    isYes("cprCert") ? "CPR certified" : null,
    isYes("eceCert") ? "Early childhood education (ECE)" : null,
    isYes("trustLineCert") ? "TrustLine registered" : null,
    isYes("backgroundCheck") ? "Background checked" : null,
    isYes("hasTransport") ? "Has transportation" : null,
    ...asList("customCertifications"),
  ].filter(Boolean);

  const contentCards = [
    {
      key: "about",
      sections: [
        { title: `About ${firstName || "the Nanny"}`, type: "text", value: nanny.bio },
        { title: "Credentials", type: "check", items: credentials },
        {
          title: "Experience",
          type: "rows",
          items: [
            { label: "Years of experience", value: asText("careExperience") },
            { label: "Worked with ages", value: asText("ageGroupsExp") },
            { label: "Prefers ages", value: isFamilyNanny ? null : asText("preferredAges") },
            { label: "Takes up to", value: isFamilyNanny ? null : asText("childrenCapacity") },
            // Normalised: the caregiver questionnaire, the family one and the
            // share editor each spell this differently, and a profile page
            // showing "full-time care" beside a card showing "Full-time" reads
            // as two different answers.
            { label: "Care type", value: formatCareTypeLabel(asText("careType")) },
            { label: "Available from", value: asText("startAvailability") },
          ].filter((row) => row.value),
        },
      ],
    },
    {
      key: "share",
      sections: [
        {
          title: "Sharing",
          type: "rows",
          items: (isFamilyNanny
            ? [
                { label: "Share is for", value: asText("forWho") },
                { label: "Children in care", value: asText("numberOfChildren") },
                { label: "Their ages", value: asText("childrenAges") },
                { label: "Current schedule", value: asText("currentSchedule") },
                { label: "Another family can join", value: asText("joinTiming") },
                { label: "Children together", value: asText("together") },
                { label: "Care happens at", value: asText("whereCare") },
              ]
            : [
                { label: "Done a share before", value: asText("shareExperience") },
                { label: "Comfortable with two families", value: asText("multiFamilyComfort") },
                { label: "Preferred setup", value: asText("workSetup") },
              ]
          ).filter((row) => row.value),
        },
      ],
    },
    {
      key: "extras",
      sections: [
        { title: "Languages", type: "check", items: asList("languages") },
        { title: "Help with the children", type: "check", items: asList("responsibilities") },
        { title: "Help around the house", type: "check", items: asList("householdHelp") },
        { title: "Special skills", type: "check", items: asList("skills") },
      ],
    },
  ];

  const renderGroups = ProfileSectionCards({ cards: contentCards });


  return (
    <div className="min-h-screen pb-20">
      {isRequestSubmitModal && (
        <MatchRequestFormModal
          setIsRequestSubmitModal={setIsRequestSubmitModal}
          senderId={senderId}
          receiverId={receiverId}
          onReferralRequired={() => setIsReferModal(true)}
        />
      )}
      {isProfileComplete && <CompleteProfileModal setIsProfileComplete={setIsProfileComplete} />}
      {isMatchRequestDenied && <RequestMatchDenied setIsMatchRequestDenied={setIsMatchRequestDenied} />}
      {isReferModal && <ReferAFriendModal onClose={() => setIsReferModal(false)} />}

      <div className="w-full max-w-[1320px] mx-auto px-4 xl:px-0 py-[20px] md:py-[30px]">
        <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[25px] items-start">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div className="w-full lg:w-[378px] lg:shrink-0 space-y-[20px]">

            <ProfileCard className="relative px-[20px] pt-[30px] pb-[25px]">
              <button
                type="button"
                onClick={favourite}
                aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
                className="absolute top-[30px] right-[30px] bg-transparent border-none cursor-pointer p-0 leading-none"
              >
                <Heart
                  className="size-[24px]"
                  color={isFavorited ? "#EF4444" : "#555555"}
                  fill={isFavorited ? "#EF4444" : "none"}
                />
              </button>

              <div className="flex flex-col items-center">
                {nanny.img ? (
                  <img
                    src={nanny.img}
                    alt={nanny.name}
                    className="mt-[25px] rounded-[16px] size-[150px] object-cover"
                  />
                ) : (
                  <div className="mt-[25px] rounded-[16px] size-[150px] bg-[#AEC4FF] flex items-center justify-center text-[#0D134C] Livvic-SemiBold text-[50px]">
                    {nanny.name ? nanny.name.charAt(0).toUpperCase() : ""}
                  </div>
                )}

                {/* The same themed "Role • Goal" pill as the profile card, so
                    this page reads identically to the card it was opened from. */}
                <div
                  style={{ backgroundColor: getNannyTheme(profile.hasFamily).bg, color: getNannyTheme(profile.hasFamily).text }}
                  className="inline-flex items-center gap-1.5 Livvic-Bold rounded-full px-3 py-1 text-xs mt-[20px]"
                >
                  <Users size={13} />
                  <ShareTypeLabel role="Nanny" goal={getNannyGoal(profile.hasFamily)} />
                </div>

                <p className="Livvic-SemiBold text-[25px] leading-[25px] text-[#000F36] text-center mt-[16px]">
                  {nanny.name}
                </p>
                <p className="Livvic-Medium text-[16px] leading-[16px] text-[#555555] text-center mt-[12px] flex items-center gap-1.5">
                  <MapPin size={15} /> {nanny.location}
                </p>

                {/* Two stat tiles, still the design's 67px.
                    `truncate` is `overflow: hidden`, and a 20px value on a
                    20px line box has no room for a descender — which cut the
                    tail off the y in "3-5 years". The value line now carries
                    its full em box (25px) and the gaps absorb the difference,
                    so the tile height is unchanged; `min-h` rather than `h`
                    means a taller value can never be trimmed by the box again.
                    `min-w-0` is what lets `truncate` actually truncate: a flex
                    item defaults to `min-width: auto`, so without it a long
                    rate escapes the tile instead of ellipsising. */}
                {(experienceTile || rateTile) && (
                  <div className="flex gap-[10px] w-full mt-[20px] items-stretch">
                    {experienceTile && (
                      <div className="flex-1 min-w-0 min-h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[4px]">
                        <p className="Livvic-Medium text-[12px] leading-[14px] text-[#555555]">Work Experience</p>
                        <p className="Livvic-Bold text-[20px] leading-[25px] text-[#001243] truncate">{experienceTile}</p>
                      </div>
                    )}
                    {rateTile && (
                      <div className="flex-1 min-w-0 min-h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[4px]">
                        <p className="Livvic-Medium text-[12px] leading-[14px] text-[#555555] inline-flex items-center gap-[5px]">
                          Shared rate
                          <InfoTip text={RATE_HINTS.eachFamily} size={12} />
                        </p>
                        <p className="Livvic-Bold text-[20px] leading-[25px] text-[#001243] truncate">{rateTile}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-[15px]">
                  <Ra points={Number(selectedNanny?.averageRating) || 0} size={20} color="#FFB73A" />
                </div>
                {totalReviews > 0 && (
                  <p className="Livvic-SemiBold text-[14px] leading-[24px] text-[#555555] text-center mt-[12px]">
                    {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleMatchRequest}
                  className="mt-[15px] w-full h-[50px] rounded-[35px] bg-[#AEC4FF] hover:bg-[#C1D6FF] transition-colors border-none cursor-pointer Livvic-SemiBold text-[14px] leading-[14px] text-[#000F36]"
                >
                  Request a Match
                </button>
              </div>
            </ProfileCard>

            {nanny.compatibility.length > 0 && (
              <ProfileCard className="px-[25px] pt-[30px] pb-[25px]">
                <SectionTitle className="mb-[16px]">At a glance</SectionTitle>
                <div className="flex flex-col">
                  {nanny.compatibility.map((item) => (
                    <p
                      key={String(item)}
                      className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]"
                    >
                      {`✔  ${sentenceCase(item)}`}
                    </p>
                  ))}
                </div>
              </ProfileCard>
            )}
          </div>

          {/* ── Main column ─────────────────────────────────────────────── */}
          <div className="w-full lg:flex-1 lg:min-w-0 space-y-[25px]">

            {renderGroups[0]}

            {/* The design's paired boxes: the week on the left, what they
                charge on the right. */}
            {(scheduleRows.length > 0 || rateRows.length > 0) && (
              <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[25px] items-stretch">
                {scheduleRows.length > 0 && (
                  <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                    <SectionTitle className="mb-[22px]">Weekly Schedule</SectionTitle>
                    <ScheduleList items={scheduleRows} />
                  </ProfileCard>
                )}

                {rateRows.length > 0 && (
                  <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                    <SectionTitle className="mb-[22px]">Rates</SectionTitle>
                    <PriceRows items={rateRows} />
                  </ProfileCard>
                )}
              </div>
            )}

            {renderGroups.slice(1)}

            {/* Same panel, and the same accepted-match gate, as the caregiver
                profile screen. */}
            <ProfileReviews
              targetUserId={targetUserId}
              targetName={firstName || nanny.name}
              reviews={selectedNanny?.reviews}
              averageRating={selectedNanny?.averageRating}
              onReviewed={() => dispatch(fetchNannyByIdThunk(id))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
