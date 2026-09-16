import { Clock, Home, Calendar, DollarSign, MapPin, Users } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import InfoTip from "@shared/ui/InfoTip";
import { RATE_HINTS } from "@shared/lib/rates";
import {
  getFamilyTheme,
  getNannyTheme,
  getFamilyGoal,
  getNannyGoal,
  ShareTypeLabel,
} from "@features/nanny-share/shareTypeTheme";
import {
  formatScheduleDays,
  formatAgeLabels,
  formatCareTypeLabel,
  formatHostingLabel,
} from "@shared/lib/scheduleFormat";
import dayjs from "dayjs";

// The card on a shared profile page.
//
// Deliberately the same card the dashboard shows — same container, badge, meta
// grid, type scale and responsive behaviour as FamilyProfile / NannyProfile in
// Components/subComponents/profileCard.jsx — with the identifying parts removed:
// no photo, no name, no initials. A reader gets the whole opportunity and none
// of the person.
//
// It's a separate component rather than a prop on the dashboard cards because
// those are wired end to end into the signed-in session: the store's auth user,
// favourites, the match gate, block/reject modals, navigation into /dashboard.
// None of that exists for the stranger this page is built for, and threading a
// "public" flag through all of it would put the app's most-used screen one
// null-check away from breaking. The trade is that the two have to be kept in
// step by hand — if you change the meta row here, change it there too.
//
// Everything rendered comes from the server's privacy-safe projection
// (backend/Services/utils/shareProfile.js), which is what actually guarantees
// the redaction; this component simply has nothing identifying to draw.

