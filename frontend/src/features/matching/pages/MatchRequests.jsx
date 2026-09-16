import React from 'react'
import { useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getIncomingRequestsThunk } from "@features/matching/store/matchSlice";
import IncomingRequests from '@features/matching/components/IncomingRequests';
import OutgoingRequests from '@features/matching/components/OutgoingRequests';
import DeclinedRequests from '@features/matching/components/DeclinedRequests';

const MatchRequests = () => {
  const [val, setVal] = useState("incoming");
  const location = useLocation();
  const dispatch = useDispatch();

  const { user } = useSelector((s) => s.auth);
  const { incomingMatches, isMatchLoading, incomingPagination } = useSelector(
    (s) => s.matchRequest
  );

  const hasMore = incomingPagination.hasMore;
  const [page, setPage] = useState(1);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch once on mount
  useEffect(() => {
    dispatch(getIncomingRequestsThunk({ page: 1, limit: 10 }))
      .unwrap()
      .finally(() => setHasFetched(true));
  }, [dispatch]);

  // Paginate on scroll
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (
      scrollTop + windowHeight >= documentHeight - 200 &&
      !isMatchLoading &&
      hasMore
    ) {
      setPage((prev) => prev + 1);
    }
  }, [isMatchLoading, hasMore]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (page > 1) {
      dispatch(getIncomingRequestsThunk({ page, limit: 10 }));
    }
  }, [page, dispatch]);

  // Tab navigation
  useEffect(() => {
    if (location.state?.initialTab) {
      setVal(location.state.initialTab);
    }
  }, [location.state]);

  const handleClick = (e) => {
    const value = e.currentTarget.getAttribute("data-value");
    setVal(value);
  };

  const pendingMatches = incomingMatches?.filter((m) => m.status === "pending");
  const declinedMatches = incomingMatches?.filter((m) => m.status === "rejected");

  return (
    <div className="padding-navbar1 Quicksand lg:w-[80%] mx-2 sm:mx-4">
      <div className="rounded-xl my-5">
        <p className="lg:text-3xl text-2xl Livvic-Bold mb-6">Requests</p>
        <div>
          <div className="pb-10">
            {/* Tab Navigation */}
            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2">
              <div
                data-value="incoming"
                style={val === "incoming" ? { backgroundColor: "#AEC4FF" } : {}}
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Incoming
                </p>
              </div>
              <div
                data-value="outgoing"
                style={val === "outgoing" ? { backgroundColor: "#AEC4FF" } : {}}
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Sent
                </p>
              </div>
              <div
                data-value="declined"
                style={val === "declined" ? { backgroundColor: "#AEC4FF" } : {}}
                onClick={handleClick}
                className="cursor-pointer flex justify-center items-center rounded-full bg-[#EFF1F9] px-2 sm:px-3 md:px-4 py-2 flex-shrink-0"
              >
                <p className="Livvic-Medium text-xs sm:text-sm md:text-md text-primary text-center whitespace-nowrap">
                  Declined
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div className="mt-6 min-h-[calc(100vh-150px)]">
              {val === "incoming" && (
                <div className="mt-5">
                  <IncomingRequests
                    matches={pendingMatches}
                    isMatchLoading={isMatchLoading}
                    hasMore={hasMore}
                    hasFetched={hasFetched}
                  />
                </div>
              )}
              {val === "outgoing" && (
                <div className="mt-5">
                  <OutgoingRequests />
                </div>
              )}
              {val === "declined" && (
                <div className="mt-5">
                  <DeclinedRequests
                    matches={declinedMatches}
                    isMatchLoading={isMatchLoading}
                    hasFetched={hasFetched}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchRequests;