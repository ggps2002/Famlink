import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { MapPin, Users, Heart } from "lucide-react";
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
import { formatSharedRate, RATE_HINTS } from "@shared/lib/rates";
import { formatCareTypeLabel } from "@shared/lib/scheduleFormat";
import { getFamilyTheme, getFamilyGoal, ShareTypeLabel } from "@features/nanny-share/shareTypeTheme";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";

import CustomButton from "@shared/ui/Button";
export default function FamilyProfileView() {
  const { id } = useParams();
  const dispatch = useDispatch();

  const { selectedNanny, isLoading } = useSelector((s) => s.nannyData);
  const { user, accessToken } = useSelector((state) => state.auth);

  // The viewer's own profile — hasFamily lives there, and it decides whether
  // this user is on the referral model or the subscription one.
  const { currentProfile } = useSelector((s) => s.postNannyShare);

  const [isMatchRequestDenied, setIsMatchRequestDenied] = React.useState(false);
  const [isReferModal, setIsReferModal] = React.useState(false);
  const [isFavorited, setIsFavorited] = React.useState(false);
  // Opened from "View profile" on the edit page: render the page exactly as
  // others see it (see `preview` on the details component below).
  const isOwnProfile = !!user?._id && user._id === id;

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

  if (isLoading || !selectedNanny) {
    return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
  }

  // The person this page is about — see the same line in the details below.
  const targetUserId =
    selectedNanny?.userId?._id || selectedNanny?.userId || selectedNanny?._id || id;

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

      <FamilyProfileDetails
        data={selectedNanny}
        fallbackId={id}
        preview={isOwnProfile}
        isFavorited={isFavorited}
        onFavourite={favourite}
        onRequestMatch={handleMatchRequest}
        onReviewed={() => dispatch(fetchNannyByIdThunk(id))}
      />
    </div>
  );
}

/* The page itself, from a fetched profile document.
 *
 * `preview` shows the page exactly as a visitor sees it — heart and "Request
 * a Match" included — with those two inert. The route page sets it when you
 * open your own profile ("View profile" on the edit page). */
