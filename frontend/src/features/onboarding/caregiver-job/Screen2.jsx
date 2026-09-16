import { Calendar, Clock, DollarSign, Home, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import Avatar from "react-avatar";
import { ShareTypeBadge } from "@features/nanny-share/shareTypeTheme";

/* ── Mock matches (families a caregiver can share with) ──
   variant drives the badge (color + label, from the shared theme) and which
   fields render:
   - familyLooking / familyHasNanny → child ages, schedule, location, hosting, start date, rate (total + per family)
*/
const matches = [
  {
    id: 1,
    name: "Johnson",
    variant: "familyLooking",
    headingParts: ["1 Child", "2 yrs"],
    schedule: "Full-Time",
    scheduleDetail: "Mon–Fri",
    location: { neighborhood: "Rockridge", city: "Oakland" },
    hosting: "Your Home",
    start: "July 15, 2026",
    rate: { total: "~$40–50/hr", perFamily: "~$20–25/hr per family" },
    delay: "delay-[0ms]",
  },
  {
    id: 2,
    name: "Martinez",
    variant: "familyHasNanny",
    headingParts: ["2 Children", "4 yrs, 7 yrs"],
    schedule: "Part-Time",
    scheduleDetail: "Mon–Fri",
    location: { neighborhood: "Temescal", city: "Oakland" },
    hosting: "Rotating Between Homes",
    start: "July 11, 2026",
    rate: { total: "~$45–55/hr", perFamily: "~$22–27/hr per family" },
    delay: "delay-[80ms]",
  },
  {
    id: 3,
    name: "Chen",
    variant: "familyLooking",
    headingParts: ["1 Child", "3 yrs"],
    schedule: "Flexible",
    // scheduleDetail: "Weekdays, flexible hours",
    location: { neighborhood: "Piedmont", city: "Oakland" },
    hosting: "Other Family's Home",
    start: "August 1, 2026",
    rate: { total: "~$40-35/hr", perFamily: "~$20–17.5/hr per family" },
    delay: "delay-[160ms]",
  },
];

/* ── Icons ── */
const ClockIcon = () => (
  <Clock className="text-[#6366F1] w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0"/>
);
const MapPinIcon = () => (
  <MapPin className="text-[#F59E0B] w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0"/>
);
const HomeIcon = () => (
  <Home className="text-[#F97316] w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0"/>
);
const CalendarIcon = () => (
  <Calendar className="text-[#3B82F6] w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0"/>
);
const DollarIcon = () => (
  <DollarSign className="text-[#10B981] w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0"/>
);
const BabyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
    <path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M17.4 15A6.8 6.8 0 0 0 19 11a7 7 0 0 0-14 0 6.8 6.8 0 0 0 1.6 4" /><path d="M12 4v.01" />
  </svg>
);
const UsersIcon = ({ color = "#5fbfff", size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const HeartIcon = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "#EF4444" : "none"} stroke={filled ? "#EF4444" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const LockIcon = ({ size = 15, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/* ── MetaItem ── */
function MetaItem({ icon, line1, line2 }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[28px]">
        <span className="text-xs Livvic-Medium text-[#202020] truncate">{line1}</span>
        {line2 && <span className="text-[10px] text-[#888] Livvic-Medium truncate">{line2}</span>}
      </div>
    </div>
  );
}

function MatchCard({ match, visible }) {
  const [favorited, setFavorited] = useState(false);

  /* Meta items — rendered fields depend on the match variant */
  const metaItems = (
    <>
      {match.preferredAges && (
        <MetaItem icon={<BabyIcon />} line1="Preferred ages" line2={match.preferredAges} />
      )}
      <MetaItem icon={<ClockIcon />} line1={match.schedule} line2={match.scheduleDetail} />
      <MetaItem icon={<MapPinIcon />} line1={`${match.location.neighborhood},`} line2={match.location.city} />
      {match.hosting && <MetaItem icon={<HomeIcon />} line1={"Hosting Preference"} line2={match.hosting} />}
      <MetaItem
        icon={<CalendarIcon />}
        line1={match.variant === "nannyLooking" ? "Available" : "Starting"}
        line2={match.start}
      />
      <MetaItem
        icon={<DollarIcon />}
        line1={match.rate.total || match.rate.perFamily}
        line2={match.rate.total ? match.rate.perFamily : null}
      />
    </>
  );

  return (
    <div className={`
      bg-white border border-[#ECECEC] rounded-2xl overflow-hidden
      transition-all duration-500 ${match.delay}
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
    `}>
      <div className="flex flex-col sm:flex-row sm:items-stretch">

        {/* LEFT */}
        <div className="flex flex-col flex-1 px-4 py-4 sm:px-5 sm:py-4 md:px-5 md:py-4 min-w-0">
          <div className="flex gap-4 sm:gap-6">

            {/* Avatar (initials) */}
            <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden">
              <div className="block md:hidden"><Avatar name={match.name} color="#AEC4FF" fgColor="#0D134C" size="80" style={{ borderRadius: '1rem', fontWeight: '900', fontFamily: 'Livvic' }} /></div>
              <div className="hidden md:block"><Avatar name={match.name} color="#AEC4FF" fgColor="#0D134C" size="96" style={{ borderRadius: '1rem', fontWeight: '900', fontFamily: 'Livvic' }} /></div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-w-0">

              {/* Badge + Heart (mobile only) */}
              <div className="flex items-start justify-between gap-2 mb-2 md:mb-0.5">
                <ShareTypeBadge variant={match.variant} className="min-w-0" />

                {/* Heart — mobile only */}
                <button
                  onClick={() => setFavorited(f => !f)}
                  className="sm:hidden bg-transparent border-none cursor-pointer p-0.5 flex-shrink-0"
                >
                  <HeartIcon filled={favorited} />
                </button>
              </div>

              {/* Name */}
              <h2 className="text-base md:text-[17px] font-black Livvic-Bold text-[#0D134C] mb-0 truncate">
                {match.name}
              </h2>

              {/* Heading line — child ages or experience */}
              <p className="text-[13px] text-[#5D5D5D] flex flex-wrap items-center gap-x-1.5 mb-1.5 md:mb-1">
                {match.headingParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span>•</span>}
                    <span className="Livvic-SemiBold text-[#202020]">{part}</span>
                  </React.Fragment>
                ))}
              </p>

              {/* Meta — desktop */}
              <div className="hidden sm:flex flex-wrap gap-x-5 gap-y-2">
                {metaItems}
              </div>
            </div>
          </div>

          {/* Meta — mobile grid */}
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-x-3 gap-y-2 mt-3 sm:hidden">
            {metaItems}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="
          flex flex-wrap items-center justify-between gap-2 px-4 py-3
          sm:flex-col sm:flex-nowrap sm:justify-start sm:px-4 sm:py-4 md:px-5 md:py-4
          sm:w-[200px] lg:w-[220px] flex-shrink-0 sm:gap-3
        ">
          {/* Heart — desktop only (top-right) */}
          <button
            onClick={() => setFavorited(f => !f)}
            className="hidden sm:block bg-transparent border-none cursor-pointer p-1 sm:self-end sm:mb-4"
          >
            <HeartIcon filled={favorited} />
          </button>

          {/* View Details */}
          <button className="
            flex items-center gap-1 bg-transparent border-none cursor-pointer
            text-[#0D134C] Livvic-SemiBold text-sm whitespace-nowrap mb-2
          ">
            View Details
            <ChevronRightIcon />
          </button>

          {/* Request Match */}
          <button className="
            flex items-center gap-1.5 justify-center
            bg-[#AEC4FF] hover:opacity-90 text-[#0D134C] border-none
            h-10 rounded-xl cursor-pointer transition-colors duration-200
            flex-shrink-0 w-full px-3 text-sm font-bold Livvic-Bold whitespace-nowrap
          ">
            <span className="flex shrink-0"><UsersIcon color="#0D134C" size={14} /></span>
            <span className="Livvic-Bold font-bold">Request a Match</span>
            <span className="flex shrink-0"><LockIcon size={14} color="#0D134C" /></span>
          </button>
        </div>

      </div>
    </div>
  );
}

const Screen2 = ({ onCreateAccount, location, distance }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen pb-24 bg-white -mx-10 lg:mx-0">

      {/* HEADER */}
      <div className={`
        max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 sm:pb-5
        transition-all duration-500
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
      `}>
        <div className="flex items-start gap-3 mb-2">
          <h1 className="Livvic-Bold text-2xl sm:text-3xl lg:text-4xl text-[#1E1B4B] leading-snug flex-1">
            Great news! We found compatible nanny share matches near you.
          </h1>
          <span className="text-2xl text-[#818CF8] flex-shrink-0 mt-1">✦✦</span>
        </div>

        <p className="Livvic-Medium text-[#6B7280] leading-relaxed mb-4">
          Create your account to view full details, send requests, and start connecting.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5">
          <span className="Livvic-SemiBold text-base text-[#1E1B4B]">Matches near you</span>
          <span className="flex items-center gap-1 text-sm Livvic-Medium text-[#6B7280]">
            <MapPin size={14} />
            {location.neighborhood ? `${location.neighborhood}, ${location.city}` : `${location.city}`} (within {distance})
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-3 sm:gap-4 lg:gap-5">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} visible={visible} />
        ))}
      </div>

      {/* STICKY BOTTOM BANNER */}
      <div className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-[#3730A3] px-4 sm:px-7 py-3 sm:py-3.5
        flex items-center justify-between gap-2 sm:gap-3
        transition-opacity duration-500 delay-[400ms]
        ${visible ? "opacity-100" : "opacity-0"}
      `}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <LockIcon size={16} color="#fff" />
          <span className="Livvic-Bold text-xs sm:text-sm text-white leading-tight truncate">
            Create account to unlock matches
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <span className="hidden sm:block text-sm text-[#C7D2FE] whitespace-nowrap">
            Join Famlink to message, connect, and build your nanny share.
          </span>
          <button
            onClick={onCreateAccount}
            className="bg-white text-[#3730A3] Livvic-Bold text-xs sm:text-sm border-none rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 cursor-pointer whitespace-nowrap hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            Create Account
          </button>
        </div>
      </div>

    </div>
  );
};

export default Screen2;