// Start dates arrive as an ISO string, a quoted ISO string, or free text like
// "Flexible" — which has to survive rather than become "Invalid Date".
const formatStart = (start) => {
  if (!start) return "";
  const cleaned = String(start).replace(/"/g, "");
  const parsed = dayjs(cleaned);
  return parsed.isValid() ? parsed.format("MMMM D, YYYY") : cleaned;
};

// A meta cell: icon, a primary line, and an optional quieter second line.
// Cells with nothing to say are dropped entirely — on a page meant to attract
// strangers, five greyed-out "not set" placeholders read as an abandoned
// listing, which is the opposite of what a shared link is for.
const MetaItem = ({ icon, primary, secondary, capitalize = false, hint = "" }) =>
  primary || secondary ? (
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
        {primary && (
          <span
            className={`text-xs Livvic-Medium text-[#202020] whitespace-nowrap inline-flex items-center gap-1 ${
              capitalize ? "capitalize" : ""
            }`}
          >
            {primary}
            <InfoTip text={hint} size={12} />
          </span>
        )}
        {secondary && (
          <span
            className={`Livvic-Medium whitespace-nowrap ${
              primary ? "text-[10px] text-[#888]" : "text-xs text-[#202020]"
            }`}
          >
            {secondary}
          </span>
        )}
      </div>
    </div>
  ) : null;

export default function SharedProfileCard({ profile, ctaText, onCta, ctaLoading }) {
  if (!profile) return null;

  const {
    role,
    hasNanny,
    hasFamily,
    careType,
    schedule,
    location,
    sharedRate,
    soloRate,
    rateType,
    hosting,
    start,
    childrenCount,
    ages,
    experience,
  } = profile;

  const isFamily = role === "Family";
  const theme = isFamily ? getFamilyTheme(hasNanny) : getNannyTheme(hasFamily);
  const goal = isFamily ? getFamilyGoal(hasNanny) : getNannyGoal(hasFamily);

  const scheduleText = formatScheduleDays(schedule);
  const ageText = formatAgeLabels(ages);

  // A caregiver still looking for a share is describing themselves — their
  // experience, the ages they take, when they're free. Everyone else is
  // describing a share that already has children in it. Same split the
  // dashboard card makes.
  const isUnplacedCaregiver = !isFamily && !hasFamily;

  // The per-family share leads, and a solo rate — which only a caregiver has —
  // follows it. The other way round, the larger number came first and a share
  // read as the expensive option; and a family has no solo rate to show at all.
  const isRateSet = (rate) => Boolean(rate) && rate !== "N/A";
  const ratePrimary = isRateSet(sharedRate) ? sharedRate : null;
  const rateSecondary = isRateSet(soloRate) ? `${soloRate} on their own` : null;
  const hasRate = Boolean(ratePrimary || rateSecondary);

  const primaryLocation = location?.city || location?.neighborhood;
  const secondaryLocation = location?.neighborhood && location?.city ? location.neighborhood : null;

  const metaItems = (
    <>
      <MetaItem
        icon={<Clock size={18} className="text-[#6366F1] flex-shrink-0" />}
        primary={formatCareTypeLabel(careType)}
        secondary={scheduleText}
        capitalize
      />

      <MetaItem
        icon={<MapPin size={18} className="text-[#F59E0B] flex-shrink-0" />}
        primary={primaryLocation}
        secondary={secondaryLocation}
      />

      {hasRate && (
        <MetaItem
          icon={<DollarSign size={18} className="text-[#10B981] flex-shrink-0" />}
          primary={ratePrimary}
          secondary={rateSecondary}
          hint={isFamily ? RATE_HINTS.familyBudget : RATE_HINTS.eachFamily}
        />
      )}

      {hosting && (
        <MetaItem
          icon={<Home size={18} className="text-[#F97316] flex-shrink-0" />}
          primary="Hosting Preference"
          secondary={formatHostingLabel(hosting)}
        />
      )}

      {start && (
        <MetaItem
          icon={<Calendar size={18} className="text-[#3B82F6] flex-shrink-0" />}
          // Families and placed nannies are describing when the share begins;
          // a nanny without a family is describing when they're free.
          primary={isUnplacedCaregiver ? "Available" : "Starting"}
          secondary={formatStart(start)}
        />
      )}
    </>
  );

  return (
    <div className="max-w-[1400px] bg-white border border-[#ECECEC] transition-all duration-300 rounded-3xl overflow-hidden">
      {/* ── CARD INNER ── */}
      <div className="flex flex-col md:flex-row md:items-stretch md:min-h-[192px]">
        {/* ── LEFT ── */}
        <div className="flex flex-col flex-1 px-4 py-4 sm:px-5 sm:py-4 md:px-5 md:py-4 min-w-0">
          {/* No avatar and no name: the badge is the top of the card here. */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 md:mb-1">
              <span
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className="inline-flex items-center gap-1.5 font-bold Livvic-Bold rounded-full px-3 py-1 text-[11px] md:text-xs flex-shrink-0"
              >
                <Users size={12} className="sm:hidden" />
                <Users size={13} className="hidden sm:block" />
                <ShareTypeLabel role={role} goal={goal} />
              </span>
            </div>

            {/* Children (families and placed nannies) or experience + ages
                (a nanny looking for a position) — the same line, same order and
                same separator the dashboard card uses in each case. */}
            {!isUnplacedCaregiver ? (
              <p className="text-[13px] text-[#5D5D5D] mb-1.5 md:mb-1 leading-tight overflow-hidden">
                <span className="Livvic-Medium text-[#202020] whitespace-nowrap">
                  {childrenCount || 0} Child{childrenCount !== 1 && "ren"}
                </span>
                {ageText && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="Livvic-Medium text-[#202020]">{ageText}</span>
                  </>
                )}
              </p>
            ) : (
              (experience || ageText) && (
                <p className="text-[13px] text-[#5D5D5D] mb-1.5 md:mb-1 leading-tight overflow-hidden">
                  {experience && (
                    <span className="Livvic-Medium text-[#202020] whitespace-nowrap">
                      {experience} experience
                    </span>
                  )}
                  {experience && ageText && <span className="mx-2">•</span>}
                  {ageText && (
                    <span className="Livvic-Medium text-xs text-[#202020]">{ageText}</span>
                  )}
                </p>
              )
            )}

            {/* Meta items — desktop inline (md+), hidden on mobile */}
            <div className="hidden md:grid md:grid-cols-2 gap-x-12 gap-y-0">
              {metaItems}
            </div>
          </div>

          {/* Meta items — mobile full-width (hidden on md+) */}
          <div className="flex flex-wrap content-start gap-x-6 gap-y-1 mt-2 md:hidden">
            {metaItems}
          </div>
        </div>

        {/* ── HORIZONTAL DIVIDER (mobile only) ── */}
        <div className="block md:hidden h-px bg-[#E9E9E9] mx-4 sm:mx-5" />

        {/* ── RIGHT PANEL ── */}
        <div
          className="
            flex items-center justify-center gap-2 px-4 py-3
            md:flex-col md:p-4 md:gap-2
            w-full md:w-[210px] lg:w-[240px]
            flex-shrink-0 mt-1 md:mt-0
          "
        >
          <div className="w-full">
            <CustomButton
              btnText={ctaText}
              action={onCta}
              isLoading={ctaLoading}
              loadingBtnText="Opening…"
              className="w-full bg-[#AEC4FF] text-sm text-[#0D134C] !h-10 flex items-center justify-center !rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