export function FamilyProfileDetails({
  data: selectedNanny,
  fallbackId: id,
  preview = false,
  isFavorited = false,
  onFavourite,
  onRequestMatch,
  onReviewed,
}) {
  // In preview (your own profile) the heart and the match button are drawn
  // exactly as a visitor sees them, but do nothing: you can't favourite or
  // request yourself.
  const favourite = preview ? undefined : onFavourite;
  const handleMatchRequest = preview ? undefined : onRequestMatch;

  // Map backend data to our premium layout
  const profile = selectedNanny?.nannyProfile || {};

  // The person this page is about. Resolved once and used both to address a
  // match request and to decide whether the review panel offers a review, so
  // the two can never disagree about who they mean.
  const targetUserId =
    selectedNanny?.userId?._id || selectedNanny?.userId || selectedNanny?._id || id;

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

  const childrenCount = profile.numberOfChildren !== undefined && profile.numberOfChildren !== null
    ? profile.numberOfChildren
    : selectedNanny?.noOfChildren?.length;

  const childrenStr = childrenCount !== undefined && childrenCount !== null
    ? `${childrenCount} Child${childrenCount === 1 ? '' : 'ren'}`
    : "Children count not specified";

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
    "nannyShareType",
    "hasNanny",
    "shareLocation",
    "specifyNearbyWorkplace",
    "flexible",
    "nannyshareStart",
    "urgency",
    "hosting",
    "prefferedCommunication",
    "backupAvailable",
    "specificDaysAndTime",
    "numberOfChildren",
    "childrenAges",
    "allergiesHealth",
    "dailyRoutine",
    "responsibilities",
    "childResponsibilities",
    "householdAddOns",
    "parentingStyle",
    "houseRules",
    "hourlyBudget",
    "pets",
    "careDescription",
    "openNotes"
  ];

  // Map to friendly names if needed or fallback mapping
  const keyMapping = {
    flexible: "flexibility",
    hosting: "hostingPreference",
    prefferedCommunication: "communicationPreference",
    backupAvailable: "backupCare",
    hourlyRateSplit: "hourlyBudget",
    specificDaysAndTime: "specificDays"
  };

  // additionalInfo reaches us either as a plain array of { key, value } objects
  // or, for sheet-imported profiles, as a single JSON-stringified array. Flatten
  // both so a `.find(by key)` resolves regardless of shape (mirrors the same
  // normalisation in NannyProfileView).
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
    // 1. Check profile schema directly
    if (profile && profile[key] !== undefined && profile[key] !== null && profile[key] !== "") {
      return profile[key];
    }
    // 2. Check additionalInfo with the exact key
    let fallback = flatAdditionalInfo.find(info => info.key === key);
    if (fallback) return fallback.value;

    // 3. Check profile schema with legacy mapped keys
    if (keyMapping[key] && profile && profile[keyMapping[key]] !== undefined && profile[keyMapping[key]] !== null && profile[keyMapping[key]] !== "") {
      return profile[keyMapping[key]];
    }

    // 4. Check additionalInfo with legacy mapped keys
    if (keyMapping[key]) {
      fallback = flatAdditionalInfo.find(info => info.key === keyMapping[key]);
      if (fallback) return fallback.value;
    }
    return null;
  };

  const formatKey = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();

  const formatValue = (key, val) => {
    if (val === undefined || val === null || val === "" || val === "N A" || val === "null" || (typeof val === 'string' && val.trim() === '')) {
      return null;
    }
    
    let parsedVal = val;
    let iterations = 0;
    while (typeof parsedVal === 'string' && (parsedVal.startsWith('{') || parsedVal.startsWith('[')) && iterations < 3) {
      try { 
        let temp = JSON.parse(parsedVal); 
        if (typeof temp === 'string' && temp === parsedVal) break;
        parsedVal = temp;
      } catch(e) {
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
        try { parsedVal = JSON.parse(parsedVal); } catch(e) { parsedVal = [parsedVal]; }
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
    } else if (key === "nannyShareType") {
      // Normalised, not printed raw: profiles written by the two questionnaires
      // and the share editor hold four spellings of the same two answers, plus
      // five retired ones. See SHARE_SCHEDULES in shared/lib/scheduleFormat.js.
      return formatCareTypeLabel(parsedVal) || null;
    } else if (key === "hourlyBudget") {
      // Budgets are stored as an object, a stringified object, or a legacy
      // display label. Without this branch the object fell through to
      // JSON.stringify and the legacy label printed verbatim — which is how
      // "$20 - $undefined per hour" reached this row.
      //
      // Only the per-family share is shown. A family's answer is what THEY pay;
      // the combined figure stored alongside it is the caregiver's rate for the
      // whole share, and printing it on a family's profile read as a second,
      // standalone price they were offering.
      const share = formatSharedRate(val);
      if (share) return share.replace('~', '');

      // also handle specified budget
      const specify = getFallbackValue("hourlyBudgetSpecify");
      return specify ? `$${specify}/hr` : null;
    } else if (key === "hosting" || key === "hostingPreference") {
      if (typeof parsedVal === 'string' && parsedVal.toLowerCase() === "your home") {
        return "My home";
      }
      return parsedVal;
    } else if (key === "nannyshareStart") {
      // Stored as an ISO date from the picker, so the detail row printed the raw
      // "2026-07-20T23:00:00.000Z". Route it through the shared formatter →
      // "July 20, 2026"; non-date answers ("Flexible", "ASAP") pass through
      // untouched.
      return formatStartDate(parsedVal);
    } else {
      let res = parsedVal;
      if (typeof parsedVal === 'object') {
        res = Array.isArray(parsedVal) ? parsedVal.map(v => String(v).replace(/[\[\]"]/g, '')).join(", ") : (parsedVal?.option || JSON.stringify(parsedVal));
        res = typeof res === 'string' ? res.split(',').map(s => s.trim()).join(', ') : res;
      } else if (typeof parsedVal === 'boolean') {
        if (key === "hasNanny") {
          return parsedVal ? "Yes - we already have a nanny" : "No - we are looking for a nanny";
        }
        return parsedVal ? "Yes" : "No";
      } else {
        res = String(parsedVal).replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).join(', '); 
      }
      
      // Append specify fields
      let specifyKey = null;
      if (key === "parentingStyle") specifyKey = "parentingStyleSpecify";
      else if (key === "houseRules") specifyKey = "houseRulesSpecify";
      else if (key === "pets") specifyKey = "petsSpecify";
      else if (key === "allergiesHealth") specifyKey = "allergiesHealthSpecify";
      else if (key === "prefferedCommunication" || key === "communicationPreference") specifyKey = "communicationSpecify";
      else if (key === "backupAvailable" || key === "backupCare") specifyKey = "backupCareSpecify";
      
      if (specifyKey) {
        const specifyVal = getFallbackValue(specifyKey);
        if (specifyVal) {
          res = res ? `${res}, ${specifyVal}` : specifyVal;
        }
      }
      return res;
    }
  };

  // Sidebar stat tiles. These read the raw values rather than the "…not
  // specified" display strings, so an unanswered question leaves the tile out
  // instead of printing a sentence where a number belongs.
  const childrenTile =
    childrenCount !== undefined && childrenCount !== null ? String(childrenCount) : null;
  // The tile wants the number, not the sentence: the shared formatter returns
  // "~$10 - $12/hr per family", and the ⓘ beside the label carries the
  // qualifier.
  const budgetTile =
    (formatSharedRate(profile.hourlyBudget) || "")
      .replace("~", "")
      .replace(" per family", "") || null;

  const totalReviews = selectedNanny?.reviews?.length ?? 0;

  const flexVal = formatValue('flexible', getFallbackValue('flexible'));
  const urgVal = formatValue('urgency', getFallbackValue('urgency'));
  const commVal = formatValue('prefferedCommunication', getFallbackValue('prefferedCommunication'));

  const family = {
    name: formatName(selectedNanny.name),
    goal: selectedNanny.goal || "Looking for a nanny share",
    children: childrenStr,
    schedule: formatCareTypeLabel(profile.nannyShareType) || "Schedule not specified",
    location: formatLocation(),
    startDate: formatStartDate(profile.nannyshareStart) || "Flexible",
    bio: selectedNanny.aboutMe || profile.careDescription || profile.openNotes || "No bio provided.",
    img: selectedNanny.imageUrl || profile.imageFile,
    // Drives the sidebar's "At a glance" list, so only answers they actually
    // gave belong here — a row reading "Urgency not specified" is noise next to
    // the detail sections below, which already say so where it matters.
    preferences: [
      profile.hasNanny === undefined || profile.hasNanny === null
        ? null
        : profile.hasNanny
          ? "Already have a nanny"
          : "Looking for a nanny",
      flexVal ? `Schedule: ${flexVal}` : null,
      urgVal ? `Urgency: ${urgVal}` : null,
      commVal ? `Prefers ${commVal}` : null,
    ].filter(Boolean)
  };

  /* ── Content, in the design's vocabulary ──────────────────────────────────
   *
   * The Figma profile page has five kinds of box and no more: a paragraph, a
   * ✔ list, a bulleted list, a day/time schedule, and label⟷price rows. This
   * screen used to render everything as icon rows in "Family & Care Needs"-style
   * groups, which is why it read nothing like the design even once the cards
   * around it matched. Every answer below is mapped onto one of those five.
   */

  const asText = (key) => {
    const value = formatValue(key, getFallbackValue(key));
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const timeOfDay = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Read straight off the stored object rather than through formatValue, which
  // renders this key as a row of pills — the design wants day over time.
  const scheduleRows = (() => {
    // The profile's own `specificDays` first — it is what the edit page saves.
    // `specificDaysAndTime` resolves through the signup-era additionalInfo
    // BEFORE the profile, so a stale copy there used to hide the schedule.
    const raw = profile.specificDays || getFallbackValue("specificDaysAndTime");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    return Object.entries(raw)
      // Older schedules stored a chosen day as just its times, with no
      // `checked` flag — the edit page counts those as selected, so this does
      // too. An explicit `checked: false` still hides the day.
      .filter(([, slot]) => slot?.checked ?? Boolean(slot?.start && slot?.end))
      .map(([day, slot]) => ({
        day,
        time: slot.start && slot.end ? `${timeOfDay(slot.start)} - ${timeOfDay(slot.end)}` : null,
      }));
  })();

  // The design's "Services" box: a label on the left, a price on the right.
  //
  // One rate only. A family states what their own share of the cost is — they
  // do not set a standalone caregiver rate, and the combined figure stored
  // beside their answer belongs to the caregiver, not to them.
  const budgetRows = [
    [
      "Each family",
      (formatSharedRate(profile.hourlyBudget) || "").replace("~", "").replace(" per family", ""),
      RATE_HINTS.familyBudget,
    ],
    [
      "My share",
      getFallbackValue("hourlyBudgetSpecify") ? `$${getFallbackValue("hourlyBudgetSpecify")}/hr` : "",
      RATE_HINTS.familyBudget,
    ],
  ]
    .filter(([, value]) => value)
    .map(([label, value, hint]) => ({ label, value, hint }));

  /* Each entry becomes one card; a card with several sections gets the
     full-width rules between them, exactly as the design does.

     Anything that is a question with an answer goes in a LABELLED ROW rather
     than a tick line. "Urgency: Within 2-3 months" as a bullet makes the reader
     pick the value out of a sentence; as a row the answers line up down the
     right edge and can be scanned. Tick lists are kept for sets of things that
     are simply true, where there is no label to read past. */
  const startDate = asText("nannyshareStart");
  const asList = (key) => (asText(key) || "").split(",").map((s) => s.trim()).filter(Boolean);

  const contentCards = [
    {
      key: "about",
      sections: [
        { title: `About ${family.name || "the Family"}`, type: "text", value: family.bio },
        {
          title: "Care Needs",
          type: "rows",
          items: [
            { label: "Share type", value: asText("nannyShareType") },
            {
              label: "Nanny",
              value:
                profile.hasNanny === undefined || profile.hasNanny === null
                  ? null
                  : profile.hasNanny
                    ? "Already have one"
                    : "Looking for one",
            },
            { label: "Schedule", value: flexVal },
            { label: "Hosting", value: asText("hosting") },
            { label: "Starts", value: startDate },
            // The two questions often collect the same answer; showing it twice
            // reads as though one of them is a different fact.
            { label: "Urgency", value: urgVal === startDate ? null : urgVal },
          ].filter((row) => row.value),
        },
        {
          title: "Children",
          type: "rows",
          items: [
            { label: "How many", value: childrenCount ? childrenStr : null },
            { label: "Ages", value: asText("childrenAges") },
            { label: "School", value: asText("childrenSchools") },
            { label: "Allergies / health", value: asText("allergiesHealth") },
          ].filter((row) => row.value),
        },
      ],
    },
    {
      key: "where",
      sections: [
        { title: "Open to sharing in", type: "check", items: asList("shareLocation") },
        {
          title: "Near a workplace",
          type: "text",
          value: asText("specifyNearbyWorkplace"),
        },
      ],
    },
    {
      key: "care",
      sections: [
        { title: "Help with the children", type: "check", items: asList("childResponsibilities") },
        { title: "Help around the house", type: "check", items: asList("householdAddOns") },
        { title: "A typical day", type: "check", items: asList("dailyRoutine") },
      ],
    },
    {
      key: "home",
      sections: [
        { title: "Parenting style", type: "check", items: asList("parentingStyle") },
        { title: "House rules", type: "check", items: asList("houseRules") },
        { title: "Pets", type: "check", items: asList("pets") },
      ],
    },
    {
      key: "contact",
      sections: [
        {
          title: "Staying in touch",
          type: "rows",
          items: [
            { label: "Preferred", value: commVal },
            { label: "Backup care", value: asText("backupAvailable") },
            { label: "Involvement", value: asText("involvementLevel") },
          ].filter((row) => row.value),
        },
        { title: "Anything else", type: "text", value: asText("openNotes") },
      ],
    },
  ];

  const renderGroups = ProfileSectionCards({ cards: contentCards });


  return (
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
              {family.img ? (
                <img
                  src={family.img}
                  alt={family.name}
                  className="mt-[25px] rounded-[16px] size-[150px] object-cover"
                />
              ) : (
                <div className="mt-[25px] rounded-[16px] size-[150px] bg-[#AEC4FF] flex items-center justify-center text-[#0D134C] Livvic-SemiBold text-[50px]">
                  {family.name ? family.name.charAt(0).toUpperCase() : ""}
                </div>
              )}

              {/* The same themed "Role • Goal" pill as the profile card, so
                  this page reads identically to the card it was opened from. */}
              <div
                style={{ backgroundColor: getFamilyTheme(profile.hasNanny).bg, color: getFamilyTheme(profile.hasNanny).text }}
                className="inline-flex items-center gap-1.5 Livvic-Bold rounded-full px-3 py-1 text-xs mt-[20px]"
              >
                <Users size={13} />
                <ShareTypeLabel role="Family" goal={getFamilyGoal(profile.hasNanny)} />
              </div>

              <p className="Livvic-SemiBold text-[25px] leading-[25px] text-[#000F36] text-center mt-[16px]">
                {family.name}
              </p>
              <p className="Livvic-Medium text-[16px] leading-[16px] text-[#555555] text-center mt-[12px] flex items-center gap-1.5">
                <MapPin size={15} /> {family.location}
              </p>

              {/* Same tiles, same fix as NannyProfileView: a 20px value on a
                  20px line box loses its descenders to `truncate`'s
                  `overflow: hidden`. Digits have none, so nothing visibly
                  clips here today — but these two rows are one design, and
                  the next value with a tail would. */}
              {(childrenTile || budgetTile) && (
                <div className="flex gap-[10px] w-full mt-[20px] items-stretch">
                  {childrenTile && (
                    <div className="flex-1 min-w-0 min-h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[4px]">
                      <p className="Livvic-Medium text-[12px] leading-[14px] text-[#555555]">Children</p>
                      <p className="Livvic-Bold text-[20px] leading-[25px] text-[#001243] truncate">{childrenTile}</p>
                    </div>
                  )}
                  {budgetTile && (
                    <div className="flex-1 min-w-0 min-h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[4px]">
                      <p className="Livvic-Medium text-[12px] leading-[14px] text-[#555555] inline-flex items-center gap-[5px]">
                        Our share
                        <InfoTip text={RATE_HINTS.familyBudget} size={12} />
                      </p>
                      <p className="Livvic-Bold text-[20px] leading-[25px] text-[#001243] truncate">{budgetTile}</p>
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

              <CustomButton
                type="button"
                onClick={handleMatchRequest}
                className="mt-[15px] w-full h-[50px] rounded-[35px] bg-[#AEC4FF] hover:bg-[#C1D6FF] transition-colors border-none cursor-pointer Livvic-SemiBold text-[14px] leading-[14px] text-[#000F36] px-0 py-0"
              >
                Request a Match
              </CustomButton>
            </div>
          </ProfileCard>

          {family.preferences.length > 0 && (
            <ProfileCard className="px-[25px] pt-[30px] pb-[25px]">
              <SectionTitle className="mb-[16px]">At a glance</SectionTitle>
              <div className="flex flex-col">
                {family.preferences.map((item) => (
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

          {/* The design's paired boxes: the week on the left, what it costs
              on the right. */}
          {(scheduleRows.length > 0 || budgetRows.length > 0) && (
            <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[25px] items-stretch">
              {scheduleRows.length > 0 && (
                <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                  <SectionTitle className="mb-[22px]">Weekly Schedule</SectionTitle>
                  <ScheduleList items={scheduleRows} />
                </ProfileCard>
              )}

              {budgetRows.length > 0 && (
                <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                  <SectionTitle className="mb-[22px]">Budget</SectionTitle>
                  <PriceRows items={budgetRows} />
                </ProfileCard>
              )}
            </div>
          )}

          {renderGroups.slice(1)}

          {/* Same panel, and the same accepted-match gate, as the caregiver
              profile screen. */}
          <ProfileReviews
            targetUserId={targetUserId}
            targetName={family.name}
            reviews={selectedNanny?.reviews}
            averageRating={selectedNanny?.averageRating}
            onReviewed={onReviewed}
          />
        </div>
      </div>
    </div>
  );
}
