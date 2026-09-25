import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import CustomButton from "@shared/ui/Button";
import MenuToggle from "@shared/ui/MenuToggle";
import { useBodyScrollLock } from "@shared/lib/bodyScrollLock";
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

  // Released on unmount as well as on close. Tapping a link inside the open
  // menu unmounts this header mid-lock, and the hand-written version had no
  // cleanup — so the body stayed locked on every page the SPA rendered next.
  useBodyScrollLock(isMenuOpen);

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
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-in-out bg-white ${scrolled ? "shadow-sm py-3" : "py-3 sm:py-4 lg:py-5"}`}
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
                    <CustomButton className="bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-[15px] py-2.5 px-6 rounded-full transition-colors">
                      Go to dashboard
                    </CustomButton>
                  </NavLink>
                ) : (
                  <>
                    <NavLink to="/login" className="Livvic-SemiBold text-[15px] text-[#001243] hover:opacity-70 transition-opacity">
                      Log in
                    </NavLink>
                    <NavLink to="/joinNow">
                      <CustomButton className="bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-[15px] py-2.5 px-6 rounded-full transition-colors">
                        Join now
                      </CustomButton>
                    </NavLink>
                  </>
                ))}
            </div>
          </div>

          {/* ── MOBILE (below lg) ── */}
          <div className="lg:hidden flex items-center justify-between gap-3 w-full">

            {/* Logo — always visible */}
            <NavLink to="/" onClick={closeMenu} className="min-w-0">
              <div className="flex items-center gap-1.5">
                <img
                  src="/logo3.png"
                  alt="logo"
                  className={`flex-shrink-0 transition-all duration-300 ${scrolled ? "w-6 h-6" : "w-7 h-7"}`}
                />
                <p className={`Livvic-Bold text-[#001243] transition-all duration-300 ${scrolled ? "text-lg" : "text-xl"}`}>
                  Famlink
                </p>
              </div>
            </NavLink>

            {/* Log in / Dashboard + menu toggle. The header sits above the
                menu panel (z-50 over z-40), so this toggle is never covered:
                it turns into the X in place, and the button beside it stays
                reachable while the menu is open. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!pathname.startsWith("/business") && (
                <NavLink to={isAuthed ? "/dashboard" : "/login"} onClick={closeMenu}>
                  <CustomButton
                    size="sm"
                    className="h-10 px-4 bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-sm"
                  >
                    {isAuthed ? "Dashboard" : "Log in"}
                  </CustomButton>
                </NavLink>
              )}
              <MenuToggle
                open={isMenuOpen}
                onToggle={toggleMenu}
                controls="site-mobile-menu"
                className="border-line bg-white text-[#001243] hover:bg-[#F8F9FF] hover:text-[#001243]"
              />
            </div>
          </div>

        </div>
      </header>

      {/* Page content spacer */}
      <div className="h-14 sm:h-16 lg:h-20" />

      {/* ── MOBILE MENU PANEL ──
          Fills the screen UNDER the header rather than over it, so the logo,
          Log in button and toggle stay exactly where they were. `inset-0` on a
          fixed element tracks the visible viewport; the old
          h-[calc(100vh-130px)] used the large viewport, which on phones
          includes the area behind the browser toolbar — that is what clipped
          the buttons at the bottom. */}
      <div
        id="site-mobile-menu"
        aria-hidden={!isMenuOpen}
        className={`lg:hidden fixed inset-0 z-40 bg-white transition-all duration-300 ease-in-out ${isMenuOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"}`}
      >
        <div className="flex flex-col h-full pt-20">
          {/* Links scroll on their own if a short screen can't fit them. */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 space-y-1">
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

          {!pathname.startsWith("/business") && (
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
    </>
  );
}

export default Header;