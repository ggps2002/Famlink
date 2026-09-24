import React, { useState } from "react";
import CustomButton from "@shared/ui/Button";
import Spinner from "@shared/ui/Spinner";
import { fireToastMessage } from "@shared/ui/toast";
import { PiggyBank, User, Users } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

// ─── Data ────────────────────────────────────────────────────────────────────

const STATE_MULTIPLIERS = {
  AL: 0.75, AK: 1.00, AZ: 0.85, AR: 0.72, CA: 1.00,
  CO: 0.90, CT: 0.95, DE: 0.85, DC: 0.95, FL: 0.82,
  GA: 0.78, HI: 1.05, ID: 0.78, IL: 0.88, IN: 0.78,
  IA: 0.72, KS: 0.74, KY: 0.74, LA: 0.75, ME: 0.90,
  MD: 0.92, MA: 0.98, MI: 0.80, MN: 0.90, MS: 0.70,
  MO: 0.76, MT: 0.82, NE: 0.75, NV: 0.82, NH: 0.92,
  NJ: 1.00, NM: 0.78, NY: 1.00, NC: 0.80, ND: 0.74,
  OH: 0.75, OK: 0.70, OR: 0.92, PA: 0.85, RI: 0.92,
  SC: 0.76, SD: 0.72, TN: 0.78, TX: 0.82, UT: 0.82,
  VT: 0.90, VA: 0.90, WA: 1.00, WV: 0.72, WI: 0.80,
  WY: 0.78,
};

const CITY_OVERRIDES = [
  { state: "CA", keywords: ["palo alto", "menlo park", "atherton"], multiplier: 1.30 },
  { state: "CA", keywords: ["san francisco"], multiplier: 1.25 },
  { state: "CA", keywords: ["bay area"], multiplier: 1.20 },
  { state: "CA", keywords: ["san jose"], multiplier: 1.18 },
  { state: "CA", keywords: ["oakland", "berkeley"], multiplier: 1.12 },
  { state: "CA", keywords: ["orange county"], multiplier: 1.10 },
  { state: "CA", keywords: ["los angeles"], multiplier: 1.08 },
  { state: "CA", keywords: ["san diego"], multiplier: 1.00 },
  { state: "CA", keywords: ["sacramento"], multiplier: 0.95 },
  { state: "NY", keywords: ["manhattan"], multiplier: 1.28 },
  { state: "NY", keywords: ["new york"], multiplier: 1.20 },
  { state: "NY", keywords: ["brooklyn"], multiplier: 1.12 },
  { state: "NY", keywords: ["long island"], multiplier: 1.08 },
  { state: "NY", keywords: ["upstate"], multiplier: 0.90 },
  { state: "FL", keywords: ["palm beach"], multiplier: 1.00 },
  { state: "FL", keywords: ["miami"], multiplier: 0.95 },
  { state: "FL", keywords: ["tampa"], multiplier: 0.84 },
  { state: "FL", keywords: ["orlando"], multiplier: 0.82 },
  { state: "FL", keywords: ["jacksonville"], multiplier: 0.78 },
  { state: "TX", keywords: ["highland park", "westlake"], multiplier: 1.00 },
  { state: "TX", keywords: ["austin"], multiplier: 0.92 },
  { state: "TX", keywords: ["dallas"], multiplier: 0.85 },
  { state: "TX", keywords: ["houston"], multiplier: 0.80 },
  { state: "IL", keywords: ["north shore"], multiplier: 1.00 },
  { state: "IL", keywords: ["chicago"], multiplier: 0.95 },
  { state: "WA", keywords: ["bellevue"], multiplier: 1.12 },
  { state: "WA", keywords: ["seattle"], multiplier: 1.08 },
  { state: "MA", keywords: ["cambridge"], multiplier: 1.10 },
  { state: "MA", keywords: ["boston"], multiplier: 1.08 },
  { state: "DC", keywords: ["georgetown"], multiplier: 1.00 },
  { state: "OK", keywords: ["tulsa"], multiplier: 0.72 },
  { state: "OK", keywords: ["okc", "oklahoma city"], multiplier: 0.75 },
];

