import React from "react";
import { User, Search, Link, Home, Wand } from "lucide-react";

export default function Timeline() {
  return (
    <div className="min-h-screen py-8 md:py-16 px-4">
      <div className="max-w-7xl mx-auto bg-[#E7FCFF] p-12 rounded-2xl">
        {/* Header */}
        <div className="text-center mb-8 md:mb-16">
          <h1 className="text-3xl md:text-5xl Livvic-Bold text-primary mb-4 md:mb-6">
            How to Get Hired on Famlink
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed Livvic-Medium">
            Finding your next great child caregiver job on Famlink is simple,
            fast, and designed to connect you with the right families.
          </p>
        </div>

        {/* Process Steps */}
        <div className="relative">
          {/* Vertical Timeline Line - Hidden on mobile, shown on desktop */}
          <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-2.5 bg-[#EFF2E9]"></div>

          {/* Timeline Dots - Hidden on mobile, shown on desktop */}
          <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 top-20 w-5 h-5 bg-[#D6FB9A] rounded-full border-2 border-white z-10"></div>
          <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 top-[35%] w-5 h-5 bg-[#D6FB9A] rounded-full border-2 border-white z-10"></div>
          <div
            className="hidden md:block absolute left-1/2 transform -translate-x-1/2"
            style={{ top: "62%" }}
          >
            <div className="w-5 h-5 bg-[#D6FB9A] rounded-full border-2 border-white z-10"></div>
          </div>
          <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 bottom-20 w-5 h-5 bg-[#D6FB9A] rounded-full border-2 border-white z-10"></div>

          {/* Step 1 - Create Your Profile */}
          <div className="relative mb-8 md:mb-24 ">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="w-full md:w-1/2 md:pr-12">
                <div className="bg-white p-6 md:p-8 shadow-soft rounded-[20px]">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#D6FB9A] rounded-full flex items-center justify-center mr-3 md:mr-4">
                      <Wand className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-lg Livvic-SemiBold">
                    Tell us your situation
                  </h3>
                  <p className="text-[#555555] text-sm">
                    Share whether you're currently working with a family and open to adding
                    another, or looking for your first nanny share.
                  </p>
                </div>
              </div>
              <div className="hidden md:block md:w-1/2"></div>
            </div>
          </div>

          {/* Step 2 - Browse Job Listings */}
          <div className="relative mb-8 md:mb-24">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="hidden md:block md:w-1/2"></div>
              <div className="w-full md:w-1/2 md:pl-12">
                <div className="bg-white p-6 md:p-8 shadow-soft rounded-[20px]">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#D6FB9A] rounded-full flex items-center justify-center mr-3 md:mr-4">
                      <Search className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-lg Livvic-SemiBold">
                    Get matched with compatible families
                  </h3>
                  <p className="text-[#555555] text-sm">
                    FamLink connects you with nearby families based on schedule, child age,
                    and location.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 - Connect With Families */}
          <div className="relative mb-8 md:mb-24">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="w-full md:w-1/2 md:pr-12">
                <div className="bg-white p-6 md:p-8 shadow-soft rounded-[20px]">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#D6FB9A] rounded-full flex items-center justify-center mr-3 md:mr-4">
                      <Link className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-lg Livvic-SemiBold">
                    Connect and chat
                  </h3>
                  <p className="text-[#555555] text-sm">
                    Once there’s a mutual match, message directly on FamLink to set up a
                    meet-and-greet.
                  </p>
                </div>
              </div>
              <div className="hidden md:block md:w-1/2"></div>
            </div>
          </div>

          {/* Step 4 - Get Hired */}
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="hidden md:block md:w-1/2"></div>
              <div className="w-full md:w-1/2 md:pl-12">
                <div className="bg-white p-6 md:p-8 shadow-soft rounded-[20px]">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#D6FB9A] rounded-full flex items-center justify-center mr-3 md:mr-4">
                      <img src="/briefcase.svg" alt="briefcase" className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <h3 className="text-lg Livvic-SemiBold">
                    Start your nanny share
                  </h3>
                  <p className="text-[#555555] text-sm">
                    Finalize details with both families and begin your shared arrangement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
