import React, { useState, useEffect } from "react";
import { Send, MessageCircle, X, Star, Loader2 } from "lucide-react";
import { api } from "@shared/api/client";
import { fireToastMessage } from "@shared/ui/toast";
import { NavLink } from "react-router-dom";
import CustomButton from "@shared/ui/Button";

function Feedback() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // controls the slide animation

  useEffect(() => {
    const bannerClosed = sessionStorage.getItem("bannerClosed");

    if (!bannerClosed) {
      // Start hidden, then trigger animation after short delay
      setTimeout(() => {
        setIsBannerOpen(true); // show banner container
        setTimeout(() => setIsVisible(true), 100); // start sliding up animation
      }, 200); // slight delay to make it feel natural
    }
  }, []);

  // 👇 Function to close banner permanently
  const handleCloseBanner = () => {
    setIsVisible(false); // slide back down
    sessionStorage.setItem("bannerClosed", "true"); // remember for this session
    setTimeout(() => setIsBannerOpen(false), 500); // remove from DOM after animation
  };

  // Listen for mobile menu state changes
  useEffect(() => {
    const checkMobileMenu = () => {
      // Check if mobile menu is open by looking for overflow hidden on body
      // This matches the logic in your Header component
      const isMenuOpen = document.body.style.overflow === "hidden";
      setIsMobileMenuOpen(isMenuOpen);
    };

    // Check initially
    checkMobileMenu();

    // Set up a mutation observer to watch for changes to body style
    const observer = new MutationObserver(checkMobileMenu);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => observer.disconnect();
  }, []);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // basic pattern
    if (!value) {
      setError("Email is required");
    } else if (!emailRegex.test(value)) {
      setError("Please enter a valid email");
    } else {
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (feedback.trim() && category && email) {
      try {
        setIsSubmitting(true);
        const { data } = await api.post("/feedback", {
          message: feedback,
          email: email,
          category: category,
        });
        fireToastMessage({
          message: data?.message || "Feedback received successfully!",
        });
        setSubmitted(true);
      } catch (error) {
        const msg =
          error?.response?.data?.message || "Something went wrong. Try again!";
        fireToastMessage({ type: "error", message: msg });
      } finally {
        setEmail("");
        setCategory("");
        setFeedback("");
        setIsSubmitting(false);
      }
    }
  };

  const categories = [
    "Bug Report",
    "Feature Request",
    "General Feedback",
    "Complaint",
    "Compliment",
  ];

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      setIsOpen(false);
      setSubmitted(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [submitted]);

  const isFormValid = feedback.trim() && category && email && !error; // make sure no email error

  return (
    <div className="relative">
      <div
        className={`fixed bottom-0 left-0 w-screen z-[2000] transform transition-transform duration-500 ease-in-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-orange-50">
          <p className=" text-base sm:text-base md:text-lg leading-snug">
            🎊 Join our growing community! This event is your chance to learn
            from experts, share ideas with peers, and discover new
            opportunities.{" "}
            <span className="Livvic-Bold text-[#b37400]">
              Registration is open!
            </span>
          </p>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <NavLink
              to={"/events"}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex-1 sm:flex-none"
            >
              <CustomButton
                btnText="Join"
                action={() => setIsBannerOpen(false)}
                className="px-2 sm:px-2 md:px-6 py-2 bg-[#FFB300] w-full"
              />
            </NavLink>
            <CustomButton
              btnText="Close"
              action={() => handleCloseBanner()}
              className="flex-1 sm:flex-none bg-white border"
            />
          </div>
        </div> */}
      </div>

      {/* Backdrop Blur */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-all duration-300 ease-out ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Floating Feedback Button */}
      <button
        aria-label="Open feedback form"
        onClick={() => {
          setIsOpen(true);
          setSubmitted(false);
        }}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transform transition-all duration-200 ease-out hover:scale-110 active:scale-95 z-40 ${
          isOpen || isMobileMenuOpen
            ? "opacity-0 scale-75 pointer-events-none"
            : "opacity-100 scale-100"
        }`}
      >
        <MessageCircle size={24} className="mx-auto" />
      </button>

      {/* Feedback Form Modal */}
      <div
        className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-soft z-50 transform transition-all duration-300 ease-out ${
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-75 translate-y-8 pointer-events-none"
        }`}
      >
        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-100">
              <div className="space-y-1">
                <h2 className="text-xl Livvic-SemiBold text-gray-800">
                  Share Your Feedback
                </h2>
                <p className="text-[#777777] text-sm Livvic-Medium max-w-[15rem]">
                  Questions, issues or suggestions ? We'd love to hear from you.
                </p>
              </div>
              <button
                aria-label="Close feedback form"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-sm Livvic-Medium text-primary mb-2">
                  Category
                </label>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((cat, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-2 px-4 border border-[#EEEEEE] w-fit rounded-full cursor-pointer ${
                        category === cat && "bg-primary"
                      }`}
                      onClick={() => setCategory(cat)}
                    >
                      <p className="Livvic-Medium text-[#333333] text-xs">
                        {cat}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <label htmlFor="your-email" className="fl-label">Your email</label>
                <input
                  id="your-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    validateEmail(e.target.value);
                  }}
                  aria-invalid={error ? true : undefined}
                  className="fl-field w-full"
                  placeholder="abc@example.com"
                />
              </div>

              {/* Feedback Textarea */}
              <div className="relative w-full">
                <label htmlFor="description" className="fl-label">Your message</label>
                <textarea
                  id="description"
                  value={feedback}
                  placeholder="Tell us about your question, issue or feedback..."
                  rows={4}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="fl-field w-full"
                  style={{
                    width: "100%",
                    resize: "none",
                  }}
                />
              </div>

              {/* Submit Button */}
              <CustomButton
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isSubmitting}
                className="w-full text-primary py-2 px-4 rounded-[20px] Livvic-Medium bg-primary disabled:bg-transparent disabled:text-gray-600 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending..
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Feedback
                  </>
                )}
              </CustomButton>
            </div>
          </>
        ) : (
          /* Success State */
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-xl Livvic-SemiBold text-gray-800 mb-2">
              Thank you!
            </h3>
            <p className="text-gray-600">
              Your feedback has been submitted successfully.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Feedback;
