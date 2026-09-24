import React, { useState, useEffect, useRef } from "react";
import Header from "@app/layout/Header";
import { Spin, Input } from "antd";
import { fireToastMessage } from "@shared/ui/toast";
import CustomButton from "@shared/ui/Button";
import { useNavigate } from "react-router-dom";

function HeroOakland({ city }) {
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
        // Same spacing as ./Hero.jsx — both heroes sit under the same bottom
        // curve, so the gap above it has to read identically on either page.
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
            {/* Mobile text-to-photo spacing lives only here — same as ./Hero.jsx. */}
            <div className="mt-8 sm:mt-10 lg:mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12 pb-8">

                {/* Left: Text + CTA */}
                <div className="flex-1 max-w-2xl">
                    {/* Eyebrow */}
                    <div className="inline-flex items-center gap-2 bg-[#F8F9FF] px-3 py-1.5 rounded-full mb-6 border border-[#DDE5FF]">
                        <span className="text-[14px]">📍</span>
                        <span className="text-[#001243] text-[11px] font-bold tracking-widest uppercase">
                            OAKLAND, CA
                        </span>
                    </div>

                    <h1 className="fl-display text-ink">
                        {city} families,<br />
                        nanny share just got <span className="text-[#AEC4FF] Livvic-Bold">easier</span>
                    </h1>

                    <p className="fl-lede mt-6 max-w-xl">
                        Finding the right nanny share family starts with finding families nearby.
                        <br /><br />
                        FamLink helps families connect with compatible nanny share matches across the East Bay.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
                        <div
                            ref={buttonRef}
                            className={`w-full sm:w-auto inline-block ${isGlowing ? "glow-once rounded-full" : ""}`}
                        >
                            {/* "Learn more", not a waitlist ask — San Francisco
                                is the one page that still pitches the waitlist
                                (./Hero.jsx). Destination is still sign-up. */}
                            <CustomButton
                                btnText={isLoading ? <Spin size="small" /> : "Learn more"}
                                className="bg-[#AEC4FF] hover:bg-[#92b0ff] text-[#001243] Livvic-Bold w-full sm:w-auto px-8 py-3.5 text-[15px] flex items-center justify-center rounded-full transition-colors"
                                action={() => navigate(`/joinNow`)}
                                disabled={isLoading}
                            />
                        </div>
                        {/* Was a second "Learn More" — now that the primary
                            carries that label, this one points at the map. */}
                        <CustomButton
                            btnText="See who's nearby"
                            className="bg-white hover:bg-gray-50 border border-gray-200 text-[#001243] Livvic-Bold w-full sm:w-auto px-8 py-3.5 text-[15px] flex items-center justify-center rounded-full transition-colors"
                            action={() =>
                                document
                                    .getElementById("coverage-map")
                                    ?.scrollIntoView({ behavior: "smooth" })
                            }
                        />
                    </div>

                    {/* Features */}
                    <div className="mt-10 flex flex-wrap items-center gap-4 sm:gap-6">
                        <div className="flex items-center gap-2">
                            <span className="bg-[#F8F9FF] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">📍</span>
                            <span className="text-[13px] text-[#001243] font-bold">Location-based matches</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-[#F8F9FF] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">🏢</span>
                            <span className="text-[13px] text-[#001243] font-bold">120+ {city} families</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-[#F8F9FF] w-6 h-6 rounded-full flex items-center justify-center text-[12px]">✔️</span>
                            <span className="text-[13px] text-[#001243] font-bold">Save 30–40%</span>
                        </div>
                    </div>
                </div>

                {/* Right: Image */}
                <div className="flex-1 w-full flex justify-center lg:justify-end relative">
                    <div className="relative w-full max-w-[600px]">
                        <img
                            src="/OaklandHero.webp"
                            alt="Oakland Nanny Share"
                            className="w-full h-auto object-cover rounded-[24px] shadow-lg aspect-[4/3] sm:aspect-[16/10]"
                        />

                        {/* Top Right Floating Badge */}
                        <div className="absolute top-8 right-0 translate-x-4 sm:translate-x-6 bg-[#AEC4FF] px-6 py-4 rounded-2xl shadow-lg flex flex-col items-center gap-0 border border-white/20 backdrop-blur-md">
                            <span className="text-[#001243] font-black text-2xl leading-tight tracking-tight">120+</span>
                            <span className="text-[#001243] text-[11px] leading-tight font-semibold opacity-80 mt-1">Families in {city}</span>
                        </div>

                        {/* Bottom Left Floating Badge */}
                        <div className="absolute -bottom-6 -left-4 sm:bottom-6 sm:-left-8 bg-white p-4 rounded-[16px] shadow-xl flex items-center gap-3 border border-gray-100 max-w-[280px]">
                            <div className="bg-[#F0FDF4] w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 text-sm">
                                🌳
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

export default HeroOakland;