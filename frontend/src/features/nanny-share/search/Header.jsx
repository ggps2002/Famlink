import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import CustomButton from "@shared/ui/Button";
import MenuToggle from "@shared/ui/MenuToggle";
import { useBodyScrollLock } from "@shared/lib/bodyScrollLock";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useSelector((s) => s.auth);

  // Same check as @app/layout/Header: a signed-in member gets a way back to
  // their dashboard instead of being asked to log in again.
  const isAuthed = user?.type === "Parents" || user?.type === "Nanny";
  const showAuthCta = !pathname.startsWith("/business");

  const toggleMenu = () => setIsMenuOpen((open) => !open);
  const closeMenu = () => setIsMenuOpen(false);

  // See the note in @app/layout/Header — same menu, same missing cleanup.
  useBodyScrollLock(isMenuOpen);

  return (
    <header className="relative">
      {/* The header row sits ABOVE the mobile menu panel (z-[70] over z-[60]),
          so the toggle turns into the X in the exact spot it was tapped and
          the Log in / Dashboard button beside it stays reachable. The row is
          white-on-dark over the page and switches to navy over the white
          panel. */}
      <div className="relative z-[70] flex justify-between items-center gap-3 py-2 sm:py-4">
        {/* Logo */}
        <NavLink to="/" onClick={closeMenu} className="min-w-0">
          <div className="flex gap-1 items-center">
            <img
              src="/logo3.png"
              alt="logo"
              className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0"
            />
            <p
              className={`Livvic-Bold text-lg sm:text-xl transition-colors duration-300 ${
                isMenuOpen ? "text-[#001243]" : "text-white"
              }`}
            >
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
        </div>

        {/* Action Buttons - Desktop */}
        {showAuthCta ? (
          <div className="hidden lg:flex gap-2 sm:gap-4">
            {isAuthed ? (
              <NavLink to="/dashboard">
                <CustomButton
                  btnText="Go to dashboard"
                  className="bg-[#AEC4FF] text-sm sm:text-base"
                />
              </NavLink>
            ) : (
              <>
                <NavLink to="/login">
                  <CustomButton
                    btnText="Log in"
                    className="text-white text-sm sm:text-base"
                  />
                </NavLink>
                <NavLink to="/joinNow">
                  <CustomButton
                    btnText={"Join now"}
                    className="bg-[#AEC4FF] text-sm sm:text-base"
                  />
                </NavLink>
              </>
            )}
          </div>
        ) : (
          <div className="hidden lg:block w-1 h-1"></div>
        )}

        {/* Mobile: Log in / Dashboard + menu toggle */}
        <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
          {showAuthCta && (
            <NavLink to={isAuthed ? "/dashboard" : "/login"} onClick={closeMenu}>
              <CustomButton
                size="sm"
                className="h-10 px-4 bg-[#AEC4FF] hover:bg-[#9DB8FF] text-[#001243] Livvic-SemiBold text-sm"
              >
                {isAuthed ? "Dashboard" : "Log in"}
              </CustomButton>
            </NavLink>
          )}
          <MenuToggle
            open={isMenuOpen}
            onToggle={toggleMenu}
            controls="search-mobile-menu"
            className={
              isMenuOpen
                ? "border-line bg-white text-[#001243] hover:bg-[#F8F9FF] hover:text-[#001243]"
                : "border-white/40 bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white"
            }
          />
        </div>
      </div>

      {/* Mobile Menu Panel — fills the visible viewport (inset-0) under the
          header row. The old calc(100vh - 160px) height used the large
          viewport, which on phones reaches behind the browser toolbar and
          clipped the buttons at the bottom. */}
      <div
        id="search-mobile-menu"
        aria-hidden={!isMenuOpen}
        className={`lg:hidden fixed inset-0 z-[60] bg-white transition-all duration-300 ease-in-out ${
          isMenuOpen
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div className="flex flex-col h-full pt-20 sm:pt-24">
          {/* Navigation Links — scroll on their own on very short screens */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 space-y-2">
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) =>
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${
                  isActive
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
                `block Livvic-SemiBold text-xl py-3 px-4 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "text-[#001243] bg-[#F8F9FF] border border-[#DDE5FF]"
                    : "text-gray-400 hover:text-[#001243] hover:bg-gray-50 border border-transparent"
                }`
              }
            >
              For Caregivers
            </NavLink>
          </nav>

          {/* Action Buttons — pinned to the bottom, clear of the home bar */}
          {showAuthCta && (
            <div className="flex-shrink-0 space-y-3 border-t border-gray-100 px-4 sm:px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {isAuthed ? (
                <NavLink to="/dashboard" onClick={closeMenu} className="block">
                  <CustomButton
                    btnText="Go to dashboard"
                    className="w-full bg-[#AEC4FF] text-gray-900 text-base py-3 justify-center hover:bg-[#9DB8FF] transition-colors duration-200"
                  />
                </NavLink>
              ) : (
                <>
                  <NavLink to="/login" onClick={closeMenu} className="block">
                    <CustomButton
                      btnText="Log in"
                      className="w-full text-base py-3 justify-center border border-gray-200 text-primary"
                    />
                  </NavLink>
                  <NavLink to="/joinNow" onClick={closeMenu} className="block">
                    <CustomButton
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
    </header>
  );
}

export default Header;
