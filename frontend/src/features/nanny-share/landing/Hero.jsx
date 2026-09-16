import React, { useState, useEffect, useRef } from "react";
import Header from "@app/layout/Header";
import { Spin } from "antd";
import Button from "@shared/ui/Button";
import { useNavigate } from "react-router-dom";
import familyHeroImg from "@/assets/images/familyHero.webp";

function Hero() {
  const [zipCode, setZipCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGlowed, setHasGlowed] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsGlowing(true);
          setTimeout(() => setIsGlowing(false), 1000);
        }
      },
      { threshold: 0.5 },
    );

    if (buttonRef.current) observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, []); // Remove hasGlowed from deps

  const handleDataRetrieve = async () => {
    const zipCodeRegex = /^\d{5}(-\d{4})?$/;

    if (!zipCode || !zipCodeRegex.test(zipCode)) {
      fireToastMessage({
        type: "error",
        message: "Please enter a valid US ZIP code (e.g., 90210)",
      });
      return;
    }

    setIsLoading(true);

    try {
      const proxyUrl = `https://api.zippopotam.us/us/${zipCode.split("-")[0]}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error();

      const wrappedData = await res.json();

      if (!wrappedData) throw new Error("Invalid ZIP code");

      if (wrappedData && Object.keys(wrappedData).length > 0) {
        navigate(`/find-nanny-share?zipCode=${encodeURIComponent(zipCode)}`);
      } else {
        throw new Error("ZIP not found");
      }
    } catch (err) {
      fireToastMessage({
        type: "error",
        message:
          err.message ||
          "We couldn't verify that ZIP code. Please check and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative bg-white w-full pt-[80px] lg:pt-[100px] pb-[60px] overflow-hidden min-h-[580px] flex items-center">
      <Header />

      {/* Radial Gradient Background behind dashboard */}
      <div
        className="absolute right-[-80px] top-[-100px] w-[680px] h-[680px] rounded-full pointer-events-none z-0 hidden lg:block"
        style={{ background: 'radial-gradient(ellipse at center, #E7FCFF 0%, rgba(238,243,255,0.5) 55%, transparent 75%)' }}
      />

      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Stacked on mobile, this grid gap is the ONLY space between the copy
            and the dashboard mock — the right column adds none of its own — so
            they sit a text-block apart (gap-8 = the mt-8 rhythm in the copy). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">

          {/* ── LEFT COLUMN ── */}
          <div className="pr-0 lg:pr-8 relative z-10">
            <h1 className="fl-display text-ink mb-6">
              Nanny Share <br />
              <span className="text-accent Livvic-Bold">Made Simple</span>
            </h1>

            <p className="fl-lede text-[#4a5568] max-w-md mb-9">
              Connect with nearby families to share a nanny and split the cost of personalized childcare.
            </p>

            {/* Trust Items */}
            <div className="flex flex-wrap gap-5 mb-9">
              <div className="flex items-center gap-[7px] text-[13px] lg:text-[14px] font-[500] text-[#4a5568] Livvic">
                <div className="w-[24px] h-[24px] rounded-full bg-[#E7FCFF] flex items-center justify-center text-[12px]">📍</div>
                Location-based matching
              </div>
              <div className="flex items-center gap-[7px] text-[13px] lg:text-[14px] font-[500] text-[#4a5568] Livvic">
                <div className="w-[24px] h-[24px] rounded-full bg-[#fff5db] flex items-center justify-center text-[12px]">💰</div>
                <span className="leading-tight">~ Save up to 50% <br /> vs. hiring your own nanny</span>
              </div>
              <div className="flex items-center gap-[7px] text-[13px] lg:text-[14px] font-[500] text-[#4a5568] Livvic">
                <div className="w-[24px] h-[24px] rounded-full bg-[#f0fff4] flex items-center justify-center text-[12px]">✓</div>
                Free to browse
              </div>
            </div>

            {/* Call To Action */}
            <div className="mb-8">
              <Button
                btnText={isLoading ? <Spin size="small" /> : "Find a nanny share"}
                className="bg-[#FFADE1] hover:bg-[#ff94d4] text-[#001243] w-fit px-8 py-4 flex items-center justify-center rounded-full Livvic-Bold text-[16px] transition-colors"
                action={() => navigate(`/find-nanny-share`)}
                disabled={isLoading}
              />
            </div>

            {/* Social Proof */}
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[13px] text-[#4a5568] Livvic">
              <div className="flex">
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-livvic-bold text-ink shadow-sm bg-[#FF789F] z-[4]">S</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-livvic-bold text-ink shadow-sm bg-[#87C0FF] z-[3]">J</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-livvic-bold text-ink shadow-sm bg-[#00D261] z-[2]">M</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-livvic-bold text-ink shadow-sm bg-[#FFB300] z-[1]">R</div>
              </div>
              <div>
                Joined by <span className="font-livvic-bold text-ink">500+ families</span> across the Bay Area
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="relative z-10 flex items-end justify-center lg:justify-end w-full">
            {/* Inner Wrapper for Image and Cards to align together perfectly */}
            <div className="relative w-full max-w-[680px]">
              {/* Floating Card: Top Left */}
              <div className="absolute top-[5%] left-[5px] lg:left-[-16px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#F4F7FF] flex items-center justify-center text-[14px] sm:text-[16px]">🏠</div>
                <div>
                  12 matches nearby
                  <div className="fl-chip-sub">Oakland, CA</div>
                </div>
              </div>

              {/* Floating Card: Middle Left */}
              <div className="absolute top-[45%] -translate-y-1/2 left-[0px] lg:left-[-24px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#FFF8E7] flex items-center justify-center text-[14px] sm:text-[16px]">🔔</div>
                <div>
                  12 new match requests
                  <div className="fl-chip-sub">Families want to connect</div>
                </div>
              </div>

              {/* Floating Card: Bottom Right */}
              <div className="absolute bottom-[10%] right-[5px] lg:right-[8px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#F0FFF4] flex items-center justify-center text-[14px] sm:text-[16px]">💸</div>
                <div>
                  ~ Save up to 50%
                  <div className="fl-chip-sub">vs. hiring your own nanny</div>
                </div>
              </div>

              {/* Dashboard Image */}
              <img
                src={familyHeroImg}
                alt="Dashboard Preview"
                className="w-full rounded-t-[16px] sm:rounded-t-[20px] shadow-[0_-8px_48px_rgba(0,18,67,0.12),0_0_0_1px_rgba(0,0,0,0.05)] block object-cover object-top relative z-10 transition-all duration-300"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Hero;
