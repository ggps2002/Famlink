import { useState } from "react";
import { NavLink } from "react-router-dom";

// Reusable HeaderLink component
const HeaderLink = ({ to, label, onClick }) => (
  <NavLink
    to={to}
    onClick={() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      onClick?.();
    }}
  >
    {({ isActive }) => (
      <p
        className={`font-normal  mb-2 lg:mb-0 text-lg uppercase hover:text-[#AEC4FF] transition-colors duration-300`}
        style={{ color: isActive ? "#49A2FC" : "" }}
      >
        {label}
      </p>
    )}
  </NavLink>
);

export default function Header({ join }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleNavbar = () => setIsOpen(!isOpen);
  const closeNavbar = () => setIsOpen(false);

  const navItems = [
    { to: "forFamilies", label: "For Families" },
    { to: "jobSeekers", label: "For Job Seekers" },
    { to: "nannShare", label: "NANNY SHARE" },
    { to: "services", label: "Services" },
    { to: "yourBusiness", label: "List your Business" },
  ];

  return (
    <>
      <div className="top-0 z-50 sticky flex items-center justify-center bg-white mb-3 w-full h-20">
        <NavLink
          to="/"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="flex gap-1 items-center">
            <img
              src="/logo3.png"
              alt="logo"
              className="w-6 h-6 sm:w-8 sm:h-8"
            />
            <p className="Livvic-Bold text-lg sm:text-xl Livvic-Bold">Famlink</p>
          </div>
        </NavLink>
      </div>
    </>
  );
}
