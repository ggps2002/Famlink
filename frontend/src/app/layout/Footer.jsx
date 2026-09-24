import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { fireToastMessage } from "@shared/ui/toast";
import { api } from "@shared/api/client";
import { Loader2 } from "lucide-react";
import { clearConsent } from "@shared/consent/consentStore";

import CustomButton from "@shared/ui/Button";
function Footer() {
  const { pathname } = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <footer className="relative">
      {/* Top Curve */}
      <div className="w-full h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 overflow-hidden">
        <svg
          className="w-full h-full"
          viewBox="0 0 1440 120"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            fill="#001243"
            d="M0,50 C360,0 1080,0 1440,50 L1440,120 L0,120 Z"
          />
        </svg>
      </div>

      {/* Footer content */}
      <div className="bg-[#001243] text-white -mt-1 lg:-mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

            {/* Column 1: Brand & Socials */}
            <div className="flex flex-col">
              <div className="flex gap-2 items-center mb-4">
                <img src="/logo3.png" alt="logo" className="w-8 h-8" />
                <p className="Livvic-Bold text-2xl text-white">Famlink</p>
              </div>
              <div className="mb-6">
                <p className="Livvic-Medium text-[14px] text-[#FFFFFFCC]">
                  Nanny share made simple.
                </p>
              </div>
              <div className="flex gap-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61573842520549"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  title="Facebook"
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="18" fill="#1877F2" />
                    <path d="M22.54 18H19.6V28H15.06V18H12.9V14.15H15.06V11.3C15.06 8.35 16.86 6.7 19.49 6.7C20.65 6.7 21.75 6.79 22.06 6.84V9.94L20.24 9.94C18.8 9.94 18.52 10.62 18.52 11.62V14.15H22.34L22.54 18Z" fill="white" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/famlink.care?igsh=Njl6MWw3bWo4cDc2&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  title="Instagram"
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="ig-grad" x1="6" y1="30" x2="30" y2="6" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F58529" />
                        <stop offset="0.5" stopColor="#DD2A7B" />
                        <stop offset="1" stopColor="#8134AF" />
                      </linearGradient>
                    </defs>
                    <circle cx="18" cy="18" r="18" fill="url(#ig-grad)" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M18 12.333C14.871 12.333 12.333 14.871 12.333 18C12.333 21.129 14.871 23.667 18 23.667C21.129 23.667 23.667 21.129 23.667 18C23.667 14.871 21.129 12.333 18 12.333ZM18 21.556C16.036 21.556 14.444 19.964 14.444 18C14.444 16.036 16.036 14.444 18 14.444C19.964 14.444 21.556 16.036 21.556 18C21.556 19.964 19.964 21.556 18 21.556Z" fill="white" />
                    <path d="M22.427 15.056C23.204 15.056 23.833 14.426 23.833 13.65C23.833 12.873 23.204 12.243 22.427 12.243C21.651 12.243 21.021 12.873 21.021 13.65C21.021 14.426 21.651 15.056 22.427 15.056Z" fill="white" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M18 8.333C21.135 8.333 21.51 8.347 22.784 8.405C23.955 8.458 24.636 8.666 25.088 8.841C25.688 9.075 26.113 9.352 26.564 9.803C27.015 10.254 27.292 10.68 27.525 11.279C27.701 11.732 27.909 12.412 27.962 13.583C28.021 14.857 28.034 15.231 28.034 18.001C28.034 20.771 28.021 21.146 27.962 22.419C27.909 23.591 27.701 24.271 27.525 24.723C27.292 25.323 27.015 25.748 26.564 26.199C26.113 26.65 25.688 26.927 25.088 27.161C24.636 27.336 23.955 27.545 22.784 27.597C21.51 27.656 21.135 27.669 18 27.669C14.865 27.669 14.49 27.656 13.216 27.597C12.045 27.545 11.364 27.336 10.912 27.161C10.312 26.927 9.887 26.65 9.436 26.199C8.985 25.748 8.708 25.323 8.475 24.723C8.299 24.271 8.091 23.591 8.038 22.419C7.979 21.146 7.966 20.771 7.966 18.001C7.966 15.231 7.979 14.857 8.038 13.583C8.091 12.412 8.299 11.732 8.475 11.279C8.708 10.68 8.985 10.254 9.436 9.803C9.887 9.352 10.312 9.075 10.912 8.841C11.364 8.666 12.045 8.458 13.216 8.405C14.49 8.347 14.865 8.333 18 8.333ZM18 10.089C14.921 10.089 14.551 10.101 13.295 10.158C12.203 10.208 11.644 10.384 11.269 10.53C10.767 10.725 10.407 10.957 10.029 11.335C9.651 11.713 9.419 12.073 9.224 12.575C9.078 12.95 8.902 13.51 8.852 14.601C8.794 15.858 8.783 16.228 8.783 18.001C8.783 19.774 8.794 20.144 8.852 21.401C8.902 22.493 9.078 23.052 9.224 23.427C9.419 23.929 9.651 24.289 10.029 24.667C10.407 25.045 10.767 25.277 11.269 25.472C11.644 25.618 12.203 25.794 13.295 25.844C14.551 25.901 14.921 25.913 18 25.913C21.079 25.913 21.449 25.901 22.705 25.844C23.797 25.794 24.356 25.618 24.731 25.472C25.233 25.277 25.593 25.045 25.971 24.667C26.349 24.289 26.581 23.929 26.776 23.427C26.922 23.052 27.098 22.493 27.148 21.401C27.206 20.144 27.217 19.774 27.217 18.001C27.217 16.228 27.206 15.858 27.148 14.601C27.098 13.51 26.922 12.95 26.776 12.575C26.581 12.073 26.349 11.713 25.971 11.335C25.593 10.957 25.233 10.725 24.731 10.53C24.356 10.384 23.797 10.208 22.705 10.158C21.449 10.101 21.079 10.089 18 10.089Z" fill="white" />
                  </svg>
                </a>
                <a
                  href="https://nextdoor.com/page/famlink?utm_campaign=1783878214252&share_action_id=e5d83b3d-89ee-4120-8f57-28992ef2ed15"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[36px] h-[36px] rounded-full bg-[#00E55B] flex items-center justify-center hover:opacity-80 transition-opacity"
                  title="Nextdoor"
                >
                  <span className="text-white font-bold text-[18px] leading-none">N</span>
                </a>
              </div>
            </div>

            {/* Column 2: Links */}
            <div className="flex flex-col">
              <h3 className="uppercase tracking-wider font-[800] text-[13px] text-white mb-6">
                LINKS
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <NavLink
                    to="/"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    For Families
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/jobSeekers"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    For Caregivers
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share-resources"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Resource Center
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/resources"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Blog
                  </NavLink>
                </li>
              </ul>
            </div>

            {/* Column 3: Find Nanny Shares */}
            <div className="flex flex-col">
              <h3 className="uppercase tracking-wider font-[800] text-[13px] text-white mb-6">
                FIND NANNY SHARES
              </h3>
              <ul className="flex flex-col gap-4">
                <li>
                  <NavLink
                    to="/nanny-share/san-francisco-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    San Francisco
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/oakland-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Oakland
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/berkeley-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Berkeley
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/alameda-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Alameda
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/rockridge"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Rockridge
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/temescal"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Temescal
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/montclair"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Montclair
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/emeryville-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Emeryville
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/albany-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Albany
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/san-leandro-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    San Leandro
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/nanny-share/castro-valley-ca"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
                  >
                    Castro Valley
                  </NavLink>
                </li>
              </ul>
            </div>

            {/* Column 4: Stay in the Loop & Contact */}
            <div className="flex flex-col">
              <h3 className="uppercase tracking-wider font-[800] text-[13px] text-white mb-5">
                STAY IN THE LOOP
              </h3>
              <p className="Livvic-Medium text-[13px] text-[#FFFFFFCC] mb-4">
                Get helpful childcare tips and platform updates.
              </p>

              <div className="flex items-center gap-3 mb-8">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your Email"
                  className="bg-[#1C2C5B] text-white border border-[#2D407A] rounded-full flex-1 px-5 py-2.5 text-[13px] Livvic focus:outline-none focus:border-[#AEC4FF] placeholder-[#FFFFFF88] min-w-0"
                />
                <CustomButton
                  onClick={async () => {
                    if (!email) return;
                    setIsLoading(true);
                    try {
                      const { data } = await api.post("/subscribe/news-letter", { email });
                      fireToastMessage({ message: data?.message || "Subscribed successfully!" });
                      setEmail("");
                    } catch (error) {
                      fireToastMessage({ type: "error", message: error?.response?.data?.message || "Something went wrong. Try again!" });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="bg-[#C1D4FF] text-[#001243] w-10 h-10 rounded-full flex justify-center items-center hover:bg-[#A6BEFF] transition-colors flex-shrink-0 px-0 py-0 Livvic"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#001243]" />
                  ) : (
                    <span className="text-lg leading-none mb-0.5">→</span>
                  )}
                </CustomButton>
              </div>

              <h3 className="uppercase tracking-wider font-[800] text-[13px] text-white mb-4">
                CONTACT
              </h3>
              <a
                href="mailto:info@Famlink.care"
                className="Livvic-Medium text-[14px] text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all w-fit"
              >
                info@Famlink.care
              </a>
            </div>
          </div>

          {/* Bottom Section */}
          <hr className="mt-12 h-px bg-[#FFFFFF33] border-0" />
          <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
            <p className="Livvic-Medium text-sm sm:text-md text-[#FFFFFFCC] text-center sm:text-left">
              © Famlink {new Date().getFullYear()} - All rights reserved
            </p>
            {/* The top-level /terms-and-conditions route is registered outside
                App.jsx's logged-out block, so this one link resolves for members
                and visitors alike — no need to branch on user type. */}
            <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-4 text-sm sm:text-md">
              <NavLink
                to="/terms-and-conditions"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="Livvic-Medium text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all"
              >
                Terms &amp; Conditions
              </NavLink>
              {/* Reopens the cookie banner. Consent has to be as easy to
                  withdraw as it was to give, and the banner hides itself once
                  answered — so without an entry point here, a visitor who
                  accepted has no way back to the choice. `clearConsent` forgets
                  the stored answer and fires the event CookieConsentGate
                  listens for, on whatever page they happen to be on. */}
              <CustomButton
                type="button"
                onClick={clearConsent}
                className="Livvic-Medium text-[#FFFFFFCC] underline decoration-[#FFFFFF44] hover:text-white hover:decoration-white transition-all px-0 py-0 rounded-none"
              >
                Cookie Preferences
              </CustomButton>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
