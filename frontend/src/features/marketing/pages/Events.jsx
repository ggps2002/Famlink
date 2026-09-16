import { MapPin } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import { NavLink } from "react-router-dom";
import SEOMetaData from "@shared/seo/SEOMetaData";

function Events() {
  return (
    <div className="bg-[#F6F3EE] p-6">
      <SEOMetaData
        title="Upcoming Events | Famlink"
        description="Discover upcoming family and nanny-share events on Famlink. Stay connected, join community activities, and engage with local families."
      />

      {/* Logo/Header */}
      <NavLink
        to={"/"}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex gap-1 items-center mb-6"
      >
        <img src="/logo3.png" alt="logo" className="w-6 h-6 sm:w-8 sm:h-8" />
        <p className="Livvic-Bold text-lg sm:text-xl Livvic-Bold">Famlink</p>
      </NavLink>

      {/* Main Content */}
      <div className="w-full flex flex-col lg:flex-row justify-center gap-3 sm:gap-4 lg:gap-6 xl:gap-8">
        {/* Events List */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-4 sm:p-5 md:p-6 lg:p-8 w-full lg:flex-1 lg:max-w-2xl">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl Livvic-SemiBold text-gray-900 mb-3 sm:mb-4 md:mb-6 text-center">
            🎃 SPOOKTACULAR EVENTS
          </h1>

          {/* Event 1 */}
          <div className="mb-3 sm:mb-4 md:mb-6 space-y-2 pb-3 sm:pb-4 md:pb-6 border-b border-gray-200 last:border-b-0">
            <p className="text-xs sm:text-sm md:text-base Livvic-Medium">
              OCT 20th : Spooky Play & Create Morning – FREE
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#e9ffb8] text-gray-800 rounded-full text-xs sm:text-sm">
                Halloween Crafts
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#ffe3b2] text-gray-800 rounded-full text-xs sm:text-sm">
                Music & Bubbles
              </div>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm lg:text-base Livvic-Medium flex gap-1 items-start">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
              <span>
                Snow Park @ 9:30 AM | Frog Park @ 11:30 AM | Willard Park @ 2:30
                PM
              </span>
            </p>
          </div>

          {/* Event 2 */}
          <div className="mb-3 sm:mb-4 md:mb-6 space-y-2 pb-3 sm:pb-4 md:pb-6 border-b border-gray-200 last:border-b-0">
            <p className="text-xs sm:text-sm md:text-base Livvic-Medium">
              OCT 22nd : Pumpkin Patch Picnic & Playdate – FREE
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#b8d2ff] text-gray-800 rounded-full text-xs sm:text-sm">
                Bring your picnic lunch
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#c0ffb2] text-gray-800 rounded-full text-xs sm:text-sm">
                Social Connections
              </div>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm lg:text-base Livvic-Medium flex gap-1 items-center">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              Willard Park @ 11:30 AM
            </p>
          </div>

          {/* Event 3 */}
          <div className="mb-3 sm:mb-4 md:mb-6 space-y-2 pb-3 sm:pb-4 md:pb-6 border-b border-gray-200 last:border-b-0">
            <p className="text-xs sm:text-sm md:text-base Livvic-Medium">
              OCT 23rd : Pumpkin Patch Picnic & Playdate – FREE
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#b8d2ff] text-gray-800 rounded-full text-xs sm:text-sm">
                Bring your picnic lunch
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#c0ffb2] text-gray-800 rounded-full text-xs sm:text-sm">
                Social Connections
              </div>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm lg:text-base Livvic-Medium flex gap-1 items-center">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              Snow Park @ 11:30 AM
            </p>
          </div>

          {/* Event 4 */}
          <div className="mb-3 sm:mb-4 md:mb-6 space-y-2 pb-3 sm:pb-4 md:pb-6 border-b border-gray-200 last:border-b-0">
            <p className="text-xs sm:text-sm md:text-base Livvic-Medium">
              OCT 30th : Pumpkin Patch Picnic & Playdate – FREE
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#b8d2ff] text-gray-800 rounded-full text-xs sm:text-sm">
                Bring your picnic lunch
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#c0ffb2] text-gray-800 rounded-full text-xs sm:text-sm">
                Social Connections
              </div>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm lg:text-base Livvic-Medium flex gap-1 items-center">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              Frog Park @ 11:30 AM
            </p>
          </div>

          {/* Event 5 */}
          <div className="mb-0 space-y-2">
            <p className="text-xs sm:text-sm md:text-base Livvic-Medium">
              OCT 31st : Boo Bash Costume Dance Party – FREE
            </p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#ffb8b8] text-gray-800 rounded-full text-xs sm:text-sm">
                Costume & Dance
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#ffe3b2] text-gray-800 rounded-full text-xs sm:text-sm">
                Music & Bubbles
              </div>
              <div className="py-0.5 sm:py-1 px-2 sm:px-2.5 md:px-3 bg-[#ecb2ff] text-gray-800 rounded-full text-xs sm:text-sm">
                Candy Station
              </div>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm lg:text-base Livvic-Medium flex gap-1 items-start">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
              <span>
                Snow Park @ 9:30 AM | Frog Park @ 11:30 AM | Willard Park @ 2:30
                PM
              </span>
            </p>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-3 sm:space-y-4 w-full lg:w-auto lg:max-w-md">
          {/* Register Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-5 sm:p-6 md:p-8 text-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl Livvic-SemiBold text-gray-900 mb-2 sm:mb-3 md:mb-4">
              Register for Event
            </h1>
            <p className="text-gray-600 mb-3 sm:mb-4 md:mb-6 text-xs sm:text-sm md:text-base">
              Join us for an unforgettable experience! Secure your spot now and
              be part of something special.
            </p>
            <a href="https://form.typeform.com/to/AoOX72nv" className="block">
              <CustomButton
                btnText="Register"
                className="bg-[#ffb300] w-full px-3 sm:px-6 py-2.5 sm:py-2 md:py-2 text-sm sm:text-base"
              />
            </a>
          </div>

          {/* Locations Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-5 sm:p-6 md:p-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl Livvic-SemiBold text-gray-900 mb-3 sm:mb-4 md:mb-6 text-center">
              Event Locations & Addresses
            </h1>
            <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
              <div className="text-gray-600 text-xs sm:text-sm md:text-base">
                <p className="Livvic-SemiBold text-gray-900 mb-0.5 sm:mb-1">
                  Snow Park
                </p>
                <p>Harrison St & 19th St, Oakland, CA 94612</p>
              </div>
              <div className="text-gray-600 text-xs sm:text-sm md:text-base">
                <p className="Livvic-SemiBold text-gray-900 mb-0.5 sm:mb-1">
                  Frog Park
                </p>
                <p>550 Hudson St, Oakland, CA 94618</p>
              </div>
              <div className="text-gray-600 text-xs sm:text-sm md:text-base">
                <p className="Livvic-SemiBold text-gray-900 mb-0.5 sm:mb-1">
                  Willard Park
                </p>
                <p>2730 Hillegass Ave, Berkeley, CA 94705</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Events;
