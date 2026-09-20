import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import Button from "@shared/ui/Button";
import { useBodyScrollLock } from "@shared/lib/bodyScrollLock";
import { useLocation } from "react-router-dom";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // See the note in @app/layout/Header — same menu, same missing cleanup.
  useBodyScrollLock(isMenuOpen);

  return (
    <header className="relative">
      <div className="flex justify-between items-center py-2 sm:py-4">
        {/* Logo */}
        <NavLink to="/">
          <div className="flex gap-1 items-center">
            <img
              src="/logo3.png"
              alt="logo"
              className="w-6 h-6 sm:w-8 sm:h-8"
            />
            <p className="Livvic-Bold text-lg sm:text-xl Livvic-Bold text-white">
              Famlink
            </p>
          </div>
        </NavLink>

        {/* Navigation Links - Hidden on mobile */}
        <div className="hidden lg:flex gap-2 sm:gap-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `Livvic-SemiBold text-lg ${
                isActive
                  ? "text-white opacity-100"
                  : "text-white opacity-60"
              } hover:text-primary hover:opacity-100`
            }
          >
            For Families
          </NavLink>

          <NavLink
            to="/jobSeekers"
            className={({ isActive }) =>
              `Livvic-SemiBold text-lg ${
                isActive
                  ? "text-white opacity-100"
                  : "text-white opacity-60"
              } hover:text-primary hover:opacity-100`
            }
          >
            For Caregivers
          </NavLink>

          {/* <NavLink
            to="/families"
            className={({ isActive }) =>
              `Livvic-SemiBold text-lg ${
                isActive
                  ? "text-primary opacity-100"
                  : "text-primary opacity-60"
              } hover:text-primary hover:opacity-100`
            }
          >
            For Family
          </NavLink> */}

          {/* <NavLink
            to="/business"
            className={({ isActive }) =>
              `Livvic-SemiBold text-lg ${
                isActive ? "text-white opacity-100" : "text-white opacity-40"
              }`
            }
          >
            For Business
          </NavLink> */}
        </div>

        {/* Action Buttons - Hidden on mobile */}
        {!pathname.startsWith("/business") ? (
          <div className="hidden lg:flex gap-2 sm:gap-4">
            <NavLink to="/login">
              <Button
                btnText="Log in"
                className="text-white text-sm sm:text-base"
              />
            </NavLink>
            <NavLink to="/joinNow">
              <Button
                btnText={"Join now"}
                className="bg-[#AEC4FF] text-sm sm:text-base"
              />
            </NavLink>
          </div>
        ) : (
          <>
            <div className="w-1 h-1"></div>
          </>
        )}

        {/* Hamburger Menu Button - Visible on mobile */}
        <button
          onClick={toggleMenu}
          className="lg:hidden relative flex flex-col justify-center items-center w-8 h-8 focus:outline-none z-[70]"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-white transform transition-all duration-300 ease-in-out ${
              isMenuOpen ? "rotate-45 translate-y-1.5" : ""
            }`}
          ></span>
          <span
            className={`block w-6 h-0.5 bg-white mt-1 transform transition-all duration-300 ease-in-out ${
              isMenuOpen ? "opacity-0" : ""
            }`}
          ></span>
          <span
            className={`block w-6 h-0.5 bg-white mt-1 transform transition-all duration-300 ease-in-out ${
              isMenuOpen ? "-rotate-45 -translate-y-1.5" : ""
            }`}
          ></span>
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden fixed top-0 right-0 h-full w-full shadow-2xl z-[60] bg-white transform transition-all duration-300 ease-in-out ${
          isMenuOpen ? "opacity-100" : "opacity-0 hidden"
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-between items-center p-4 pt-9">
          <div className="flex gap-1 items-center">
            <img src="/logo3.png" alt="logo" className="w-10 h-10" />
            <p className="Livvic-Bold text-3xl Livvic-Bold text-primary">
              Famlink
            </p>
          </div>
          <button
            onClick={closeMenu}
            className="w-8 h-8 flex items-center justify-center text-white rounded-full transition-colors duration-200"
            aria-label="Close menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Menu Content - Using flexbox with proper spacing */}
        <div
          className="px-6 py-4 flex flex-col"
          style={{ height: "calc(100vh - 160px)" }}
        >
          {/* Navigation Links */}
          <nav className="space-y-6 mb-8">
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-2 px-4 rounded-lg transition-all duration-200 ${
                  isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              For Families
            </NavLink>

            <NavLink
              to="/jobSeekers"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-2 px-4 rounded-lg transition-all duration-200 ${
                  isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              For Caregivers
            </NavLink>

            {/* <NavLink
              to="/families"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-2 px-4 rounded-lg transition-all duration-200 ${
                  isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              For Family
            </NavLink> */}
            {/* <NavLink
              to="/business"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-2 px-4 rounded-lg transition-all duration-200 ${
                  isActive ? "text-black" : "text-gray-400 hover:text-gray-600"
                }`
              }
            >
              For Businesses
            </NavLink> */}
          </nav>

          {/* Spacer */}
          <div className="flex-grow"></div>

          {/* Action Buttons - At the bottom with safe spacing */}
          <div
            className={`space-y-4 border-t border-gray-200 pt-6 pb-6 ${
              pathname.startsWith("/business") ? "hidden" : ""
            }`}
          >
            <NavLink to="/login" onClick={closeMenu} className="block">
              <Button
                btnText="Log in"
                className="w-full text-base py-3 justify-center border border-gray-300 transition-colors duration-200"
              />
            </NavLink>
            <NavLink to="/joinNow" onClick={closeMenu} className="block">
              <Button
                btnText="Join now"
                className="w-full bg-[#AEC4FF] text-gray-900 text-base py-3 justify-center hover:bg-[#9DB8FF] transition-colors duration-200"
              />
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
