import { NavLink, useNavigate } from "react-router-dom";
import Avatar from "react-avatar";
import { useDispatch } from "react-redux";
import {
  acceptReqThunk,
  cancelBookingThunk,
  completeReqThunk,
  reconsiderThunk,
  rejectedReqThunk,
  withDrawThunk,
} from "@features/hire/store/bookHireSlice";
import { fetchOtherReqThunk } from "@features/booking/store/otherRequestsSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { SwalFireDelete, SwalFireSuccess } from "@shared/ui/swalFire";
import { fetchAccRequesterThunk } from "@features/booking/store/acceptedRequesterSlice";
import PayRevModel from "@features/subscription/components/ModalPayment";
import { formatDate, timeAgo } from "@shared/lib/toCamelCase";
import { createChatThunk } from "@features/chat/store/chatSlice";
import { fetchCancelRequesterThunk } from "@features/booking/store/cancelledRequestSlice";
import useSocket from "@shared/realtime/useSocket";

export default function Content({
  jobTiming,
  img,
  name,
  time,
  start,
  exp,
  loc,
  upcoming,
  request,
  completed,
  cancelled,
  withdraw,
  child,
  dayTime,
  id,
  parentId,
  nannyId,
  type,
  bookingId,
  pay,
  createdAt,
  review,
  zipCode,
  hourlyRate,
  jobDes,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Determine the current state of the content
  const getContentState = () => {
    if (request) return "request";
    if (completed) return "completed";
    if (cancelled) return "cancelled";
    if (withdraw) return "withdraw";
    if (upcoming) return "upcoming";
    return "default";
  };

  // Helper function to format location
  const formatLocation = () => {
    if (!zipCode || !loc?.format_location) return "";
    const parts = loc.format_location.split(",") || [];
    const city = parts.at(-3)?.trim();
    const state = parts.at(-2)?.trim().split(" ")[0];
    return city && state ? `${city}, ${state}` : "";
  };

  // Action handlers
  const handleAcceptRequest = async () => {
    const handleConfirm = async () => {
      try {
        const { status, data } = await dispatch(
          acceptReqThunk(bookingId)
        ).unwrap();

        if (status === 200) {
          fireToastMessage({ success: true, message: data.message });

          await new Promise(async (resolve) => {
            const updateContent = {
              bookingId,
              senderId: parentId,
              receiverId: nannyId,
              content: "Accept your request",
              type: "Booking",
            };
            socket?.emit(
              "sendNotification",
              { content: updateContent },
              resolve
            );
          });

          await dispatch(fetchOtherReqThunk({ limit: 8, page: 1 })).unwrap();
        }
      } catch (error) {
        await dispatch(fetchOtherReqThunk({ limit: 8, page: 1 })).unwrap();
        fireToastMessage({ type: "error", message: error.message });
      }
    };

    SwalFireSuccess({
      title: `You have accepted ${name} Request`,
      handleConfirm,
    });
  };

  const handleRejectRequest = async () => {
    const handleDelete = async () => {
      try {
        const { status, data } = await dispatch(
          rejectedReqThunk(bookingId)
        ).unwrap();

        if (status === 200) {
          fireToastMessage({ success: true, message: data.message });

          await new Promise(async (resolve) => {
            const updateContent = {
              bookingId,
              senderId: parentId,
              receiverId: nannyId,
              content: "Reject your request",
              type: "Booking",
            };
            socket?.emit(
              "sendNotification",
              { content: updateContent },
              resolve
            );
          });

          await dispatch(fetchOtherReqThunk({ limit: 8, page: 1 })).unwrap();
        }
      } catch (error) {
        await dispatch(fetchOtherReqThunk({ limit: 8, page: 1 })).unwrap();
        fireToastMessage({ type: "error", message: error.message });
      }
    };

    SwalFireDelete({
      title: `Are you sure to reject ${name} Request`,
      handleDelete,
    });
  };

  const handleWithdraw = async () => {
    const handleConfirm = async () => {
      try {
        const { data } = await dispatch(withDrawThunk(bookingId)).unwrap();
        fireToastMessage({ success: true, message: data.message });
        await dispatch(fetchOtherReqThunk({ limit: 8, page: 1 })).unwrap();
      } catch (error) {
        fireToastMessage({ type: "error", message: error.message });
      }
    };

    SwalFireSuccess({
      title: `Are you sure you want to withdraw ${name} Request`,
      handleConfirm,
    });
  };

  const handleReconsider = async () => {
    const handleConfirm = async () => {
      try {
        const { data } = await dispatch(reconsiderThunk(bookingId)).unwrap();
        fireToastMessage({ success: true, message: data.message });
        await dispatch(
          fetchCancelRequesterThunk({ limit: 8, page: 1 })
        ).unwrap();
      } catch (error) {
        fireToastMessage({ type: "error", message: error.message });
      }
    };

    SwalFireSuccess({
      title: `Are you sure you want to reconsider ${name} Request`,
      handleConfirm,
    });
  };

  const handleMessage = async () => {
    try {
      const participants = [parentId, nannyId];
      const { status } = await dispatch(
        createChatThunk({ participants })
      ).unwrap();

      if (status === 201 || status === 200) {
        const route =
          type === "family" ? "/family/message/" : "/nanny/message/";
        navigate(route);
      }
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  const getProfileLink = () => {
    return type === "nanny"
      ? `/nanny/jobDescription/${id}`
      : `/family/profileNanny/${id}`;
  };

  // Button components for different states
  const renderActionButtons = () => {
    const state = getContentState();

    switch (state) {
      case "request":
        if (type === "family") {
          return (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={handleRejectRequest}
                className="flex-1 py-2 px-4 border border-red-500 text-red-500 rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
              >
                Reject
              </button>
              <button
                onClick={handleAcceptRequest}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
              >
                Accept
              </button>
            </div>
          );
        } else {
          return (
            <div className="flex flex-col gap-2 w-full">
              <div className="text-right text-xs sm:text-sm">
                <p>Applied {formatDate(createdAt)}</p>
                <p className="text-gray-500 text-xs">{timeAgo(createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleWithdraw}
                  className="flex-1 py-2 px-3 border border-blue-500 text-blue-500 rounded-full text-xs sm:text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
                >
                  Withdraw
                </button>
                <button
                  onClick={handleMessage}
                  className="flex-1 py-2 px-3 bg-blue-100 text-blue-500 rounded-full text-xs sm:text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
                >
                  Message
                </button>
              </div>
            </div>
          );
        }

      case "completed":
        return (
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={handleMessage}
              className="w-full py-2 px-4 border border-[#8BD219] text-[#8BD219] rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
            >
              Message
            </button>
            <NavLink
              to={getProfileLink()}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <button className="w-full py-2 px-4 border border-[#608DFF] text-[#608DFF] rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300">
                View Application
              </button>
            </NavLink>
            {type === "family" && !review && (
              <PayRevModel
                type={type}
                bookingId={bookingId}
                pay={pay}
                receiverId={nannyId}
              />
            )}
            {type !== "family" && !review && (
              <PayRevModel
                type={type}
                bookingId={bookingId}
                pay={pay}
                receiverId={parentId}
              />
            )}
          </div>
        );

      case "cancelled":
        return (
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={handleReconsider}
              className="w-full py-2 px-4 bg-blue-500 text-white border border-blue-500 rounded-full text-xs sm:text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300"
            >
              Re-Consider within 30 days
            </button>
            <NavLink
              to={getProfileLink()}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <button className="w-full py-2 px-4 border border-blue-500 text-blue-500 rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300">
                View Application
              </button>
            </NavLink>
          </div>
        );

      case "withdraw":
        return (
          <div className="w-full">
            <NavLink
              to={getProfileLink()}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <button className="w-full py-2 px-4 border border-blue-500 text-blue-500 rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300">
                View Application
              </button>
            </NavLink>
          </div>
        );

      case "upcoming":
        return (
          <div className="w-full">
            <NavLink
              to={getProfileLink()}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <button className="w-full py-2 px-4 border border-blue-500 text-blue-500 rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300">
                View Application
              </button>
            </NavLink>
          </div>
        );

      default:
        if (type !== "family" && request) {
          return (
            <div className="w-full">
              <NavLink
                to={getProfileLink()}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <button className="w-full py-2 px-4 border border-blue-500 text-blue-500 rounded-full text-sm Livvic-Medium hover:opacity-70 transition-opacity duration-300">
                  View Application
                </button>
              </NavLink>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:justify-between border border-gray-200 mb-4 rounded-2xl p-4 bg-white shadow-sm">
      {/* Left Section - Profile Info */}
      <div className="flex gap-3 sm:gap-4 flex-1 mb-4 lg:mb-0">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {img ? (
            <img
              className="content-img rounded-full object-cover"
              src={img}
              alt={`${name} profile`}
            />
          ) : (
            <Avatar
              className="content-img rounded-full text-black"
              color="#AEC4FF"
              name={name?.split(" ").slice(0, 2).join(" ")}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name */}
          <p className="Livvic-SemiBold text-lg text-primary">{name}</p>

          {/* Location, Rate, Timing */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm text-gray-600 mb-2">
            {zipCode && formatLocation() && (
              <>
                <span className="Livvic-Medium text-sm text-[#555555]">{formatLocation()}</span>
                <span className="text-gray-400">•</span>
              </>
            )}
            <span className="Livvic-Medium text-sm text-[#555555]">${hourlyRate}/h</span>
            {jobTiming && (
              <>
                <span className="text-gray-400">•</span>
                <span className="Livvic-Medium text-sm text-[#555555]">{jobTiming}</span>
              </>
            )}
            {/* Time (for family type) */}
            {type === "family" && time && (
              <>
                <span className="text-gray-400">•</span>
                <span className="Livvic-Medium text-sm text-[#555555]">{time}</span>
              </>
            )}
             {type === "family" && exp && (
              <>
                <span className="text-gray-400">•</span>
                <span className="Livvic-Medium text-sm text-[#555555]">{exp} yr(s) exp.</span>
              </>
            )}
          </div>

          {/* Start and Experience (for family type) */}
          {/* {type === "family" && (start || exp) && (
            <div className="flex flex-wrap gap-2 sm:gap-4 text-sm text-gray-600 mb-2">
              {start && (
                <span>
                  <strong>Start:</strong> {start}
                </span>
              )}
            </div>
          )} */}

          {/* Job Description */}
          {jobDes && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-3">
              {jobDes.length > 340 ? `${jobDes.slice(0, 340)}...` : jobDes}
            </p>
          )}

          {/* View Details Link */}
          {upcoming && (
            <NavLink
              to={getProfileLink()}
              className="text-blue-500 hover:text-blue-700 text-sm Livvic-Medium underline transition-colors duration-300"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              View Details
            </NavLink>
          )}
        </div>
      </div>

      {/* Right Section - Action Buttons */}
      <div className="flex-shrink-0 w-full lg:w-auto lg:min-w-[200px]">
        {renderActionButtons()}
      </div>
    </div>
  );
}
