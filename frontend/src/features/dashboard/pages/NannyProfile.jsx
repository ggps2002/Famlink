import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Heart } from "lucide-react";
import { HeartFilled } from "@ant-design/icons";
import Avatar from "react-avatar";

import Ra from "@shared/ui/Rate";
import ProfileReviews from "@features/dashboard/components/ProfileReviews";
import {
  BulletList,
  CardDivider,
  CardSection,
  ProfileCard,
  SectionTitle,
} from "@features/dashboard/components/profileChrome";
import { fireToastMessage } from "@shared/ui/toast";
import { customFormat, formatSentence, sentenceCase } from "@shared/lib/toCamelCase";
import { fetchNannyByIdThunk } from "@features/dashboard/store/nannyDataSlice";
import { addOrRemoveFavouriteThunk } from "@features/dashboard/store/favouriteSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { createChatThunk } from "@features/chat/store/chatSlice";

import CustomButton from "@shared/ui/Button";
/* ── formatting ──────────────────────────────────────────────────────────── */

/**
 * "Sheena Fernandes" → "Sheena F."
 *
 * A profile is visible to every signed-in member, so the surname is reduced to
 * an initial here the same way it is on the nanny-share profile views. The
 * first name stays whole — it is what the Message button addresses her by.
 */
const formatName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const firstNameOf = (fullName) => {
  const [first = ""] = String(fullName || "").trim().split(/\s+/);
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
};

/**
 * The credentials named by the onboarding certification answer.
 *
 * That question stores a whole sentence ("Yes, I have first aid and CPR
 * certifications."), not a list, so it is matched for what it names rather than
 * reformatted: `customFormat` is tuned for the age-group answers and turns this
 * one into "I Have First Aid , C P R certification".
 */
const CREDENTIAL_PHRASES = [
  [/first aid/i, "First Aid"],
  [/\bcpr\b/i, "CPR"],
  [/childcare certification/i, "Childcare Certification"],
];

const formatTimeOfDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
};

/* The per-child rate rows, in the order the questionnaire asks for them. */
const SERVICE_ROWS = [
  ["1 Child", "firstChild"],
  ["2 Child", "secChild"],
  ["3 Child", "thirdChild"],
  ["4 Child", "fourthChild"],
  ["5 Child Or More", "fiveOrMoreChild"],
];

/* Every verification the design lists. `read` returns true when we hold proof;
   the rows with no `read` have no field behind them yet and render unticked
   rather than claiming a check nobody earned. */
const VERIFICATIONS = [
  ["Background Check", (v) => v?.nationalIDVer === "true"],
  ["Phone number Verification", (v) => Boolean(v?.phoneVer)],
  ["National Id", (v) => v?.nationalIDVer === "true"],
  ["Passport", null],
  ["Driving License", null],
];

