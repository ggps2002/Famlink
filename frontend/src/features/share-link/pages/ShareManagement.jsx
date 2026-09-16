import React from 'react';
import { Users, Heart, PiggyBank, Calendar, ShieldCheck, Search, Link as LinkIcon, Handshake } from 'lucide-react';
import shareNanny3 from '@/assets/images/shareNanny3.png';
const ShareManagement = () => {
  return (
    <div className="w-full overflow-x-hidden">

      {/* --- 4 COLUMNS SECTION --- */}
      <div
        className="w-full mx-auto relative z-20 -mt-[9px] lg:-mt-[10px] px-4 pt-[80px] lg:pt-24 pb-[140px] lg:pb-64 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${shareNanny3})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        {/* header */}
        <div className="relative lg:ml-[70px] mb-10 lg:mb-[80px] text-center lg:text-left z-10 mt-10">
          <h1 className="Livvic-Bold text-white text-[2.5rem] lg:text-[3.5rem] leading-tight tracking-tight">Share Management</h1>
          <p className="Livvic-semibold text-white text-lg lg:text-[1.25rem] mt-2 leading-[1.6] px-4 md:ml-10">
            One nanny. Two or more families. Countless benefits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 relative z-10">
          {/* Dotted horizontal line connecting the icons */}
          <div className="hidden lg:block absolute top-[40px] left-[12.5%] right-[12.5%] h-[2px] border-t-[3px] border-dotted border-white/80 z-0"></div>
          {/* Column 1 */}
          <div className="flex flex-col items-center text-center px-4">
            <div className="w-[80px] h-[80px] rounded-full bg-[#FDF8F5] flex items-center justify-center mb-6 border-[4px] border-white shadow-md relative z-10">
              <Handshake className="w-10 h-10 text-[#001243]" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-[#AEC4FF] text-[1.2rem] mb-2 Livvic-Bold">Stronger together</h4>
            <p className="text-white text-sm md:text-base leading-relaxed Livvic-Medium">Share responsibility and build lasting connections with other families.</p>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col items-center text-center px-4">
            <div className="w-[80px] h-[80px] rounded-full bg-[#FDF8F5] flex items-center justify-center mb-6 border-[4px] border-white shadow-md relative z-10">
              <PiggyBank className="w-10 h-10 text-[#001243]" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-[#AEC4FF] text-[1.2rem] mb-2 Livvic-Bold">Smarter savings</h4>
            <p className="text-white text-sm md:text-base leading-relaxed Livvic-Medium">Split the cost, maximize value, and enjoy premium care for less.</p>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col items-center text-center px-4">
            <div className="w-[80px] h-[80px] rounded-full bg-[#FDF8F5] flex items-center justify-center mb-6 border-[4px] border-white shadow-md relative z-10">
              <Calendar className="w-10 h-10 text-[#001243]" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-[#AEC4FF] text-[1.2rem] mb-2 Livvic-Bold">Easy scheduling</h4>
            <p className="text-white text-sm md:text-base leading-relaxed Livvic-Medium">Coordinate schedules seamlessly for balanced and stress-free routines.</p>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col items-center text-center px-4">
            <div className="w-[80px] h-[80px] rounded-full bg-[#FDF8F5] flex items-center justify-center mb-6 border-[4px] border-white shadow-md relative z-10">
              <ShieldCheck className="w-10 h-10 text-[#001243]" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-[#AEC4FF] text-[1.2rem] mb-2 Livvic-Bold">Trusted care</h4>
            <p className="text-white text-sm md:text-base leading-relaxed Livvic-Medium">One dedicated nanny, consistent care, and complete peace of mind.</p>
          </div>
        </div>
      </div>

      {/* --- BOTTOM SECTION (Coming Soon) --- */}
      <div className="w-full relative">

        {/* Coming Soon White Overlay Box */}
        <div className="relative -mt-[100px] lg:-mt-[150px] mx-auto w-full max-w-[1200px] bg-white rounded-t-[40px] lg:rounded-t-[80px] pt-12 lg:pt-20 pb-20 px-6 lg:px-10 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] z-30 flex flex-col items-center text-center">

          {/* Leaf decorations left/right of Coming Soon */}
          <div className="flex items-center justify-center gap-4 lg:gap-8 mb-8">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#AEC4FF" strokeWidth="1" className="transform -scale-x-100 opacity-60 hidden sm:block">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              <path d="M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19" />
            </svg>
            <h2 className="text-[3.5rem] lg:text-[4.5rem] Livvic-Bold font-bold text-[#001243] tracking-widest uppercase">COMING SOON</h2>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#AEC4FF" strokeWidth="1" className="opacity-60 hidden sm:block">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              <path d="M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19" />
            </svg>
          </div>

          <p className="text-[#777777] text-[1.1rem] lg:text-[1.3rem] mb-14 max-w-3xl Livvic-Medium">
            A simple and smart platform that helps families connect, share, and <span className="text-[#AEC4FF]">manage</span> childcare together.
          </p>

          <div className="flex flex-wrap justify-center gap-6 lg:gap-12">
            <div className="flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-full bg-[#EEF2E8] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#AEC4FF]" strokeWidth={2} />
              </div>
              <span className="text-[0.8rem] lg:text-[0.95rem] Livvic-Bold font-bold text-[#001243] uppercase tracking-wider text-left">Find compatible<br />families</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-full bg-[#EEF2E8] flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-[#AEC4FF]" strokeWidth={2} />
              </div>
              <span className="text-[0.8rem] lg:text-[0.95rem] Livvic-Bold font-bold text-[#001243] uppercase tracking-wider text-left">Match &<br />connect</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-full bg-[#EEF2E8] flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#AEC4FF]" strokeWidth={2} />
              </div>
              <span className="text-[0.8rem] lg:text-[0.95rem] Livvic-Bold font-bold text-[#001243] uppercase tracking-wider text-left">Manage &<br />coordinate</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-full bg-[#EEF2E8] flex items-center justify-center">
                <Heart className="w-6 h-6 text-[#AEC4FF]" strokeWidth={2} />
              </div>
              <span className="text-[0.8rem] lg:text-[0.95rem] Livvic-Bold font-bold text-[#001243] uppercase tracking-wider text-left">Share care,<br />share joy</span>
            </div>
          </div>

          {/* Right Sticker (Better Care...) */}
          <div className="hidden lg:flex absolute right-[-40px] top-[-80px] w-[300px] h-[300px] bg-[#AEC4FF] rounded-t-full rounded-br-full rounded-bl-[150px] flex-col items-center justify-center p-6 text-center shadow-2xl border-[12px] border-white text-[#001243] z-40 transform rotate-6">
            <Heart className="w-8 h-8 text-[#001243] fill-[#001243] mb-4" />
            <span className="Livvic-Bold font-bold text-base tracking-widest leading-[2]">BETTER CARE.<br />BETTER VALUE.<br />BETTER FUTURE.</span>
          </div>

          {/* Leaf Decoration on Bottom Left */}
          <div className="absolute left-[20px] lg:left-[-80px] bottom-10 opacity-30 pointer-events-none hidden md:block">
            <svg width="250" height="250" viewBox="0 0 100 100" fill="none" stroke="#AEC4FF" strokeWidth="1">
              <path d="M10,90 Q30,50 90,10" />
              <path d="M30,70 Q40,40 80,20" />
              <path d="M50,90 Q60,60 90,40" />
              <path d="M20,80 Q50,40 70,30" />
            </svg>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ShareManagement;