import React, { useState, useEffect, useRef } from "react";
import Header from "@app/layout/Header";
import { Spin, Input } from "antd";
import { fireToastMessage } from "@shared/ui/toast";
import Button from "@shared/ui/Button";
import { useNavigate } from "react-router-dom";
import SFImg from "../../../assets/images/SFImage.webp";

// The hero photo is location-appropriate: the San Francisco bridge on the SF
// page, and a generic nanny-share match photo on every other neighborhood.
// (Oakland uses its own HeroOakland component and never reaches this one.)
function Hero({ city }) {
  const heroImage = city === "San Francisco" ? SFImg : "/nannyshareMatches.webp";
  const [zipCode, setZipCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      { threshold: 0.5 }
    );

    if (buttonRef.current) observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, []);

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
    // No viewport min-height: it forced the hero to fill the screen and dumped
    // every leftover pixel into a dead band above the bottom curve. Bottom
    // padding is sized to clear the 80px curve (NannyShareCityPage) once the
    // wrapper's own pb-8 is counted — deep enough that the copy never touches
    // it, shallow enough to match the section rhythm on the other city pages.
    <div className="Livvic container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 bg-white pb-12 sm:pb-16">
      {/* Keyframes */}
      <style>{`
        @keyframes buttonGlow {
          0%   { box-shadow: 0 0 0px rgba(174, 196, 255, 0); }
          40%  { box-shadow: 0 0 18px 6px rgba(174, 196, 255, 0.6); }
          100% { box-shadow: 0 0 0px rgba(174, 196, 255, 0); }
        }
        .glow-once {
          animation: buttonGlow 1s ease-out forwards;
        }
      `}</style>

      <Header />

      {/* Two-column layout on lg+, stacked on smaller screens */}
      {/* Stacked on mobile, the column gap is the ONLY space between the copy
          and the photo — the image column adds none of its own (see below), so
          the two sit a text-block apart (gap-8 = the mt-8 rhythm above) rather
          than the ~100px the two spacings used to add up to. */}
      <div className="mt-8 sm:mt-10 lg:mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12 pb-8">

        {/* Left: Text + CTA */}
        <div className="flex-1 max-w-2xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[#F8F9FF] px-3 py-1.5 rounded-full mb-6 border border-[#DDE5FF]">
            <span className="text-[14px]">📍</span>
            <span className="text-[#001243] text-[11px] font-bold tracking-widest uppercase">
              {city}
            </span>
          </div>

          <h1 className="fl-display text-ink">
            Nanny share is coming to <span className="text-[#AEC4FF] Livvic-Bold">{city}</span>
          </h1>

          <p className="fl-lede mt-6 max-w-xl">
            We’re expanding neighborhood by neighborhood.
            <br /><br />
            Join the waitlist to be among the first notified when nanny share matches become available near you.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <div
              ref={buttonRef}
              className={`w-full sm:w-auto inline-block ${isGlowing ? "glow-once rounded-full" : ""}`}
            >
              <Button
                btnText={isLoading ? <Spin size="small" /> : "Join Waitlist"}
                className="bg-[#AEC4FF] hover:bg-[#92b0ff] text-[#001243] Livvic-Bold w-full sm:w-auto px-8 py-3.5 text-[15px] flex items-center justify-center rounded-full transition-colors"
                action={() => navigate(`/waitlist`)}
                disabled={isLoading}
              />
            </div>
            <Button
              btnText="Learn More ➔"
              className="bg-white hover:bg-gray-50 border border-gray-200 text-[#001243] Livvic-Bold w-full sm:w-auto px-8 py-3.5 text-[15px] flex items-center justify-center rounded-full transition-colors"
              action={() => navigate("/")}
            />
          </div>

          {/* Features */}
          <div className="mt-10 flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="bg-[#F8F9FF] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">📍</span>
              <span className="text-[13px] text-[#666] font-semibold">Location-based matching</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FDF2F8] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">💰</span>
              <span className="text-[13px] text-[#666] font-semibold">Save up to 40%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#F0FDF4] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">✔️</span>
              <span className="text-[13px] text-[#666] font-semibold">Free to browse</span>
            </div>
          </div>
        </div>

        {/* Right: Image — SF bridge on the SF page, a nanny-share match photo elsewhere. */}
        <div className="flex-1 w-full flex justify-center lg:justify-end relative">
          <div className="relative w-full max-w-[600px]">
            <img
              src={heroImage}
              alt={`Nanny share in ${city}`}
              className="w-full h-auto object-cover rounded-[24px] shadow-lg aspect-[4/3] sm:aspect-[16/10]"
            />

            {/* Floating Badge */}
            <div className="absolute -bottom-6 -left-4 sm:bottom-6 sm:-left-8 bg-white p-4 rounded-[16px] shadow-xl flex items-center gap-3 border border-gray-100 max-w-[280px]">
              <div className="bg-[#FDF2F8] w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 text-sm">
                💰
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#001243] leading-tight mb-0.5">
                  Save 30–40% on childcare
                </p>
                <p className="text-[11px] text-[#666] leading-tight">
                  vs. hiring a solo nanny in {city}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Hero;