import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import Button from "@shared/ui/Button";
import { useLocation } from "react-router-dom";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user } = useSelector((s) => s.auth);

  // A signed-in member browsing the public site gets a way back to their
  // dashboard where the sign-up CTAs would otherwise be — those two ask them to
  // do something they've already done. Same check the rest of the app uses.
  const isAuthed = user?.type === "Parents" || user?.type === "Nanny";

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // Highlight the Resources trigger while on any resources destination.
  const onResources =
    pathname.startsWith("/nanny-share-resources") || pathname.startsWith("/resources");

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
  }, [isMenuOpen]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* ── HEADER SHELL ── */}
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-in-out bg-white ${scrolled ? "shadow-sm py-3" : "py-4 sm:py-5"}`}
      >
        <div className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl">

          {/* ── DESKTOP (lg+) ── */}
          <div className="hidden lg:flex justify-between items-center w-full">

            {/* Logo */}
            <NavLink to="/" className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src="/logo3.png"
                  alt="logo"
                  className="w-7 h-7 object-contain"
                />
                <p className="Livvic-Bold text-[22px] text-[#001243]">
                  Famlink
                </p>
              </div>
            </NavLink>

            {/* Nav links */}
            <div className="flex items-center gap-10">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `Livvic-SemiBold text-[15px] transition-all duration-200 pb-[2px] border-b-[3px] ${isActive ? "text-[#001243] border-[#DDE5FF]" : "text-[#001243] border-transparent hover:opacity-70"}`
                }
              >
                For Families
              </NavLink>
              <NavLink
                to="/jobSeekers"
                className={({ isActive }) =>
                  `Livvic-SemiBold text-[15px] transition-all duration-200 pb-[2px] border-b-[3px] ${isActive ? "text-[#001243] border-[#DDE5FF]" : "text-[#001243] border-transparent hover:opacity-70"}`
                }
              >
                For Caregivers
              </NavLink>

              {/* Resources dropdown — opens on hover; the pt-3 wrapper is a
                  hover bridge so the menu doesn't close between button and panel. */}
              <div className="relative group">
                <button
                  type="button"
                  className={`Livvic-SemiBold text-[15px] transition-all duration-200 pb-[2px] border-b-[3px] flex items-center gap-1 ${onResources ? "text-[#001243] border-[#DDE5FF]" : "text-[#001243] border-transparent hover:opacity-70"}`}
                >
                  Resources
                  <svg
                    className="w-3.5 h-3.5 mt-[1px] transition-transform duration-200 group-hover:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-2 w-56">
                    <NavLink
                      to="/nanny-share-resources"
                      className={({ isActive }) =>
                        `block px-4 py-2.5 Livvic-SemiBold text-[14px] transition-colors ${isActive ? "text-[#001243] bg-[#F8F9FF]" : "text-[#001243] hover:bg-gray-50"}`
                      }
                    >
                      Resource Center
                      <span className="block Livvic-Medium text-[12px] text-gray-400">
                        Calculator, templates &amp; guides
                      </span>
                    </NavLink>
                    <NavLink
                      to="/resources"
                      className={({ isActive }) =>
                        `block px-4 py-2.5 Livvic-SemiBold text-[14px] transition-colors ${isActive ? "text-[#001243] bg-[#F8F9FF]" : "text-[#001243] hover:bg-gray-50"}`
                      }
                    >
                      Blog
                      <span className="block Livvic-Medium text-[12px] text-gray-400">
                        Nanny share tips &amp; articles
                      </span>
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-6 flex-shrink-0">
              {!pathname.startsWith("/business") &&
                (isAuthed ? (
                  <NavLink to="/dashboard">
                    <button className="bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-[15px] py-2.5 px-6 rounded-full transition-colors">
                      Go to dashboard
                    </button>
                  </NavLink>
                ) : (
                  <>
                    <NavLink to="/login" className="Livvic-SemiBold text-[15px] text-[#001243] hover:opacity-70 transition-opacity">
                      Log in
                    </NavLink>
                    <NavLink to="/joinNow">
                      <button className="bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-[15px] py-2.5 px-6 rounded-full transition-colors">
                        Join now
                      </button>
                    </NavLink>
                  </>
                ))}
            </div>
          </div>

          {/* ── MOBILE (below lg) ── */}
          <div className="lg:hidden flex items-center justify-between w-full">

            {/* Logo — always visible */}
            <NavLink to="/" onClick={closeMenu}>
              <div className="flex items-center gap-1.5">
                <img
                  src="/logo3.png"
                  alt="logo"
                  className={`transition-all duration-300 ${scrolled ? "w-6 h-6" : "w-7 h-7"}`}
                />
                <p className={`Livvic-Bold text-[#001243] transition-all duration-300 ${scrolled ? "text-lg" : "text-xl"}`}>
                  Famlink
                </p>
              </div>
            </NavLink>

            {/* Hamburger — always dark since bg is always white */}
            <button
              onClick={toggleMenu}
              className="flex-shrink-0 flex flex-col justify-center items-center w-8 h-8 focus:outline-none z-[70]"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-5 h-0.5 transform transition-all duration-300 ease-in-out bg-[#001243] ${isMenuOpen ? "rotate-45 translate-y-[6px]" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 mt-1.5 transform transition-all duration-300 ease-in-out bg-[#001243] ${isMenuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 mt-1.5 transform transition-all duration-300 ease-in-out bg-[#001243] ${isMenuOpen ? " -rotate-45 -translate-y-[9px]" : ""}`}
              />
            </button>
          </div>

        </div>
      </header>

      {/* Page content spacer */}
      <div className="h-14 sm:h-16 lg:h-20" />

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      <div
        className={`lg:hidden fixed inset-0 z-[60] bg-white shadow-2xl transition-all duration-300 ease-in-out ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
      >
        {/* Menu header row */}
        <div className="flex justify-between items-center px-6 pt-10 pb-4">
          <div className="flex items-center gap-2">
            <img src="/logo3.png" alt="logo" className="w-9 h-9" />
            <p className="Livvic-Bold text-2xl text-primary">Famlink</p>
          </div>
          <button
            onClick={closeMenu}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors duration-200"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu body */}
        <div className="px-6 pt-2 pb-8 flex flex-col h-[calc(100vh-130px)]">
          <nav className="space-y-1">
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${isActive
                  ? "text-[#001243] bg-[#F8F9FF] border border-[#DDE5FF]"
                  : "text-gray-400 hover:text-[#001243] hover:bg-gray-50 border border-transparent"
                }`
              }
            >
              For Families
            </NavLink>
            <NavLink
              to="/jobSeekers"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${isActive
                  ? "text-[#001243] bg-[#F8F9FF] border border-[#DDE5FF]"
                  : "text-gray-400 hover:text-[#001243] hover:bg-gray-50 border border-transparent"
                }`
              }
            >
              For Caregivers
            </NavLink>

            {/* Resources — same destinations as the desktop dropdown, flattened
                into two entries under a section label for the mobile menu. */}
            <p className="uppercase tracking-wider Livvic-Bold text-[12px] text-gray-300 pt-4 pb-1 px-4">
              Resources
            </p>
            <NavLink
              to="/nanny-share-resources"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${isActive
                  ? "text-[#001243] bg-[#F8F9FF] border border-[#DDE5FF]"
                  : "text-gray-400 hover:text-[#001243] hover:bg-gray-50 border border-transparent"
                }`
              }
            >
              Resource Center
            </NavLink>
            <NavLink
              to="/resources"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${isActive
                  ? "text-[#001243] bg-[#F8F9FF] border border-[#DDE5FF]"
                  : "text-gray-400 hover:text-[#001243] hover:bg-gray-50 border border-transparent"
                }`
              }
            >
              Blog
            </NavLink>
          </nav>

          <div className="flex-grow" />

          {!pathname.startsWith("/business") && (
            <div className="space-y-3 border-t border-gray-100 pt-6">
              {isAuthed ? (
                <NavLink to="/dashboard" onClick={closeMenu} className="block">
                  <Button
                    btnText="Go to dashboard"
                    className="w-full bg-[#AEC4FF] text-gray-900 text-base py-3 justify-center hover:bg-[#9DB8FF] transition-colors duration-200"
                  />
                </NavLink>
              ) : (
                <>
                  <NavLink to="/login" onClick={closeMenu} className="block">
                    <Button
                      btnText="Log in"
                      className="w-full text-base py-3 justify-center border border-gray-200 text-primary"
                    />
                  </NavLink>
                  <NavLink to="/joinNow" onClick={closeMenu} className="block">
                    <Button
                      btnText="Join now"
                      className="w-full bg-[#AEC4FF] text-gray-900 text-base py-3 justify-center hover:bg-[#9DB8FF] transition-colors duration-200"
                    />
                  </NavLink>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Header;