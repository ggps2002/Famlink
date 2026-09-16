import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Requests from "@features/booking/components/request";
import Upcoming from "@features/booking/components/upcoming";
import Cancelled from "@features/booking/components/cancelled";
import Completed from "@features/booking/components/completed";
import Withdraw from "@features/booking/components/withdraw";

export default function BookingNanny() {
  const [val, setVal] = useState("pending");
  const location = useLocation();

  useEffect(() => {
    // Check if there's an initialTab value in the location state
    if (location.state?.initialTab) {
      setVal(location.state.initialTab);
    }
  }, [location.state]);

  const handleClick = (e) => {
    const value = e.currentTarget.getAttribute("data-value");
    setVal(value);
  };

  return (
    <div className="padding-navbar1 Quicksand lg:w-[80%] mx-auto">
      <div className="rounded-xl my-5">
        <p className="lg:text-3xl text-2xl Livvic-Bold mb-6">
          Applications
        </p>
        <div>
          <div className="pb-10">
            {/* Tab Navigation - Always Horizontal */}
            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2">
              <div
                data-value="pending"
                style={val === "pending" ? { backgroundColor: "#AEC4FF" } : {}}
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Pending Applications
                </p>
              </div>
              <div
                data-value="completed"
                style={
                  val === "completed" ? { backgroundColor: "#AEC4FF" } : {}
                }
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Accepted Applications
                </p>
              </div>
              <div
                data-value="cancelled"
                style={
                  val === "cancelled" ? { backgroundColor: "#AEC4FF" } : {}
                }
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Rejected Applications
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div className="mt-6 min-h-[calc(100vh-150px)]">
              {val === "pending" && (
                <div className="mt-5">
                  <Requests type={"nanny"} />
                </div>
              )}
              {val === "cancelled" && (
                <div className="mt-5">
                  <Withdraw type={"nanny"} />
                </div>
              )}
              {val === "completed" && (
                <div className="mt-5">
                  <Completed type={"nanny"} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}