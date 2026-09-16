import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import Header from "@app/layout/Header";
import { Spin, Input } from "antd";
import { fireToastMessage } from "@shared/ui/toast";
import { api } from "@shared/api/client";
import Button from "@shared/ui/Button";
import { useNavigate } from "react-router-dom";
import { X, Star } from "lucide-react";
import caregiverHeroImg from "@/assets/images/caregiverHero.webp";

function Hero() {
  const [loading, setLoading] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  const [isGlowing, setIsGlowing] = useState(false);
  const buttonRef = useRef(null);


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

  useEffect(() => {
    if (showResults) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // Clean up on unmount
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showResults]);

  const handleZipValidation = async (zip) => {
    if (!zip) return;

    setLoading(true);
    try {
      // Use AllOrigins proxy to bypass CORS
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://api.zippopotam.us/us/${zip}`
      )}`;

      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Invalid ZIP");

      const wrappedData = await res.json();
      const data = JSON.parse(wrappedData.contents); // Extract actual JSON from proxy response

      const finalZip = data["post code"];
      if (finalZip) {
        setZipCode(finalZip);
        // form.setFieldsValue({
        //   zipCode: finalZip,
        // });
      } else {
        throw new Error("Invalid structure");
      }
    } catch (err) {
      setZipCode("");
      // form.setFieldsValue({ zipCode: "" });
      fireToastMessage({
        type: "error",
        message: "Invalid ZIP code. Please enter a valid U.S. ZIP.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataRetrieve = async () => {
    if (!zipCode) {
      fireToastMessage({
        type: "error",
        message: "Enter a valid US zip code first",
      });
      return;
    }
    setIsLoading(true);

    try {
      const { data } = await api.get(
        `postJob/job-seeker-opportunities/${zipCode}`
      );
      const response = data?.data || [];
      // const shuffled = [...response].sort(() => 0.5 - Math.random());
      // return shuffled.slice(0, 3);
      setData(response);
      setShowResults(true);
    } catch (err) {
      console.error("Error fetching service providers:", err);
      fireToastMessage({
        type: "error",
        message: "Could not load service providers. Try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setData([]);
  };

  return (
    <div className="relative bg-white w-full pt-[80px] lg:pt-[100px] pb-[60px] overflow-hidden min-h-[580px] flex items-center">
      <style>{`
        @keyframes buttonGlow {
          0%   { box-shadow: 0 0 0px rgba(255, 173, 225, 0); }
          40%  { box-shadow: 0 0 18px 6px rgba(140, 172, 246, 0.9); }
          100% { box-shadow: 0 0 0px rgba(255, 173, 225, 0); }
        }
        .glow-once {
          animation: buttonGlow 1s ease-out forwards;
        }
      `}</style>
      <Header />

      {/* Radial Gradient Background behind dashboard */}
      <div
        className="absolute right-[-80px] top-[-100px] w-[680px] h-[680px] rounded-full pointer-events-none z-0 hidden lg:block"
        style={{ background: 'radial-gradient(ellipse at center, #E7FCFF 0%, rgba(238,243,255,0.5) 55%, transparent 75%)' }}
      />

      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Mobile copy-to-image spacing lives only here — same as the family
            hero (../NannyShare/Hero.jsx). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">

          {/* ── LEFT COLUMN ── */}
          <div className="pr-0 lg:pr-8 relative z-10">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 bg-[#F4F7FF] text-[#001243] px-4 py-2 rounded-full font-[700] text-[11px] lg:text-[12px] uppercase tracking-widest mb-6 Livvic">
              <span className="text-[14px]">🌟</span> FOR CAREGIVERS & NANNIES
            </div>

            <h1 className="fl-display text-ink mb-6">
              Earn More as a <br />
              Nanny Share <br />
              <span className="text-[#AEC4FF] Livvic-Bold">Caregiver</span>
            </h1>

            <p className="fl-lede text-[#4a5568] max-w-md mb-9">
              Work with two families instead of one. Whether you already work with a family or are looking for a nanny share job, Famlink helps you find the right match.
            </p>

            {/* Trust Items */}
            <div className="flex flex-wrap gap-5 mb-10">
              <div className="flex items-center gap-[6px] text-[14px] font-[500] text-[#001243] Livvic">
                <span className="bg-[#E5EEFF] w-7 h-7 rounded-full flex items-center justify-center text-[14px]">💰</span>
                Earn 20-30% more
              </div>
              <div className="flex items-center gap-[6px] text-[14px] font-[500] text-[#001243] Livvic">
                <span className="bg-[#E5EEFF] w-7 h-7 rounded-full flex items-center justify-center text-[14px]">📍</span>
                Matches near you
              </div>
              <div className="flex items-center gap-[6px] text-[14px] font-[500] text-[#001243] Livvic">
                <span className="bg-[#E5EEFF] w-7 h-7 rounded-full flex items-center justify-center text-[12px]">✔️</span>
                Free to browse
              </div>
            </div>

            {/* Call To Action */}
            <div className="mb-8" ref={buttonRef}>
              <Button
                btnText={isLoading ? <Spin size="small" /> : "Find a nanny share"}
                className={`bg-[#AEC4FF] hover:bg-[#92b0ff] text-[#001243] w-fit px-8 py-4 flex items-center justify-center rounded-full Livvic-Bold text-[16px] transition-colors ${isGlowing ? 'glow-once' : ''}`}
                action={() => navigate("/caregiver/nannyshare")}
                disabled={isLoading}
              />
            </div>

            {/* Social Proof */}
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[13px] text-[#4a5568] Livvic">
              <div className="flex">
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-bold text-[#001243] shadow-sm bg-[#AEC4FF] z-[4]">S</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-bold text-[#001243] shadow-sm bg-[#AEE5FF] z-[3]">J</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-bold text-[#001243] shadow-sm bg-[#FFE1A8] z-[2]">M</div>
                <div className="w-9 h-9 rounded-full border-[2px] border-white -ml-2 first:ml-0 flex items-center justify-center text-[11px] font-bold text-[#001243] shadow-sm bg-[#E3D1FF] z-[1]">R</div>
              </div>
              <div>
                Joined by <span className="font-bold text-black">300+ caregivers</span> across the Bay Area
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="relative z-10 flex items-end justify-center lg:justify-end w-full">
            {/* Inner Wrapper for Image and Cards to align together perfectly */}
            <div className="relative w-full max-w-[680px]">

              {/* Floating Card: Bottom Left */}
              <div className="absolute bottom-[10%] left-[5px] lg:left-[-16px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#FFF8E7] flex items-center justify-center text-[14px] sm:text-[16px]">🔔</div>
                <div>
                  5 new match requests
                  <div className="fl-chip-sub">Families want to connect</div>
                </div>
              </div>

              {/* Floating Card: Middle Left */}
              <div className="absolute top-[50%] -translate-y-1/2 left-[5px] lg:left-[24px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#F4F7FF] flex items-center justify-center text-[14px] sm:text-[16px]">🏠</div>
                <div>
                  8 families nearby
                  <div className="fl-chip-sub">Oakland, CA</div>
                </div>
              </div>

              {/* Floating Card: Top Right */}
              <div className="absolute top-[20%] right-[5px] lg:right-[-24px] bg-white rounded-[14px] px-3 py-2 sm:px-4 sm:py-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.11)] flex items-center gap-[8px] sm:gap-[10px] fl-chip-title z-20">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-[8px] sm:rounded-[10px] bg-[#F0FFF4] flex items-center justify-center text-[14px] sm:text-[16px]">💸</div>
                <div>
                  Earn 20-30% more
                  <div className="fl-chip-sub">vs. single-family nanny</div>
                </div>
              </div>

              {/* Dashboard Image */}
              <img
                src={caregiverHeroImg}
                alt="Famlink dashboard — find a nanny share match near you"
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























//  {showResults && (
//         <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
//           <div className="rounded-3xl w-full max-w-7xl max-h-[90vh] overflow-hidden bg-white">
//             {/* Results Header */}
//             <div className="flex justify-between items-center p-6 sm:p-8 ">
//               <div>
//                 <h3 className=" text-xl sm:text-2xl md:text-3xl Livvic-Bold Livvic-Bold">
//                   Job Opportunities in {zipCode}
//                 </h3>
//                 <p className=" text-sm sm:text-base mt-1">
//                   {`${data.length} job${data.length !== 1 ? "s" : ""} found`}
//                 </p>
//               </div>
//               <button
//                 onClick={handleCloseResults}
//                 className="flex items-center gap-2  px-3 sm:px-4 py-2 rounded-full transition-all duration-200"
//               >
//                 <X className="w-4 h-4" />
//                 <span className="hidden sm:inline text-sm">Close</span>
//               </button>
//             </div>

//             {/* Results Content */}
//             <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6 sm:p-8">
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//                 {data.length > 0 ? (
//                   data.map((job, index) => (
//                     <div
//                       key={index}
//                       className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between h-full transition-all duration-300"
//                     >
//                       <div className="mb-4 bg-white">
//                         {/* Job Title */}
//                         <div className="mb-3">
//                           <h4 className="text-lg sm:text-xl Livvic-Bold text-gray-800 Livvic-Bold mb-2">
//                             {job.title}
//                           </h4>

//                           {/* Rate and Type */}
//                           <div className="flex flex-wrap gap-2 mb-3">
//                             <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs Livvic-Medium">
//                               {job.rate}
//                             </span>
//                             {job.type && (
//                               <span className="bg-[#AEC4FF]/20 text-gray-700 px-2 py-1 rounded-full text-xs Livvic-Medium">
//                                 {job.type}
//                               </span>
//                             )}
//                           </div>

//                           {/* Job Description (if available) */}
//                           {job.description && (
//                             <p className="text-gray-600 text-sm leading-relaxed mb-3">
//                               {job.description.slice(0, 100)}...
//                             </p>
//                           )}

//                           {/* Additional Details */}
//                           <div className=" px-3 py-2 rounded-lg">
//                             <p className="text-sm Livvic-Medium text-[#0f3460]">
//                               Job Opportunity Available
//                             </p>
//                           </div>
//                         </div>
//                       </div>

//                       {/* CTA Button */}
//                       <NavLink
//                         to="/joinNow"
//                         onClick={() => {
//                           handleCloseResults();
//                           window.scrollTo({ top: 0, behavior: "smooth" });
//                         }}
//                         className="mt-auto"
//                       >
//                         <button className="w-full Livvic-Bold text-sm sm:text-base px-4 py-3 rounded-full transition-all duration-300 bg-primary text-primary">
//                           {job.action || "Apply Now"}
//                         </button>
//                       </NavLink>
//                     </div>
//                   ))
//                 ) : (
//                   <div className="col-span-full text-center py-12">
//                     <div className="bg-gradient-to-br from-[#AEC4FF]/10 to-[#85D1F1]/10 backdrop-blur-sm rounded-2xl p-8 border border-[#AEC4FF]/30">
//                       <p className="text-white text-lg mb-2">
//                         No job opportunities found in this area
//                       </p>
//                       <p className="text-[#FFFFFF99] text-sm">
//                         Try searching with a different ZIP code
//                       </p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}