const BASE_RATE = 31.12;

function getMultiplier(stateAbbr, placeName) {
  const state = (stateAbbr || "").toUpperCase();
  const place = (placeName || "").toLowerCase();
  const stateOverrides = CITY_OVERRIDES.filter((o) => o.state === state);
  for (const o of stateOverrides) {
    if (o.keywords.some((k) => place.includes(k))) return o.multiplier;
  }
  return STATE_MULTIPLIERS[state] ?? 1.0;
}

function roundHundred(n) {
  return Math.round(n / 100) * 100;
}

function fmt(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function calculate(multiplier, hoursPerWeek) {
  const lowPrivate = BASE_RATE * multiplier * 0.93;
  const highPrivate = BASE_RATE * multiplier * 1.07;
  const lowShare = lowPrivate * 0.50;
  const highShare = highPrivate * 0.65;
  const lowPrivateMonthly = lowPrivate * hoursPerWeek * 4.33;
  const highPrivateMonthly = highPrivate * hoursPerWeek * 4.33;
  const lowShareMonthly = lowShare * hoursPerWeek * 4.33;
  const highShareMonthly = highShare * hoursPerWeek * 4.33;
  const lowSavingsMonthly = lowPrivateMonthly - highShareMonthly;
  const highSavingsMonthly = highPrivateMonthly - lowShareMonthly;
  return {
    privateHourly: [Math.round(lowPrivate), Math.round(highPrivate)],
    shareHourly: [Math.round(lowShare), Math.round(highShare)],
    privateMonthly: [roundHundred(lowPrivateMonthly), roundHundred(highPrivateMonthly)],
    shareMonthly: [roundHundred(lowShareMonthly), roundHundred(highShareMonthly)],
    savingsMonthly: [roundHundred(lowSavingsMonthly), roundHundred(highSavingsMonthly)],
    savingsYearly: [roundHundred(lowSavingsMonthly * 12), roundHundred(highSavingsMonthly * 12)],
  };
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const PersonIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="11" r="5" stroke="#6B8FD4" strokeWidth="2" />
    <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#6B8FD4" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ShareIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <circle cx="11" cy="11" r="4" stroke="#4CAF7D" strokeWidth="2" />
    <circle cx="21" cy="11" r="4" stroke="#4CAF7D" strokeWidth="2" />
    <path d="M3 27c0-4.418 3.582-8 8-8" stroke="#4CAF7D" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 19c4.418 0 8 3.582 8 8" stroke="#4CAF7D" strokeWidth="2" strokeLinecap="round" />
    <path d="M11 19c1.313-.639 2.748-1 4.25-1h1.5" stroke="#4CAF7D" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PiggyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
    <ellipse cx="17" cy="20" rx="11" ry="9" stroke="#B8860B" strokeWidth="2" />
    <circle cx="27" cy="17" r="3" stroke="#B8860B" strokeWidth="2" />
    <path d="M13 14c1-3 4-4 6-4" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="14" cy="19" r="1" fill="#B8860B" />
    <path d="M14 29v3M20 29v3" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 11V8l3-2" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);



// ─── Component ───────────────────────────────────────────────────────────────

export default CostEstimation;

function CostEstimation() {
  const [hours, setHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [zipCode, setZipCode] = useState(null)
  const navigate = useNavigate();

  const handleZipValidation = async (zip) => {
    if (!zip) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("Invalid ZIP");
      const data = await res.json();
      const finalZip = data["post code"];
      if (finalZip) {
        setZipCode(finalZip);
      } else {
        throw new Error("Invalid structure");
      }
    } catch (err) {
      setZipCode("");
      fireToastMessage({
        type: "error",
        message: "Invalid ZIP code. Please enter a valid U.S. ZIP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEstimate = async () => {
    const h = parseFloat(hours);
    if (!zipCode || zipCode.length < 5) {
      fireToastMessage({ type: "error", message: "Please enter a valid ZIP code." });
      return;
    }
    if (!h || h <= 0) {
      fireToastMessage({ type: "error", message: "Please enter hours per week." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (!res.ok) throw new Error("Invalid ZIP");
      const data = await res.json();
      const place = data.places?.[0];
      const stateAbbr = place?.["state abbreviation"] ?? "";
      const placeName = place?.["place name"] ?? "";
      const multiplier = getMultiplier(stateAbbr, placeName);
      setLocationLabel(`${placeName}, ${stateAbbr}`);
      setResult(calculate(multiplier, h));
    } catch {
      fireToastMessage({ type: "error", message: "Invalid ZIP code. Please enter a valid U.S. ZIP." });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-10 sm:py-14 lg:py-16 relative Livvic flex justify-center items-center min-h-[400px] sm:min-h-[600px]">

      {/* Decorations */}
      <div className="absolute top-4 right-4 hidden sm:block pointer-events-none">
        <img src="/icons/Background/Sun.svg" alt="sun" />
      </div>
      <div className="absolute bottom-4 left-4 hidden sm:block pointer-events-none">
        <img src="/icons/Background/Rainbow.svg" alt="rainbow" />
      </div>

      <div className="text-center w-full max-w-5xl px-4">
        {/* Heading */}
        {/* Was `text-lg sm:text-5xl` — 18px on a phone jumping straight to 48px,
            larger than any other heading on the pages this panel sits in, and
            with a hard <br> that broke mid-phrase at most widths. */}
        <h2 className="fl-h2 text-ink text-center mx-auto max-w-heading">
          See how much you could save each month by sharing a nanny.
        </h2>

        {/* Input Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-12 justify-center items-center w-full px-4 sm:px-0">
          <div className="relative w-full sm:w-[300px]">
            <input
              name="zipCode"
              placeholder="Enter zip code"
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ""))}
              onBlur={(e) => handleZipValidation(e.target.value.trim())}
              value={zipCode}
              maxLength={5}
              className="w-full p-3 sm:p-4 rounded-full border-2 border-[#D6DDEB] bg-white text-ink placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            {loading && (
              <Spinner
                size="small"
                className="absolute z-10 right-4 top-1/2 -translate-y-1/2 text-accent"
              />
            )}
          </div>

          {/* `suffix` was antd's; a plain input needs the label positioned and
              the right padding reserved so long values do not run under it. */}
          <div className="relative w-full sm:w-[300px]">
            <input
              name="hoursPerWeek"
              placeholder="Hours needed per week"
              type="number"
              min={1}
              max={168}
              onChange={(e) => setHours(e.target.value)}
              value={hours}
              className="w-full p-3 sm:p-4 rounded-full border-2 border-[#D6DDEB] bg-white text-ink placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all pr-20"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-subtle text-sm">
              hrs/week
            </span>
          </div>

          <CustomButton
            btnText="Estimate Savings"
            className="bg-[#FFADE1] w-full sm:w-auto px-6 py-3 sm:py-4"
            action={() => handleEstimate()}
            isLoading={loading}
            loadingBtnText="Calculating..."
          />
        </div>

        {/* Results */}
        {result && (
          <div className="w-full max-w-4xl mt-10 flex flex-col items-center gap-4 mx-auto">

            {/* Private vs Share cards */}
            <div className="flex flex-col sm:flex-row items-stretch gap-0 w-full relative">
              {/* Private Nanny card */}
              <div className="flex-1 bg-blue-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User />
                  </div>
                  <div>
                    <div className="Livvic-Bold text-gray-900 text-lg leading-tight">Traditional Nanny</div>
                    <div className="text-gray-500 text-sm text-left">One-on-one care</div>
                  </div>
                </div>
                <div className="border-t border-blue-200 mb-4" />
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">Estimated hourly rate</div>
                    <div className="text-2xl font-livvic-bold text-ink leading-none">
                      ${result.privateHourly[0]}–{result.privateHourly[1]}
                      <span className="text-sm Livvic-Medium text-gray-500"> /hr</span>
                    </div>
                  </div>
                  <div className="border-l border-blue-200 self-stretch" />
                  <div className="flex-1 pl-4">
                    <div className="text-xs text-gray-500 mb-1">Estimated monthly cost</div>
                    <div className="text-2xl font-livvic-bold text-ink leading-none">
                      ~{fmt(result.privateMonthly[0])}–{fmt(result.privateMonthly[1])}
                      <span className="text-sm Livvic-Medium text-gray-500"> /mo</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-4">
                  Based on your location and {hours} hrs/week
                </div>
              </div>

              {/* VS badge */}
              <div className="flex items-center justify-center sm:-mx-5 z-10 my-3 sm:my-0">
                <div className="w-11 h-11 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center font-livvic-bold text-xs text-subtle shadow-sm">
                  VS
                </div>
              </div>

              {/* Nanny Share card */}
              <div className="flex-1 bg-green-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Users className="text-green-700" />
                  </div>
                  <div>
                    <div className="Livvic-Bold text-gray-900 text-lg leading-tight">Nanny Share Caregiver</div>
                    <div className="text-gray-500 text-sm text-left">Care shared with another family</div>
                  </div>
                </div>
                <div className="border-t border-green-200 mb-4" />
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">Estimated hourly rate</div>
                    <div className="text-2xl font-livvic-bold text-green-700 leading-none">
                      ${result.shareHourly[0]}–{result.shareHourly[1]}
                      <span className="text-sm Livvic-Medium text-gray-500"> /hr</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">per family</div>
                  </div>
                  <div className="border-l border-green-200 self-stretch" />
                  <div className="flex-1 pl-4">
                    <div className="text-xs text-gray-500 mb-1">Estimated monthly cost</div>
                    <div className="text-2xl font-livvic-bold text-green-700 leading-none">
                      ~{fmt(result.shareMonthly[0])}–{fmt(result.shareMonthly[1])}
                      <span className="text-sm Livvic-Medium text-gray-500"> /mo</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-4">
                  Based on your location and {hours} hrs/week
                </div>
              </div>
            </div>

            {/* Savings bar */}
            <div className="w-full bg-yellow-50 rounded-2xl px-6 py-5 flex flex-wrap items-center gap-5 justify-center sm:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                  <PiggyBank />
                </div>
                <div>
                  <div className="Livvic-Bold text-gray-900 text-lg leading-tight">Estimated savings</div>
                  <div className="text-gray-500 text-sm">with a nanny share</div>
                </div>
              </div>

              <div className="border-l border-yellow-200 self-stretch hidden sm:block" />

              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-livvic-bold text-green-600 leading-none">
                  ~{fmt(result.savingsMonthly[0])}–{fmt(result.savingsMonthly[1])}
                </div>
                <div className="text-xs text-gray-500 mt-1">per month</div>
              </div>

              <div className="border-l border-yellow-200 self-stretch hidden sm:block" />

              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-livvic-bold text-green-600 leading-none">
                  ~{fmt(result.savingsYearly[0])}–{fmt(result.savingsYearly[1])}
                </div>
                <div className="text-xs text-gray-500 mt-1">per year</div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Estimates are based on average local rates and may vary.
              {locationLabel && ` Location detected: ${locationLabel}.`}
            </p>
            <NavLink to={"/find-nanny-share"} onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }>
              <CustomButton
                btnText={"See Local Matches"}
                className="bg-pink-300 px-6 py-4"
              />
            </NavLink>
            {/* <CustomButton className="mt-1 bg-pink-300 hover:bg-pink-400 transition-colors text-gray-900 Livvic-Bold text-base rounded-full px-9 py-3.5 shadow-md">
            See Local Matches &nbsp;→
          </CustomButton> */}
          </div>
        )}
      </div>
    </div>
  );
}