export default function ProfileNanny() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { selectedNanny } = useSelector((s) => s.nannyData);
  const { user } = useSelector((s) => s.auth);

  useEffect(() => {
    if (id) dispatch(fetchNannyByIdThunk(id));
  }, [dispatch, id]);

  /* ── reading the profile ───────────────────────────────────────────────── */

  // Most of this screen is stored as loose { key, value } pairs rather than
  // schema fields, so every read goes through these rather than repeating an
  // unguarded `.find(...).value.option` chain that throws on a caregiver who
  // skipped the question.
  const infoValue = useCallback(
    (key) => selectedNanny?.additionalInfo?.find((entry) => entry?.key === key)?.value,
    [selectedNanny],
  );

  const infoOptions = useCallback(
    (key) => {
      const value = infoValue(key);
      const option = value?.option ?? value;
      if (Array.isArray(option)) return option.filter(Boolean);
      return option ? [option] : [];
    },
    [infoValue],
  );

  const infoText = useCallback(
    (key) => {
      const options = infoOptions(key);
      return options.length ? options.join(", ") : "";
    },
    [infoOptions],
  );

  const credentials = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (raw) => {
      const label = String(raw ?? "").trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(label);
    };

    // What they signed up to work as — "nanny", "privateEducator", …
    infoOptions("interestedPosi").forEach((role) => add(formatSentence(String(role))));
    // Formal training, from the onboarding sentence and the nanny-share profile.
    infoOptions("certification").forEach((answer) => {
      CREDENTIAL_PHRASES.forEach(([pattern, label]) => {
        if (pattern.test(String(answer))) add(label);
      });
    });
    (selectedNanny?.nannyProfile?.certifications || []).forEach(add);
    add(selectedNanny?.nannyProfile?.customCertifications);

    return out;
  }, [infoOptions, selectedNanny]);

  const schedule = useMemo(() => {
    const specificDays = infoValue("specificDaysAndTime");
    if (!specificDays || typeof specificDays !== "object") return [];
    return Object.entries(specificDays)
      .filter(([, slot]) => slot?.checked)
      .map(([day, slot]) => ({
        day,
        start: formatTimeOfDay(slot.start),
        end: formatTimeOfDay(slot.end),
      }));
  }, [infoValue]);

  const services = useMemo(() => {
    const rates = infoValue("salaryExp");
    if (!rates || typeof rates !== "object") return [];
    return SERVICE_ROWS.map(([label, key]) => ({ label, rate: rates[key] })).filter(
      (row) => row.rate !== undefined && row.rate !== null && row.rate !== "",
    );
  }, [infoValue]);

  /* ── actions ───────────────────────────────────────────────────────────── */

  const favourite = async () => {
    await dispatch(addOrRemoveFavouriteThunk({ favouriteUserId: id }));
    await dispatch(refreshTokenThunk());
  };

  const handleMessage = async () => {
    try {
      const { status } = await dispatch(
        createChatThunk({ participants: [id, user._id] }),
      ).unwrap();
      if (status === 200 || status === 201) navigate("/family/message/");
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  if (!selectedNanny) {
    return <div className="p-6 Livvic-Medium text-[#555555]">Loading...</div>;
  }

  /* ── derived display values ────────────────────────────────────────────── */

  const displayName = formatName(selectedNanny?.name);
  const firstName = firstNameOf(selectedNanny?.name);
  const isOwnProfile = String(id) === String(user?._id);
  const isFavorited = user?.favourite?.includes(id);
  const averageRating = Number(selectedNanny?.averageRating) || 0;
  const totalReviews = selectedNanny?.reviews?.length ?? 0;

  const formatLocation = () => {
    if (!selectedNanny?.zipCode || !selectedNanny?.location?.format_location) return "";
    const parts = selectedNanny.location.format_location
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    // See FamilyProfileView: counting back from the end mislabels a coarsened
    // three-part address, so the "ST 94602" component is located instead.
    const stateIndex = parts.findIndex((part) => /^[A-Z]{2}\b/.test(part));
    return stateIndex > 0 ? `${parts[stateIndex - 1]}, ${parts[stateIndex].split(" ")[0]}` : "";
  };

  const experience = infoText("experience");
  const ageGroups = infoOptions("ageGroupsExp");
  const languages = infoOptions("language").map(
    (lang) => String(lang).charAt(0).toUpperCase() + String(lang).slice(1).toLowerCase(),
  );
  const additionalDetails = infoOptions("additionalDetails").map(String);
  // No schema field backs education yet; the section is laid out as the design
  // has it and simply does not render until one does.
  const educations = [
    ...infoOptions("education").map(String),
    ...(Array.isArray(selectedNanny?.nannyProfile?.education)
      ? selectedNanny.nannyProfile.education.map(String)
      : []),
  ];

  // Through infoText rather than infoValue: the bio is stored as a bare string
  // on most profiles but as { option } on some, and rendering the object form
  // directly takes the page down with "Objects are not valid as a React child".
  const about =
    infoText("jobDescription") || selectedNanny?.nannyProfile?.bio || selectedNanny?.aboutMe;

  const salary = infoValue("salaryRange");
  const rateLabel = salary?.min
    ? salary.max
      ? `$${salary.min} - ${salary.max}/h`
      : `$${salary.min}/h+`
    : null;

  const hasSideCard = educations.length > 0 || languages.length > 0 || additionalDetails.length > 0;

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 xl:px-0 py-[20px] md:py-[30px]">
      <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[25px] items-start">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[378px] lg:shrink-0 space-y-[20px]">

          {/* Profile card */}
          <ProfileCard className="relative px-[20px] pt-[30px] pb-[25px]">
            <button
              type="button"
              onClick={favourite}
              aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
              className="absolute top-[30px] right-[30px] bg-transparent border-none cursor-pointer p-0 leading-none"
            >
              {isFavorited ? (
                <HeartFilled className="text-tertiary text-[24px]" />
              ) : (
                <Heart className="size-[24px] text-[#555555]" />
              )}
            </button>

            <div className="flex flex-col items-center">
              {selectedNanny?.imageUrl ? (
                <img
                  className="mt-[25px] rounded-[16px] size-[150px] object-cover"
                  src={selectedNanny.imageUrl}
                  alt={displayName}
                />
              ) : (
                <div className="mt-[25px]">
                  <Avatar
                    className="rounded-[16px] text-black"
                    size="150"
                    color="#AEC4FF"
                    name={selectedNanny?.name?.split(" ").slice(0, 2).join(" ")}
                  />
                </div>
              )}

              <div className="flex items-center gap-[4px] mt-[25px]">
                <p className="Livvic-SemiBold text-[25px] leading-[25px] text-[#000F36] text-center">
                  {displayName}
                </p>
                <img src="/shield.svg" alt="" className="size-[22px]" />
              </div>

              {formatLocation() && (
                <p className="Livvic-Medium text-[16px] leading-[16px] text-[#555555] text-center mt-[12px]">
                  {formatLocation()}
                </p>
              )}

              {(experience || rateLabel) && (
                <div className="flex gap-[10px] w-full mt-[20px]">
                  {experience && (
                    <div className="flex-1 h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[10px]">
                      <p className="Livvic-Medium text-[12px] leading-[12px] text-[#555555]">
                        Work Experience
                      </p>
                      <p className="Livvic-Bold text-[20px] leading-[20px] text-[#001243] truncate">
                        {experience}
                      </p>
                    </div>
                  )}
                  {rateLabel && (
                    <div className="flex-1 h-[67px] px-[16px] py-[12px] rounded-[10px] border border-[#EEEEEE] flex flex-col justify-center gap-[10px]">
                      <p className="Livvic-Medium text-[12px] leading-[12px] text-[#555555]">
                        Rate
                      </p>
                      <p className="Livvic-Bold text-[20px] leading-[20px] text-[#001243] truncate">
                        {rateLabel}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-[15px]">
                <Ra points={averageRating} size={20} color="#FFB73A" />
              </div>

              {totalReviews > 0 && (
                <p className="Livvic-SemiBold text-[14px] leading-[24px] text-[#555555] text-center mt-[12px]">
                  {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"}
                </p>
              )}

              {!isOwnProfile && (
                <CustomButton
                  type="button"
                  onClick={handleMessage}
                  className="mt-[15px] w-full h-[50px] rounded-[35px] bg-[#AEC4FF] hover:bg-[#C1D6FF] transition-colors border-none cursor-pointer Livvic-SemiBold text-[14px] leading-[14px] text-[#000F36] px-0 py-0"
                >
                  {firstName ? `Message ${firstName}` : "Message"}
                </CustomButton>
              )}
            </div>
          </ProfileCard>

          {/* Educations / Language / Additional details — one card, rules run
              the full width, exactly as in the design. */}
          {hasSideCard && (
            <ProfileCard>
              {educations.length > 0 && (
                <CardSection className="pt-[30px]">
                  <SectionTitle className="mb-[18px]">Educations</SectionTitle>
                  <BulletList items={educations} />
                </CardSection>
              )}

              {educations.length > 0 && languages.length > 0 && <CardDivider />}

              {languages.length > 0 && (
                <CardSection className={educations.length === 0 ? "pt-[30px]" : ""}>
                  <SectionTitle className="mb-[18px]">Language</SectionTitle>
                  <p className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]">
                    {languages.join(", ")}
                  </p>
                </CardSection>
              )}

              {additionalDetails.length > 0 && (educations.length > 0 || languages.length > 0) && (
                <CardDivider />
              )}

              {additionalDetails.length > 0 && (
                <CardSection
                  className={educations.length === 0 && languages.length === 0 ? "pt-[30px]" : ""}
                >
                  <SectionTitle className="mb-[18px]">Additional details</SectionTitle>
                  <BulletList items={additionalDetails} />
                </CardSection>
              )}
            </ProfileCard>
          )}

          {/* Verifications */}
          <ProfileCard className="px-[25px] pt-[30px] pb-[25px]">
            <SectionTitle className="mb-[18px]">Verifications</SectionTitle>
            <ul className="flex flex-col gap-[8px]">
              {VERIFICATIONS.map(([label, read]) => {
                const verified = read ? read(selectedNanny?.verified) : false;
                return (
                  <li
                    key={label}
                    className="h-[52px] px-[16px] rounded-[14px] border border-[#EEEEEE] bg-white flex items-center justify-between gap-2"
                  >
                    <span className="Livvic-SemiBold text-[14px] leading-[14px] text-[#001243]">
                      {label}
                    </span>
                    {verified ? (
                      <img src="/check-circle.svg" alt="Verified" className="size-[20px]" />
                    ) : (
                      <span
                        className="size-[20px] rounded-full border-2 border-[#EEEEEE] shrink-0"
                        title="Not verified yet"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </ProfileCard>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="w-full lg:flex-1 lg:min-w-0 space-y-[25px]">

          {/* About / Credentials / Work Experience — one card in the design,
              split by full-width rules rather than three separate cards. */}
          {(about || credentials.length > 0 || ageGroups.length > 0) && (
            <ProfileCard>
              {about && (
                <CardSection className="pt-[30px]">
                  <SectionTitle className="mb-[16px]">
                    About {firstName || displayName}
                  </SectionTitle>
                  <p className="Livvic text-[16px] leading-[24px] text-[#555555]">{about}</p>
                </CardSection>
              )}

              {about && credentials.length > 0 && <CardDivider />}

              {credentials.length > 0 && (
                <CardSection className={about ? "" : "pt-[30px]"}>
                  <SectionTitle className="mb-[16px]">Credentials</SectionTitle>
                  <div className="flex flex-col">
                    {credentials.map((credential) => (
                      <p
                        key={credential}
                        className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]"
                      >
                        {`✔  ${sentenceCase(credential)}`}
                      </p>
                    ))}
                  </div>
                </CardSection>
              )}

              {ageGroups.length > 0 && (about || credentials.length > 0) && <CardDivider />}

              {ageGroups.length > 0 && (
                <CardSection className={about || credentials.length > 0 ? "" : "pt-[30px]"}>
                  <SectionTitle className="mb-[16px]">
                    {experience ? `Work Experience - ${experience}` : "Work Experience"}
                  </SectionTitle>
                  <BulletList items={ageGroups.map((group) => customFormat(String(group)))} />
                </CardSection>
              )}
            </ProfileCard>
          )}

          {/* Weekly Schedule ∥ Services */}
          {(schedule.length > 0 || services.length > 0) && (
            <div className="flex flex-col lg:flex-row gap-[20px] lg:gap-[25px] items-stretch">
              {schedule.length > 0 && (
                <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                  <SectionTitle className="mb-[22px]">Weekly Schedule</SectionTitle>
                  <div className="flex flex-col gap-[22px]">
                    {schedule.map(({ day, start, end }) => (
                      <div key={day} className="flex flex-col gap-[16px]">
                        <p className="Livvic-SemiBold text-[18px] leading-[16px] text-[#555555]">
                          {day}
                        </p>
                        {start && end && (
                          <p className="Livvic-Medium text-[16px] leading-[16px] text-[#666666]">
                            {start} - {end}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ProfileCard>
              )}

              {services.length > 0 && (
                <ProfileCard className="lg:flex-1 px-[25px] pt-[30px] pb-[30px]">
                  <SectionTitle className="mb-[22px]">Services</SectionTitle>
                  <div className="flex flex-col gap-[30px]">
                    {services.map(({ label, rate }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <span className="Livvic-SemiBold text-[18px] leading-[16px] text-[#555555]">
                          {label}
                        </span>
                        <span className="Livvic-Medium text-[16px] leading-[16px] text-[#666666]">
                          ${rate}/h
                        </span>
                      </div>
                    ))}
                  </div>
                </ProfileCard>
              )}
            </div>
          )}

          {/* Reviews. The panel and its match gate are shared with the two
              nanny-share profile views — see ProfileReviews. */}
          <ProfileReviews
            targetUserId={id}
            targetName={firstName || displayName}
            reviews={selectedNanny?.reviews}
            averageRating={selectedNanny?.averageRating}
            onReviewed={() => dispatch(fetchNannyByIdThunk(id))}
          />
        </div>
      </div>
    </div>
  );
}
