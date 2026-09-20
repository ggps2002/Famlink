import {
  Baby,
  Ban,
  Briefcase,
  Check,
  CheckCheck,
  DollarSign,
  Heart,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Star,
  User,
  Users2,
  X,
} from "lucide-react";
import { HeartFilled } from "@ant-design/icons";
import Avatar from "react-avatar";
import { useFavourite } from "@features/dashboard/useFavourite";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Ra from "@shared/ui/Rate";
import InfoTip from "@shared/ui/InfoTip";
import {
  formatEachFamilyRate,
  formatStoredRate,
  RATE_HINTS,
} from "@shared/lib/rates";
import { formatCreatedAt } from "@shared/lib/dates";
import { useState, useEffect } from "react";
// import CustomButton from "@shared/ui/Button";
import { Clock, Home, Calendar, ChevronRight, Users } from "lucide-react";
import CustomButton from "@shared/ui/Button";
import {
  getFamilyTheme,
  getNannyTheme,
  getFamilyGoal,
  getNannyGoal,
  ShareTypeLabel,
} from "@features/nanny-share/shareTypeTheme";
import {
  acceptIncomingRequestThunk,
  rejectIncomingRequestThunk,
  undoRejectedIncomingRequestThunk,
  unblockMatchThunk,
} from "@features/matching/store/matchSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { createChatThunk } from "@features/chat/store/chatSlice";
import RejectMatchModal from "@features/matching/components/RejectMatchModal";
import BlockMatchModal from "@features/matching/components/BlockMatchModal";
import { isMatchGated } from "@features/matching/matchGate";
import {
  formatCareTypeLabel,
  formatScheduleDays,
} from "@shared/lib/scheduleFormat";
import PlusBadge from "@shared/ui/PlusBadge";

/**
 * A card's star rating, sized to sit beside the heart.
 *
 * Renders nothing when nobody has reviewed this member yet. A row of empty grey
 * stars reads as "rated zero" — a worse claim about a new member than saying
 * nothing at all, and the one the rating filter would be blamed for.
 *
 * `averageRating` and `totalRatings` arrive on the browse row already derived,
 * which is deliberate: the number shown here is then the same one the rating
 * filter compared against, rather than a second average computed from the same
 * reviews and liable to round the other way.
 *
 * `compact` collapses the five stars to one. The mobile card puts this between
 * a share-type badge and the heart inside a content column barely 220px wide,
 * where a full star row either wraps or pushes the heart off the card.
 */
const CardRating = ({ averageRating, totalRatings, compact = false }) => {
  if (!totalRatings) return null;

  const label = `Rated ${averageRating} out of 5 from ${totalRatings} review${totalRatings === 1 ? "" : "s"}`;

  return (
    <span
      className="flex items-center gap-1 flex-shrink-0"
      title={label}
      aria-label={label}
    >
      {compact ? (
        <Star size={13} className="text-[#FEA500] fill-[#FEA500]" />
      ) : (
        <Ra points={averageRating} size={13} />
      )}
      <span className="Livvic-SemiBold text-[#555555] text-xs whitespace-nowrap">
        {averageRating}
        <span className="text-[#9AA5B1]"> ({totalRatings})</span>
      </span>
    </span>
  );
};
import dayjs from "dayjs";

const handleRequestAccept = async (
  matchId,
  setIsLoading,
  dispatch,
  setMatchRequestSuccessModal,
  userId,
  setChatUserId,
) => {
  setIsLoading((prev) => ({ ...prev, accept: true }));

  try {
    await dispatch(acceptIncomingRequestThunk({ matchId })).unwrap();

    setMatchRequestSuccessModal(true);
    setChatUserId(userId);
  } catch {
    fireToastMessage({
      type: "error",
      message: "Server error",
    });
  } finally {
    setIsLoading((prev) => ({ ...prev, accept: false }));
  }
};

const handleUndoRejectedMatch = async (matchId, setUndoing, dispatch) => {
  setUndoing(true);
  try {
    await dispatch(undoRejectedIncomingRequestThunk({ matchId })).unwrap();
  } catch {
    fireToastMessage({
      type: "error",
      message: "Server error",
    });
  } finally {
    setUndoing(false);
  }
};

export const FamilyProfile = ({
  name,
  isPremium,
  userId,
  id,
  averageRating,
  totalRatings,
  sharedRate,
  ages,
  childrenCount,
  hasNanny,
  img,
  careType,
  schedule,
  location,
  hosting,
  start,
  shareLocation,
  setIsMatchRequestDenied,
  handleMatchRequest,
  setIsProfileComplete,
  setIsRequestSubmitModal,
  status,
  requestType,
  matchId,
  setMatchRequestSuccessModal,
  setChatUserId,
}) => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const { isFavorited, toggleFavourite: favourite } = useFavourite(id);
  const dispatch = useDispatch();
  const isProfileComplete = user?.nannyProfileCompleted;
  const { currentProfile } = useSelector((state) => state.postNannyShare);
  // Locked when the request would be blocked: profile incomplete, or the user is
  // behind one of the match walls — subscription for families and nannies who
  // already have a family, referral for caregivers looking for a share position.
  // Either way the first request is free, so a new user never sees the lock.
  const isMatchDenied = isMatchGated(user, currentProfile);
  const showLock = !isProfileComplete || isMatchDenied;
  // Callers hand us the string "N/A" for an unanswered budget, not an empty one.
  const hasBudget = Boolean(sharedRate) && sharedRate !== "N/A";
  const [isRejectModal, setIsRejectModal] = useState(false);
  const [isBlockModal, setIsBlockModal] = useState(false);
  // Local mirror of the match status so block/unblock reflect immediately on the
  // card without a refetch (the list data lives in a different slice). Re-syncs
  // whenever the status prop changes (e.g. after a parent refetch).
  const [matchStatus, setMatchStatus] = useState(status);
  const [unblocking, setUnblocking] = useState(false);
  useEffect(() => {
    setMatchStatus(status);
  }, [status]);
  const handleUnblock = async () => {
    setUnblocking(true);
    try {
      await dispatch(unblockMatchThunk({ matchId })).unwrap();
      setMatchStatus("accepted");
    } catch (error) {
      fireToastMessage({
        type: "error",
        message: error?.message || "Server error",
      });
    } finally {
      setUnblocking(false);
    }
  };
  const [undoing, setUndoing] = useState(false);
  const [isLoading, setIsLoading] = useState({
    accept: false,
    reject: false,
  });

  // const handleMessage = async () => {
  //   try {
  //     const participants = [userId, user._id];
  //     const { status } = await dispatch(
  //       createChatThunk({ participants }),
  //     ).unwrap();
  //     if (status === 201 || status === 200) {
  //       navigate(`/dashboard/message/`);
  //     }
  //   } catch (error) {
  //     // console.log(error);
  //     fireToastMessage({ type: "error", message: error.message });
  //   }
  // };

  const handleMessage = async () => {
    try {
      const participants = [userId, user._id];
      const { status } = await dispatch(
        createChatThunk({ participants }),
      ).unwrap();
      if (status === 201 || status === 200) {
        navigate(`/dashboard/message?chatId=${userId}`);
      }
    } catch (error) {
      // console.log(error);
      fireToastMessage({ type: "error", message: error.message });
    } finally {
      // setIsRequestMatchSuccessModal(false)
    }
  };

  // Meta items JSX — shared between mobile (full-width below avatar row) and desktop (inline)
  const metaItems = (
    <>
      {/* Schedule */}
      <div className="flex items-center gap-2 min-w-0">
        <Clock
          size={18}
          className={`text-[#6466e9] flex-shrink-0 ${!schedule ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          <span className="text-xs Livvic-Medium text-[#202020] capitalize whitespace-nowrap">
            {formatCareTypeLabel(careType)}
          </span>
          {schedule ? (
            <>
              <span className="text-[10px] text-[#888] Livvic-Medium whitespace-nowrap">
                {formatScheduleDays(schedule)}
              </span>
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Schedule not set
            </span>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 min-w-0">
        <MapPin
          size={18}
          className={`text-[#eaa541] flex-shrink-0 ${!(location?.neighborhood || location?.city || location?.format_location) ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {location?.neighborhood ||
          location?.city ||
          location?.format_location ? (
            location?.neighborhood || location?.city ? (
              <>
                <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                  {location?.city || location?.neighborhood}
                </span>
                {location?.neighborhood && location?.city && (
                  <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                    {location.neighborhood}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                {location?.format_location
                  ?.split(",")
                  .slice(-3, -1)
                  .join(", ") || location?.format_location}
              </span>
            )
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Location not set
            </span>
          )}
        </div>
      </div>

      {/* Rates — a family states their own share of the cost and nothing else.
          This card used to lead with the combined figure stored beside it,
          which is the caregiver's rate for the whole share, not a price this
          family is offering. */}
      <div className="flex items-center gap-2 min-w-0">
        <DollarSign
          size={18}
          className={`flex-shrink-0 text-[#10B981] ${!hasBudget ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {hasBudget ? (
            <>
              <span className="text-xs Livvic-Medium text-[#202020] inline-flex items-center gap-1">
                {sharedRate}
                <InfoTip text={RATE_HINTS.familyBudget} size={12} />
              </span>
              <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                Their share of the cost
              </span>
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Rate not set
            </span>
          )}
        </div>
      </div>

      {/* Hosting */}
      <div className="flex items-center gap-2 min-w-0">
        <Home
          size={18}
          className={`flex-shrink-0 text-[#e97b35] ${!hosting ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {hosting ? (
            <>
              <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                Hosting Preference
              </span>
              <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                {hosting?.toLowerCase() === "your home" ? "My home" : hosting}
              </span>
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Hosting not set
            </span>
          )}
        </div>
      </div>

      {/* Starting */}
      <div className="flex items-center gap-2 min-w-0">
        <Calendar
          size={18}
          className={`flex-shrink-0 text-[#3B82F6] ${!start ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {start ? (
            <>
              <span className="text-xs Livvic-Medium text-[#202020]">
                Starting
              </span>
              <span className="text-[10px] Livvic-Medium text-[#888] capitalize whitespace-nowrap">
                {(() => {
                  if (!start) return "";
                  if (dayjs.isDayjs(start)) {
                    return start.isValid()
                      ? start.format("MMMM D, YYYY")
                      : "Invalid Date";
                  }
                  if (typeof start === "string") {
                    const cleaned = start.replace(/"/g, "");
                    const parsed = dayjs(cleaned);
                    return parsed.isValid()
                      ? parsed.format("MMMM D, YYYY")
                      : cleaned;
                  }
                  return String(start);
                })()}
              </span>
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Availability not set
            </span>
          )}
        </div>
      </div>
    </>
  );

  const ButtonAreaText = () => {
    switch (matchStatus) {
      case "pending":
        // Outgoing pending = "Request Sent", Incoming pending = Accept/Reject buttons
        if (requestType === "incoming") {
          return (
            <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
              <CustomButton
                btnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <Check size={18} />
                    <p className="Livvic-Medium whitespace-nowrap">Accept</p>
                  </div>
                }
                className="bg-[#AEC4FF] text-[#0D134C] !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
                action={() =>
                  handleRequestAccept(
                    matchId,
                    setIsLoading,
                    dispatch,
                    setMatchRequestSuccessModal,
                    userId,
                    setChatUserId,
                  )
                }
                isLoading={isLoading.accept}
                loadingBtnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <p className="Livvic-Medium whitespace-nowrap">
                      Accepting...
                    </p>
                  </div>
                }
              />
              <CustomButton
                btnText={
                  <div className="text-primary flex items-center justify-center gap-2 h-full">
                    <X size={18} />
                    <p className="Livvic-Medium whitespace-nowrap">Not a fit</p>
                  </div>
                }
                className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
                action={() => setIsRejectModal(true)}
                isLoading={isLoading.reject}
                loadingBtnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <p className="Livvic-Medium whitespace-nowrap">
                      Waiting...
                    </p>
                  </div>
                }
              />
            </div>
          );
        }
        // Outgoing pending
        return (
          <span className="inline-flex items-center gap-1.5 Livvic-Medium bg-[#EBF0FF] border border-[#AEC4FF] text-[#AEC4FF] rounded-lg px-3 py-1 text-xs Livvic-Medium flex-shrink-0">
            <Clock size={12} className="sm:hidden" />
            <Clock size={13} className="hidden sm:block" />
            <span className="Livvic-Medium">request sent!</span>
          </span>
        );

      case "accepted":
        return (
          <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
            <CustomButton
              btnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <MessageCircle size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Chat</p>
                </div>
              }
              className="bg-[#AEC4FF] text-[#0D134C] !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-xl"
              action={() => handleMessage()}
            />
            <CustomButton
              btnText={
                <div className="text-primary flex items-center justify-center gap-2 h-full">
                  <Ban size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Block</p>
                </div>
              }
              className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-xl"
              action={() => setIsBlockModal(true)}
              isLoading={isLoading.block}
              loadingBtnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <p className="Livvic-Medium whitespace-nowrap">Waiting...</p>
                </div>
              }
            />
          </div>
        );

      case "blocked":
        return (
          <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
            <CustomButton
              btnText={
                <div className="text-primary flex items-center justify-center gap-2 h-full">
                  <Ban size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Unblock</p>
                </div>
              }
              className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
              action={handleUnblock}
              isLoading={unblocking}
              loadingBtnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <p className="Livvic-Medium whitespace-nowrap">
                    Unblocking...
                  </p>
                </div>
              }
            />
          </div>
        );

      default:
        if (handleMatchRequest) {
          return (
            <CustomButton
              action={() =>
                handleMatchRequest(
                  user,
                  user._id,
                  userId,
                  setIsMatchRequestDenied,
                  setIsProfileComplete,
                  setIsRequestSubmitModal,
                )
              }
              btnText={
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Users size={16} className="flex-shrink-0" />
                  <span className="Livvic-SemiBold text-sm whitespace-nowrap">
                    Request a Match
                  </span>
                  {showLock && (
                    <LockKeyhole size={16} className="flex-shrink-0" />
                  )}
                </div>
              }
              className="w-full bg-[#AEC4FF] text-[#0D134C] !h-10 flex items-center justify-center !rounded-xl"
            />
          );
        }

        if (userId === user._id) {
          return (
            <div>
              {!user.nannyProfileCompleted ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-sm Livvic-SemiBold text-gray-800">
                    Profile Completion
                  </span>
                  {/* Circular progress */}
                  <div
                    className="relative flex-shrink-0"
                    style={{ width: 64, height: 64 }}
                  >
                    <svg viewBox="0 0 52 52" width="64" height="64">
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="5"
                      />
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        stroke="#AEC4FF"
                        strokeWidth="5"
                        strokeDasharray="138.23"
                        strokeDashoffset="34.56"
                        strokeLinecap="round"
                        transform="rotate(-90 26 26)"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm Livvic-SemiBold text-gray-800">
                      75%
                    </span>
                  </div>
                  <CustomButton
                    btnText={
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        <span className="Livvic-SemiBold text-sm whitespace-nowrap">
                          Complete your profile
                        </span>
                      </div>
                    }
                    action={() =>
                      user.type === "Nanny"
                        ? navigate("/dashboard/complete-profile")
                        : navigate(
                            `/dashboard/post-a-nannyShare?recordId=${user.sheetId}`,
                          )
                    }
                    className="w-full bg-[#AEC4FF] text-[#0D134C] !h-10 flex items-center justify-center !rounded-xl"
                  />
                  <span className="text-xs text-center Livvic-Medium text-gray-300">
                    Complete profile to start matching with compatible families.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#AEC4FF] bg-[#EBF0FF] text-[#AEC4FF] w-auto md:w-full whitespace-nowrap">
                  <CheckCheck size={14} strokeWidth={2.5} />
                  <span className="Livvic-Medium text-xs">
                    profile ready for matches
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Declined request. On the "Sent" (outgoing) tab the sender cannot
        // un-reject the receiver's decision, so show a read-only status.
        // "Undo" only applies to an incoming request the current user declined.
        return (
          <div>
            {requestType === "outgoing" ? (
              <span className="inline-flex items-center gap-1.5 Livvic-Medium bg-red-50 border border-red-400 text-red-500 rounded-lg px-3 py-1 text-xs flex-shrink-0">
                <X size={13} />
                <span className="Livvic-Medium">request declined</span>
              </span>
            ) : (
              <CustomButton
                btnText="Undo"
                isLoading={undoing}
                loadingBtnText="Undoing..."
                action={() =>
                  handleUndoRejectedMatch(matchId, setUndoing, dispatch)
                }
                className="w-full sm:w-auto text-primary border-2 border-gray-300 text-sm Livvic-Medium rounded-full whitespace-nowrap transition-colors"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-[1400px] bg-white border border-[#ECECEC] hover:border-[#AEC4FF] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.1),0px_0px_15px_rgba(0,0,0,0.03)] transition-all duration-300 rounded-3xl overflow-hidden">
      {isRejectModal && (
        <RejectMatchModal
          matchId={matchId}
          setIsRejectModal={setIsRejectModal}
        />
      )}
      {isBlockModal && (
        <BlockMatchModal
          matchId={matchId}
          name={name}
          setIsBlockModal={setIsBlockModal}
          onBlocked={() => setMatchStatus("blocked")}
        />
      )}

      {/* ── CARD INNER ── */}
      <div className="flex flex-col md:flex-row md:items-stretch md:min-h-[192px]">
        {/* ── LEFT ── */}
        <div className="flex flex-col flex-1 px-4 py-4 sm:px-5 sm:py-4 md:px-5 md:py-4 min-w-0">
          {/* Avatar + top content row */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24">
              <div className="relative w-full h-full rounded-2xl overflow-hidden">
                {img ? (
                  <img
                    src={img}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#AEC4FF] text-[#0D134C] font-black Livvic-Bold text-2xl md:text-3xl">
                    {getInitials(name)}
                  </div>
                )}
              </div>

              {/* Heart — below md only. The desktop heart lives in the right
                  panel, which on mobile becomes a row of action buttons, so the
                  heart straddles the photo's top-left corner on a card-coloured
                  disc. The negative offsets keep it half off the photo; both
                  stay inside the card's own padding, so nothing is clipped. */}
              {user._id !== userId && (
                <button
                  onClick={favourite}
                  aria-label={
                    isFavorited
                      ? "Remove from favourites"
                      : "Add to favourites"
                  }
                  className="md:hidden absolute -top-2 -left-2 z-10 flex items-center justify-center bg-white border-none cursor-pointer p-1.5 rounded-full"
                >
                  <Heart
                    size={16}
                    className={
                      isFavorited
                        ? "text-red-500 fill-red-500"
                        : "text-[#9CA3AF]"
                    }
                  />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Top row: Badge + rating (mobile only) */}
              <div className="grid grid-cols-1 gap-y-1 md:flex md:items-center md:justify-between md:gap-2 mb-2 md:mb-0">
                {/* Family */}
                <span
                  style={{
                    backgroundColor: getFamilyTheme(hasNanny).bg,
                    color: getFamilyTheme(hasNanny).text,
                  }}
                  className="row-start-1 col-start-1 md:order-1 inline-flex w-fit items-center gap-1.5 font-bold Livvic-Bold rounded-full px-3 py-1 text-[11px] md:text-xs flex-shrink-0"
                >
                  <Users size={12} className="sm:hidden" />
                  <Users size={13} className="hidden sm:block" />
                  <ShareTypeLabel
                    role="Family"
                    goal={getFamilyGoal(hasNanny)}
                  />
                </span>

                {/* Rating */}
                <span className="block md:hidden row-start-2 col-start-1 md:order-2 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                  <CardRating
                    averageRating={averageRating}
                    totalRatings={totalRatings}
                  />
                </span>
              </div>

              {/* Family name. The row exists so the Plus badge sits beside the
                  name without being swallowed by the heading's `truncate` — a
                  long name shortens, the badge stays whole. */}
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base md:text-[17px] font-black Livvic-Bold text-[#001243] mb-0 truncate">
                  {`${name?.split(" ")[0] || ""}${
                    name?.split(" ")[1]
                      ? ` ${name.split(" ")[1][0].toUpperCase()}.`
                      : ""
                  }`}
                </h2>
                <PlusBadge active={isPremium} />
                {/* {user._id !== userId && <button
                    onClick={favourite}
                    aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
                    className="bg-transparent border-none cursor-pointer p-1 flex-shrink-0 md:hidden block"
                  >
                    <Heart
                      size={20}
                      className={isFavorited ? "text-red-500 fill-red-500" : "text-[#0D134C]"}
                    />
                  </button>} */}
              </div>
              {/* Children info */}
              <p className="text-[13px] text-[#5D5D5D] mb-1.5 md:mb-1 leading-tight md:h-5 overflow-hidden">
                <span className="Livvic-Medium text-[#202020] whitespace-nowrap">
                  {childrenCount || 0} Child{childrenCount !== 1 && "ren"}
                </span>
                {ages && ages.length > 0 && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="Livvic-Medium text-[#202020]">
                      {(() => {
                        let parsedAges = ages;
                        if (
                          Array.isArray(parsedAges) &&
                          parsedAges.length === 1 &&
                          typeof parsedAges[0] === "string" &&
                          parsedAges[0].startsWith("[")
                        ) {
                          try {
                            parsedAges = JSON.parse(parsedAges[0]);
                          } catch (e) {}
                        }
                        if (typeof parsedAges === "string") {
                          try {
                            parsedAges = JSON.parse(parsedAges);
                          } catch (e) {
                            parsedAges = parsedAges.split(",");
                          }
                        }

                        return Array.isArray(parsedAges)
                          ? parsedAges
                              .map((age) => {
                                if (
                                  typeof age === "object" &&
                                  age !== null &&
                                  age.label
                                )
                                  return age.label;
                                let cleanAge = String(age)
                                  .replace(/[\[\]"]/g, "")
                                  .trim();
                                let lower = cleanAge.toLowerCase();
                                if (
                                  lower.includes("year") ||
                                  lower.includes("yr") ||
                                  lower.includes("month") ||
                                  lower.includes("mo")
                                ) {
                                  return cleanAge;
                                }
                                const ageNum = parseFloat(cleanAge);
                                if (isNaN(ageNum)) return cleanAge;
                                if (ageNum % 1 !== 0) {
                                  const months = Math.round(ageNum * 12);
                                  return `${months} month${months > 1 ? "s" : ""}`;
                                }
                                return `${ageNum} year${ageNum > 1 ? "s" : ""}`;
                              })
                              .join(", ")
                          : null;
                      })()}
                    </span>
                  </>
                )}
              </p>

              {/* Meta items — desktop inline (md+), hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-2 gap-x-12 gap-y-0">
                {metaItems}
              </div>
            </div>
          </div>

          {/* Meta items — mobile full-width below avatar row (hidden on md+) */}
          <div className="flex flex-wrap content-start gap-x-6 gap-y-1 mt-2 md:hidden">
            {metaItems}
          </div>
        </div>

        {/* ── HORIZONTAL DIVIDER (mobile only) ── */}
        <div className="block md:hidden h-px bg-[#E9E9E9] mx-4 sm:mx-5" />

        {/* ── RIGHT PANEL ── */}
        <div
          className={`
          flex items-center ${!user.nannyProfileCompleted && user._id === userId ? "justify-center w-full" : "justify-between"} gap-2 px-4 py-3 
          md:flex-col md:p-4
          md:w-[210px] lg:w-[240px] md:gap-2
          flex-shrink-0 mt-4 md:mt-0
          md:justify-center md:items-center md:relative
        `}
        >
          {/* Rating + heart — desktop only (top-right). One positioned row so
              the stars sit beside the heart instead of being absolutely placed
              on top of it. The self-profile branch keeps the same reserved
              height, so a card of your own lines up with everyone else's. */}
          {user.nannyProfileCompleted ? (
            <div className="hidden md:flex items-center gap-2 h-8 md:absolute md:top-4 md:right-4">
              <CardRating
                averageRating={averageRating}
                totalRatings={totalRatings}
              />
              {user._id !== userId && (
                <button
                  onClick={favourite}
                  aria-label={
                    isFavorited ? "Remove from favourites" : "Add to favourites"
                  }
                  className="bg-transparent border-none cursor-pointer p-1"
                >
                  <Heart
                    className={
                      isFavorited
                        ? "text-red-500 fill-red-500"
                        : "text-[#9CA3AF]"
                    }
                  />
                </button>
              )}
            </div>
          ) : null}

          {/* View Details */}
          {user.nannyProfileCompleted ? (
            user._id === userId ? (
              <button
                onClick={() => navigate(`/dashboard/edit`)}
                className="
            flex items-center md:justify-center gap-1 bg-transparent border-none cursor-pointer
            text-primary Livvic-SemiBold text-[13px] whitespace-nowrap md:mb-2
          "
              >
                Edit profile
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => navigate(`/dashboard/family-profile-view/${id}`)}
                className="
            flex items-center md:justify-center gap-1 bg-transparent border-none cursor-pointer
            text-primary Livvic-SemiBold text-[13px] whitespace-nowrap md:mb-2
          "
              >
                View Details
                <ChevronRight size={14} />
              </button>
            )
          ) : null}

          {/* Request Match */}
          <div className="md:w-full">
            <ButtonAreaText />
          </div>
        </div>
      </div>
    </div>
  );
};

export const NannyProfile = ({
  id,
  isPremium,
  userId,
  averageRating,
  totalRatings,
  soloRate,
  sharedRate,
  rateType,
  ages,
  schedule,
  careType,
  start,
  img,
  name,
  experience,
  distance,
  location,
  setIsMatchRequestDenied,
  handleMatchRequest,
  setIsProfileComplete,
  setIsRequestSubmitModal,
  childrenCount,
  status,
  requestType,
  setMatchRequestSuccessModal,
  setChatUserId,
  matchId,
  hasFamily,
  whereCare,
  created,
}) => {
  const { user } = useSelector((state) => state.auth);
  const { isFavorited, toggleFavourite: favourite } = useFavourite(id);
  const [undoing, setUndoing] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isRejectModal, setIsRejectModal] = useState(false);
  const [isBlockModal, setIsBlockModal] = useState(false);
  // Local mirror of the match status so block/unblock reflect immediately on the
  // card without a refetch (the list data lives in a different slice). Re-syncs
  // whenever the status prop changes (e.g. after a parent refetch).
  const [matchStatus, setMatchStatus] = useState(status);
  const [unblocking, setUnblocking] = useState(false);
  useEffect(() => {
    setMatchStatus(status);
  }, [status]);
  const handleUnblock = async () => {
    setUnblocking(true);
    try {
      await dispatch(unblockMatchThunk({ matchId })).unwrap();
      setMatchStatus("accepted");
    } catch (error) {
      fireToastMessage({
        type: "error",
        message: error?.message || "Server error",
      });
    } finally {
      setUnblocking(false);
    }
  };

  const isProfileComplete = user?.nannyProfileCompleted;
  const { currentProfile } = useSelector((state) => state.postNannyShare);
  // Locked when the request would be blocked: profile incomplete, or the user is
  // behind one of the match walls — subscription for families and nannies who
  // already have a family, referral for caregivers looking for a share position.
  // Either way the first request is free, so a new user never sees the lock.
  const isMatchDenied = isMatchGated(user, currentProfile);
  const showLock = !isProfileComplete || isMatchDenied;
  const [isLoading, setIsLoading] = useState({
    accept: false,
    reject: false,
  });

  const ageLabels = {
    "toddlers (1–3)": "Toddlers (1–3 years)",
    "preschool (3–5)": "Preschool (3–5 years)",
    "infants (0–1)": "Infants (0–1 years)",
    "school-age (5+)": "School Age (5+ years)",
  };

  const formattedAges = Array.isArray(ages)
    ? ages.map((age) => ageLabels[age] || age).join(", ")
    : "Not specified";
  const handleMessage = async () => {
    try {
      const participants = [userId, user._id];
      const { status } = await dispatch(
        createChatThunk({ participants }),
      ).unwrap();
      if (status === 201 || status === 200) {
        navigate(`/dashboard/message?chatId=${userId}`);
      }
    } catch (error) {
      // console.log(error);
      fireToastMessage({ type: "error", message: error.message });
    } finally {
      // setIsRequestMatchSuccessModal(false)
    }
  };
  const rateLabel = rateType === "hourly" ? "hr" : "wk";

  // Both of a caregiver's rates, because the pair IS the pitch: what a family
  // pays in the share, and what the same caregiver costs without one. Either
  // number on its own leaves a reader unable to tell whether a share is worth it.
  //
  // The two arrive in two shapes. For a caregiver who already has a family they
  // are formatted strings off `hourlyBudget` ("~$10 - $12/hr per family"); for
  // one looking for a share they are the raw questionnaire answers ("25-30"),
  // and that shared answer is their COMBINED rate for both families, so it is
  // halved. Shown whole it made a share look dearer than hiring alone.
  const isRateSet = (rate) => Boolean(rate) && rate !== "N/A";
  const perFamilyRate = hasFamily
    ? isRateSet(sharedRate)
      ? sharedRate
      : null
    : formatEachFamilyRate(sharedRate, `/${rateLabel} per family`);
  const ownRate = hasFamily
    ? isRateSet(soloRate)
      ? soloRate
      : null
    : formatStoredRate(soloRate, `/${rateLabel}`);
  // Schedule is considered "set" if we have a care type OR actual availability
  // days — a nanny who completed the availability step but has no careType
  // still has a real schedule and shouldn't read as "Schedule not set".
  const scheduleText = formatScheduleDays(schedule);

  // Meta items JSX — shared between mobile (full-width below avatar row) and desktop (inline)
  const metaItems = (
    <>
      {/* Schedule */}
      <div className="flex items-center gap-2 min-w-0">
        <Clock
          size={18}
          className={`text-[#6366F1] flex-shrink-0 ${!careType && !scheduleText ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {careType || scheduleText ? (
            <>
              {careType && (
                <span className="text-xs Livvic-Medium text-[#202020] capitalize whitespace-nowrap">
                  {formatCareTypeLabel(careType)}
                </span>
              )}
              {scheduleText && (
                <span
                  className={`whitespace-nowrap Livvic-Medium ${careType ? "text-[10px] text-[#888]" : "text-xs text-[#202020]"}`}
                >
                  {scheduleText}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Schedule not set
            </span>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 min-w-0">
        <MapPin
          size={18}
          className={`text-[#F59E0B] flex-shrink-0 ${!(location?.neighborhood || location?.city || location?.format_location) ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {location?.neighborhood ||
          location?.city ||
          location?.format_location ? (
            location?.neighborhood || location?.city ? (
              <>
                <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                  {location?.city || location?.neighborhood}
                </span>
                {location?.neighborhood && location?.city && (
                  <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                    {location.neighborhood}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                {location?.format_location
                  ?.split(",")
                  .slice(-3, -1)
                  .join(", ") || location?.format_location}
              </span>
            )
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Location not set
            </span>
          )}
        </div>
      </div>

      {/* Rates — the share rate over the solo rate, each carrying the words that
          say which one it is ("per family", "on their own"). Two bare prices
          stacked with no labels was the original problem: nothing told a reader
          whether they were looking at their own share or the caregiver's rate. */}
      <div className="flex items-center gap-2 min-w-0">
        <DollarSign
          size={18}
          className={`text-[#10B981] flex-shrink-0 ${!(perFamilyRate || ownRate) ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {perFamilyRate || ownRate ? (
            <>
              <span className="text-xs Livvic-Medium text-[#202020] inline-flex items-center gap-1">
                {perFamilyRate || ownRate}
                <InfoTip
                  text={perFamilyRate ? RATE_HINTS.eachFamily : RATE_HINTS.solo}
                  size={12}
                />
              </span>
              {perFamilyRate && ownRate && (
                <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                  {`${ownRate} on their own`}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Rate not set
            </span>
          )}
        </div>
      </div>

      {/* Hosting */}
      {hasFamily && (
        <div className="flex items-center gap-2 min-w-0">
          <Home
            size={18}
            className={`text-[#F97316] flex-shrink-0 ${!whereCare ? "text-gray-300" : ""}`}
          />
          <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
            {whereCare ? (
              <>
                <span className="text-xs Livvic-Medium text-[#202020] whitespace-nowrap">
                  Hosting Preference
                </span>
                <span className="text-[10px] Livvic-Medium text-[#888] whitespace-nowrap">
                  {whereCare}
                </span>
              </>
            ) : (
              <span className="text-xs Livvic-Medium text-gray-400 italic">
                Hosting not set
              </span>
            )}
          </div>
        </div>
      )}

      {/* Available */}
      <div className="flex items-center gap-2 min-w-0">
        <Calendar
          size={18}
          className={`text-[#3B82F6] flex-shrink-0 ${!start ? "text-gray-300" : ""}`}
        />
        <div className="flex flex-col justify-center leading-tight min-w-0 min-h-[34px]">
          {start ? (
            <>
              <span className="text-xs Livvic-Medium text-[#202020]">
                Starting
              </span>
              <span className="text-[10px] Livvic-Medium text-[#888] capitalize whitespace-nowrap">
                {(() => {
                  if (!start) return "";
                  if (dayjs.isDayjs(start)) {
                    return start.isValid()
                      ? start.format("MMMM D, YYYY")
                      : "Invalid Date";
                  }
                  if (typeof start === "string") {
                    const cleaned = start.replace(/"/g, "");
                    const parsed = dayjs(cleaned);
                    return parsed.isValid()
                      ? parsed.format("MMMM D, YYYY")
                      : cleaned;
                  }
                  return String(start);
                })()}
              </span>
            </>
          ) : (
            <span className="text-xs Livvic-Medium text-gray-400 italic">
              Availability not set
            </span>
          )}
        </div>
      </div>
    </>
  );

  const ButtonAreaText = () => {
    switch (matchStatus) {
      case "pending":
        // Outgoing pending = "Request Sent", Incoming pending = Accept/Reject buttons
        if (requestType === "incoming") {
          return (
            <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
              <CustomButton
                btnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <Check size={18} />
                    <p className="Livvic-Medium whitespace-nowrap">Accept</p>
                  </div>
                }
                className="bg-[#AEC4FF] text-[#0D134C] !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
                action={() =>
                  handleRequestAccept(
                    matchId,
                    setIsLoading,
                    dispatch,
                    setMatchRequestSuccessModal,
                    userId,
                    setChatUserId,
                  )
                }
                isLoading={isLoading.accept}
                loadingBtnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <p className="Livvic-Medium whitespace-nowrap">
                      Accepting...
                    </p>
                  </div>
                }
              />
              <CustomButton
                btnText={
                  <div className="text-primary flex items-center justify-center gap-2 h-full">
                    <X size={18} />
                    <p className="Livvic-Medium whitespace-nowrap">Not a fit</p>
                  </div>
                }
                className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
                action={() => setIsRejectModal(true)}
                isLoading={isLoading.reject}
                loadingBtnText={
                  <div className="flex items-center justify-center gap-2 h-full">
                    <p className="Livvic-Medium whitespace-nowrap">
                      Waiting...
                    </p>
                  </div>
                }
              />
            </div>
          );
        }
        // Outgoing pending
        return (
          <span className="inline-flex items-center gap-1.5 Livvic-Medium bg-yellow-50 border border-yellow-500 text-yellow-500 rounded-lg px-3 py-1 text-xs Livvic-Medium flex-shrink-0">
            <Clock size={12} className="sm:hidden" />
            <Clock size={13} className="hidden sm:block" />
            <span className="Livvic-Medium">request sent!</span>
          </span>
        );

      case "accepted":
        return (
          <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
            <CustomButton
              btnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <MessageCircle size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Chat</p>
                </div>
              }
              className="bg-[#AEC4FF] text-[#0D134C] !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
              action={() => handleMessage()}
            />
            <CustomButton
              btnText={
                <div className="text-primary flex items-center justify-center gap-2 h-full">
                  <Ban size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Block</p>
                </div>
              }
              className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
              action={() => setIsBlockModal(true)}
              isLoading={isLoading.block}
              loadingBtnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <p className="Livvic-Medium whitespace-nowrap">Waiting...</p>
                </div>
              }
            />
          </div>
        );

      case "blocked":
        return (
          <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:w-full">
            <CustomButton
              btnText={
                <div className="text-primary flex items-center justify-center gap-2 h-full">
                  <Ban size={18} />
                  <p className="Livvic-Medium whitespace-nowrap">Unblock</p>
                </div>
              }
              className="bg-white border-2 border-gray-300 !px-4 !py-2 !h-10 min-w-[100px] sm:w-full flex items-center justify-center !rounded-2xl"
              action={handleUnblock}
              isLoading={unblocking}
              loadingBtnText={
                <div className="flex items-center justify-center gap-2 h-full">
                  <p className="Livvic-Medium whitespace-nowrap">
                    Unblocking...
                  </p>
                </div>
              }
            />
          </div>
        );

      default:
        if (handleMatchRequest) {
          return (
            <CustomButton
              action={() =>
                handleMatchRequest(
                  user,
                  user._id,
                  userId,
                  setIsMatchRequestDenied,
                  setIsProfileComplete,
                  setIsRequestSubmitModal,
                )
              }
              btnText={
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <Users size={16} className="flex-shrink-0" />
                  <span className="Livvic-SemiBold text-sm whitespace-nowrap">
                    Request a Match
                  </span>
                  {showLock && (
                    <LockKeyhole size={16} className="flex-shrink-0" />
                  )}
                </div>
              }
              className="w-full bg-[#AEC4FF] text-[#0D134C] !h-10 flex items-center justify-center !rounded-xl"
            />
          );
        }

        if (userId === user._id) {
          return (
            <div>
              {!user.nannyProfileCompleted ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-sm Livvic-SemiBold text-gray-800">
                    Profile Completion
                  </span>
                  {/* Circular progress */}
                  <div
                    className="relative flex-shrink-0"
                    style={{ width: 64, height: 64 }}
                  >
                    <svg viewBox="0 0 52 52" width="64" height="64">
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="5"
                      />
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        fill="none"
                        stroke="#AEC4FF"
                        strokeWidth="5"
                        strokeDasharray="138.23"
                        strokeDashoffset="34.56"
                        strokeLinecap="round"
                        transform="rotate(-90 26 26)"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm Livvic-SemiBold text-gray-800">
                      75%
                    </span>
                  </div>
                  <CustomButton
                    btnText={
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        <span className="Livvic-SemiBold text-sm whitespace-nowrap">
                          Complete your profile
                        </span>
                      </div>
                    }
                    action={() =>
                      user.type === "Nanny"
                        ? navigate("/dashboard/complete-profile")
                        : navigate(
                            `/dashboard/post-a-nannyShare?recordId=${user.sheetId}`,
                          )
                    }
                    className="w-full bg-[#AEC4FF] text-[#0D134C] !h-10 flex items-center justify-center !rounded-xl"
                  />
                  <span className="text-xs text-center Livvic-Medium text-gray-300">
                    Complete profile to start matching with compatible families.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#AEC4FF] bg-[#EBF0FF] text-[#AEC4FF] w-auto md:w-full whitespace-nowrap">
                  <CheckCheck size={14} strokeWidth={2.5} />
                  <span className="Livvic-Medium text-xs">
                    profile ready for matches
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Declined request. On the "Sent" (outgoing) tab the sender cannot
        // un-reject the receiver's decision, so show a read-only status.
        // "Undo" only applies to an incoming request the current user declined.
        return (
          <div>
            {requestType === "outgoing" ? (
              <span className="inline-flex items-center gap-1.5 Livvic-Medium bg-red-50 border border-red-400 text-red-500 rounded-lg px-3 py-1 text-xs flex-shrink-0">
                <X size={13} />
                <span className="Livvic-Medium">request declined</span>
              </span>
            ) : (
              <CustomButton
                btnText="Undo"
                isLoading={undoing}
                loadingBtnText="Undoing..."
                action={() =>
                  handleUndoRejectedMatch(matchId, setUndoing, dispatch)
                }
                className="w-full sm:w-auto text-primary border-2 border-gray-300 text-sm Livvic-Medium rounded-full whitespace-nowrap transition-colors"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-[1400px] bg-white border border-[#ECECEC] hover:border-[#AEC4FF] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.1),0px_0px_15px_rgba(0,0,0,0.03)] transition-all duration-300 rounded-3xl overflow-hidden">
      {isRejectModal && (
        <RejectMatchModal
          matchId={matchId}
          setIsRejectModal={setIsRejectModal}
        />
      )}
      {isBlockModal && (
        <BlockMatchModal
          matchId={matchId}
          name={name}
          setIsBlockModal={setIsBlockModal}
          onBlocked={() => setMatchStatus("blocked")}
        />
      )}

      {/* ── CARD INNER ── */}
      <div className="flex flex-col md:flex-row md:items-stretch md:min-h-[192px]">
        {/* ── LEFT ── */}
        <div className="flex flex-col flex-1 px-4 py-4 sm:px-5 sm:py-4 md:px-5 md:py-4 min-w-0">
          {/* Avatar + top content row */}
          {/* Avatar + top content row */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24">
              <div className="relative w-full h-full rounded-2xl overflow-hidden">
                {img ? (
                  <img
                    src={img}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#AEC4FF] text-[#0D134C] font-black Livvic-Bold text-2xl md:text-3xl">
                    {getInitials(name)}
                  </div>
                )}
              </div>

              {/* Heart — below md only. The desktop heart lives in the right
                  panel, which on mobile becomes a row of action buttons, so the
                  heart straddles the photo's top-left corner on a card-coloured
                  disc. The negative offsets keep it half off the photo; both
                  stay inside the card's own padding, so nothing is clipped. */}
              {user._id !== userId && (
                <button
                  onClick={favourite}
                  aria-label={
                    isFavorited
                      ? "Remove from favourites"
                      : "Add to favourites"
                  }
                  className="md:hidden absolute -top-2 -left-2 z-10 flex items-center justify-center bg-white border-none cursor-pointer p-1.5 rounded-full"
                >
                  <Heart
                    size={16}
                    className={
                      isFavorited
                        ? "text-red-500 fill-red-500"
                        : "text-[#9CA3AF]"
                    }
                  />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Top row: Badge + rating (mobile only) */}
              <div className="grid grid-cols-1 gap-y-1 md:flex md:items-center md:justify-between md:gap-2 md:mb-0.5">
                {/* Nanny */}
                <span
                  style={{
                    backgroundColor: getNannyTheme(hasFamily).bg,
                    color: getNannyTheme(hasFamily).text,
                  }}
                  className="row-start-1 col-start-1 md:order-1 inline-flex w-fit items-center gap-1.5 font-bold Livvic-Bold rounded-full px-3 py-1 text-[11px] md:text-xs flex-shrink-0"
                >
                  <Users size={12} className="sm:hidden" />
                  <Users size={13} className="hidden sm:block" />
                  <ShareTypeLabel role="Nanny" goal={getNannyGoal(hasFamily)} />
                </span>

                {/* Rating */}
                <span className="block md:hidden row-start-2 col-start-1 md:order-2 flex items-center flex-shrink-0 whitespace-nowrap">
                  <CardRating
                    averageRating={averageRating}
                    totalRatings={totalRatings}
                  />
                </span>
              </div>

              {/* Name. Wrapped for the same reason as the family card: the
                  heading truncates, the badge beside it must not. */}
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base md:text-[17px] font-black Livvic-Bold text-[#001243] mb-0 truncate">
                  {`${name?.split(" ")[0] || ""}${
                    name?.split(" ")[1]
                      ? ` ${name.split(" ")[1][0].toUpperCase()}.`
                      : ""
                  }`}
                </h2>
                <PlusBadge active={isPremium} />
              </div>

              {/* Children info */}
              {hasFamily && (
                <p className="text-[13px] text-[#5D5D5D] mb-1.5 md:mb-1 leading-tight md:h-5 overflow-hidden">
                  <span className="Livvic-Medium text-[#202020] whitespace-nowrap">
                    {childrenCount || 0} Child{childrenCount !== 1 && "ren"}
                  </span>
                  {ages && ages.length > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="Livvic-Medium text-xs text-[#202020]">
                        {(() => {
                          let parsedAges = ages;
                          if (
                            Array.isArray(parsedAges) &&
                            parsedAges.length === 1 &&
                            typeof parsedAges[0] === "string" &&
                            parsedAges[0].startsWith("[")
                          ) {
                            try {
                              parsedAges = JSON.parse(parsedAges[0]);
                            } catch (e) {}
                          }
                          if (typeof parsedAges === "string") {
                            try {
                              parsedAges = JSON.parse(parsedAges);
                            } catch (e) {
                              parsedAges = parsedAges.split(",");
                            }
                          }

                          return Array.isArray(parsedAges)
                            ? parsedAges
                                .map((age) => {
                                  if (
                                    typeof age === "object" &&
                                    age !== null &&
                                    age.label
                                  )
                                    return age.label;
                                  let cleanAge = String(age)
                                    .replace(/[\[\]"]/g, "")
                                    .trim();
                                  let lower = cleanAge.toLowerCase();
                                  if (
                                    lower.includes("year") ||
                                    lower.includes("yr") ||
                                    lower.includes("month") ||
                                    lower.includes("mo")
                                  ) {
                                    return cleanAge;
                                  }
                                  const ageNum = parseFloat(cleanAge);
                                  if (isNaN(ageNum)) return cleanAge;
                                  if (ageNum % 1 !== 0) {
                                    const months = Math.round(ageNum * 12);
                                    return `${months} month${months > 1 ? "s" : ""}`;
                                  }
                                  return `${ageNum} year${ageNum > 1 ? "s" : ""}`;
                                })
                                .join(", ")
                            : null;
                        })()}
                      </span>
                    </>
                  )}
                </p>
              )}

              {/* Experience + Ages */}
              {!hasFamily && (
                <p className="text-[13px] text-[#5D5D5D] mb-1.5 md:mb-1 leading-tight md:h-5 overflow-hidden">
                  {experience && (
                    <span className="Livvic-Medium text-[#202020] whitespace-nowrap">
                      {experience} experience
                    </span>
                  )}
                  {experience && formattedAges && (
                    <span className="mx-2">•</span>
                  )}
                  {formattedAges && (
                    <span className="Livvic-Medium text-xs text-[#202020]">
                      {formattedAges}
                    </span>
                  )}
                </p>
              )}

              {/* Meta items — desktop inline (md+), hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-2 gap-x-12 gap-y-0">
                {metaItems}
              </div>
            </div>
          </div>

          {/* Meta items — mobile full-width below avatar row (hidden on md+) */}
          <div className="flex flex-wrap content-start gap-x-6 gap-y-1 mt-2 md:hidden">
            {metaItems}
          </div>
        </div>

        {/* ── HORIZONTAL DIVIDER (mobile only) ── */}
        <div className="block md:hidden h-px bg-[#E9E9E9] mx-4 sm:mx-5" />

        <div
          className={`
          flex items-center ${!user.nannyProfileCompleted && user._id === userId ? "justify-center w-full" : "justify-between"} gap-2 px-4 py-3
          md:flex-col md:p-4
          md:w-[210px] lg:w-[240px] md:gap-2
          flex-shrink-0 mt-4 md:mt-0
          md:justify-center md:items-center md:relative
        `}
        >
          {/* Rating + heart — desktop only (top-right). One positioned row so
              the stars sit beside the heart instead of being absolutely placed
              on top of it. The self-profile branch keeps the same reserved
              height, so a card of your own lines up with everyone else's. */}
          {user.nannyProfileCompleted ? (
            <div className="hidden md:flex items-center gap-2 h-8 md:absolute md:top-4 md:right-4">
              <CardRating
                averageRating={averageRating}
                totalRatings={totalRatings}
              />
              {user._id !== userId && (
                <button
                  onClick={favourite}
                  aria-label={
                    isFavorited ? "Remove from favourites" : "Add to favourites"
                  }
                  className="bg-transparent border-none cursor-pointer p-1"
                >
                  <Heart
                    className={
                      isFavorited
                        ? "text-red-500 fill-red-500"
                        : "text-[#9CA3AF]"
                    }
                  />
                </button>
              )}
            </div>
          ) : null}

          {/* View Details */}
          {user.nannyProfileCompleted ? (
            user._id === userId ? (
              <button
                onClick={() => navigate(`/dashboard/edit`)}
                className="
            flex items-center md:justify-center gap-1 bg-transparent border-none cursor-pointer
            text-primary Livvic-SemiBold text-[13px] whitespace-nowrap md:mb-2
          "
              >
                Edit profile
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => navigate(`/dashboard/nanny-profile-view/${id}`)}
                className="
            flex items-center md:justify-center gap-1 bg-transparent border-none cursor-pointer
            text-primary Livvic-SemiBold text-[13px] whitespace-nowrap md:mb-2
          "
              >
                View Details
                <ChevronRight size={14} />
              </button>
            )
          ) : null}

          {/* Request Match */}
          <div className="md:w-full">
            <ButtonAreaText />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Helper: initials from a name (fills the avatar box when no image) ── */
const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/* formatScheduleDays now lives in Config/scheduleFormat.js so the public
   shared-profile card renders the same "Mon–Fri" as these cards do. */

function formatJobTitle(jobType) {
  if (!jobType) return "Nanny Share Needed";

  const withSpaces = jobType.replace(/([a-z])([A-Z])/g, "$1 $2");
  const capitalized = withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${capitalized} Needed`;
}

export default function ProfileCard({
  nanny,
  img,
  time,
  name,
  intro,
  loc,
  hr,
  exp,
  rate,
  zipCode,
  averageRating,
  totalRatings,
}) {
  const formatLocation = () => {
    if (!zipCode || !loc?.format_location) return loc;
    const parts = loc.format_location.split(",") || [];
    const city = parts.at(-3)?.trim();
    const state = parts.at(-2)?.trim().split(" ")[0];
    return city && state ? `${city}, ${state}` : "";
  };
  return (
    <div className="p-6 border rounded-[20px] border-[#EEEEEE] bg-white space-y-2 h-[311px] w-[330px]">
      <div className="flex justify-between gap-4">
        {img ? (
          <img
            className="bg-black rounded-full w-20 h-20 object-cover"
            src={img}
            alt="img"
          />
        ) : (
          <Avatar
            className="rounded-full text-black"
            size="80"
            color={"#AEC4FF"}
            name={name
              ?.split(" ") // Split by space
              .slice(0, 2) // Take first 1–2 words
              .join(" ")}
          />
        )}
        <div className="flex flex-col items-end gap-2">
          <div className="py-2 px-4 bg-[#ECF1FF] text-primary rounded-full w-fit Livvic-SemiBold text-xs">
            {time}
          </div>
          <div className="flex gap-2">
            {totalRatings > 0 && (
              <>
                <Ra points={averageRating} size={20} />{" "}
                <span className="Livvic-SemiBold text-[#555555] text-sm">
                  {totalRatings}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="Livvic-SemiBold text-lg flex gap-2 mt-2">
        {name} <img src="/shield.svg" alt="" />
      </p>
      <p className="Livvic-Medium text-sm text-[#555555]">{formatLocation()}</p>
      <p className="Livvic-Medium text-sm text-[#555555]">
        {exp && exp !== "N/A" && exp !== "0" && `${exp} of experience`}
      </p>
      <p className="text-sm text-[#777777]">
        {intro.length > 150 ? `${intro.substring(0, 150)}...` : intro}
      </p>
    </div>
    // <div
    //   className={`flex flex-col justify-between shadow-custom-shadow border-[#D6DDEB] w-full min-h-96 bg-white p-4 rounded-2xl Quicksand`}
    // >
    //   <div className="max-lg:w-full">
    //     <div className="flex justify-between">
    //       {img ? (
    //         <img
    //           className="bg-black rounded-full w-20 h-20 object-contain"
    //           src={img}
    //           alt="img"
    //         />
    //       ) : (
    //         <Avatar
    //           className="rounded-full text-black"
    //           size="80"
    //           color={"#AEC4FF"}
    //           name={name
    //             ?.split(" ") // Split by space
    //             .slice(0, 2) // Take first 1–2 words
    //             .join(" ")}
    //         />
    //       )}

    //       <div>
    //         {time && (
    //           <p
    //             style={{ background: "#E7F6FD" }}
    //             className="px-2 py-1 rounded-lg text-sm"
    //           >
    //             {time}
    //           </p>
    //         )}
    //       </div>
    //     </div>
    //     <p className="my-2 Livvic-Bold text-2xl">{name}</p>
    //   </div>

    //   <p className="Livvic-Medium flex-1">
    //     {intro.length > 400 ? `${intro.substring(0, 400)}...` : intro}
    //   </p>

    //   <div>
    //     {loc && (
    //       <p className="my-2 Livvic-SemiBold text-lg">{loc?.format_location}</p>
    //     )}
    //     {/* {zipCode && <p className="my-2 Livvic-SemiBold text-lg">{zipCode}</p>} */}

    //     <div className="flex justify-between items-center">
    //       {!nanny ? (
    //         <p>
    //           {hr && (
    //             <span className="Livvic-SemiBold">
    //               {hr}hr <span className="font-normal">with kids | </span>
    //             </span>
    //           )}
    //           <span className="Livvic-SemiBold">{exp}</span> experience
    //         </p>
    //       ) : (
    //         <p>
    //           <span className="Livvic-SemiBold">
    //             {hr} <span className="font-normal">kids</span>
    //           </span>
    //         </p>
    //       )}
    //       {rate && (
    //         <div
    //           style={{ background: "#FBF5DE" }}
    //           className="flex gap-x-1 px-2 rounded-xl"
    //         >
    //           <p>{rate}</p>
    //           <img className="object-contain" src={star} alt="star" />
    //         </div>
    //       )}
    //     </div>
    //   </div>
    // </div>
  );
}

export function ProfileCard1({
  id,
  nanny,
  img,
  name,
  intro,
  loc,
  hr,
  time,
  rate,
  imageNot,
  jobType,
  zipCode,
  created,
  fav,
  nannyShareView,
}) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { isFavorited, toggleFavourite: favourite } = useFavourite(id);
  const formatLocation = () => {
    if (!zipCode || !loc?.format_location) return "";
    const parts = loc.format_location.split(",") || [];
    const city = parts.at(-3)?.trim();
    const state = parts.at(-2)?.trim().split(" ")[0];
    return city && state ? `${city}, ${state}` : "";
  };
  return (
    <NavLink
      to={
        nannyShareView
          ? `/dashboard/nannyShareView/${id}`
          : `/dashboard/description/${id}`
      }
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <div className="onboarding-box">
        <div className="flex justify-between">
          <h1 className="onboarding-subHead">{formatJobTitle(jobType)}</h1>
          <div className="flex gap-2 items-center">
            {time && (
              <p
                style={{ background: "#E7F6FD" }}
                className="Livvic-SemiBold text-primary bg-primary px-4 py-2 rounded-full text-sm"
              >
                {time}
              </p>
            )}
            <div
              className="p-2 h-9 flex justify-center items-center w-9 rounded-full bg-[#F6F3EE]"
              onClick={(e) => {
                e.stopPropagation(); // ← prevent bubbling to NavLink
                e.preventDefault(); // ← prevent navigation if inside a <NavLink>
                favourite();
              }}
            >
              {isFavorited ? (
                <HeartFilled className="text-tertiary" />
              ) : (
                <Heart className="text-tertiary" height={20} width={20} />
              )}
            </div>
          </div>
        </div>
        <p className="Livvic text-md text-secondary mt-4">
          {intro.length > 300 ? `${intro.substring(0, 300)}...` : intro}
        </p>
        <p className="onboarding-form-label mt-4 flex flex-wrap items-center gap-x-2 text-[#555555]">
          <span className=" flex items-center gap-1">
            <span className="Livvic-Medium items-center text-sm text-[#222222] flex gap-4">
              {img ? (
                <img
                  className="bg-black mx-auto rounded-full w-6 h-6 object-cover"
                  src={img}
                  alt="img"
                />
              ) : (
                <Avatar
                  className="rounded-full text-black"
                  size="24"
                  color={"#AEC4FF"}
                  name={name
                    ?.split(" ") // Split by space
                    .slice(0, 2) // Take first 1–2 words
                    .join(" ")}
                />
              )}
            </span>
            <span className="underline onboarding-form-label">{name}</span>
          </span>
          <span className="onboarding-form-label">|</span>
          <span className="onboarding-form-label">{hr} kids</span>
          <span className="onboarding-form-label">|</span>
          <span className="onboarding-form-label">{formatLocation()}</span>
          <span className="onboarding-form-label">|</span>
          <span className="onboarding-form-label">
            {formatCreatedAt(created)}
          </span>
        </p>
      </div>
    </NavLink>
  );
}

// export const NannyProfile = ({
//   type,
//   goal,
//   name,
//   id,
//   sharedRate,
//   rateType,
//   location,
//   bio,
//   experience,
//   distance,
//   roles,
//   img,
//   created,
// }) => {
//   const { user, accessToken } = useSelector((state) => state.auth);
//   const [isFavorited, setIsFavorited] = useState(user.favourite?.includes(id));
//   const dispatch = useDispatch();
//   const favourite = () => {
//     dispatch(
//       addOrRemoveFavouriteThunk({ favouriteUserId: id, accessToken })
//     );
//     dispatch(refreshTokenThunk());
//     setIsFavorited((prev) => !prev)
//   };
//   return (
//       <div className="onboarding-box w-full max-w-[700px] h-auto">
//         <div className="flex flex-col sm:flex-row gap-4">
//           {img ? (
//             <img
//               className="bg-black w-full sm:w-[200px] md:w-[250px] h-[200px] sm:h-[280px] md:h-[340px] object-cover rounded-2xl flex-shrink-0"
//               src={img}
//               alt="img"
//             />
//           ) : (
//             <div className="flex-shrink-0 flex justify-center sm:justify-start">
//               <Avatar
//                 className="rounded-full text-black"
//                 size="24"
//                 color={"#AEC4FF"}
//                 name={name
//                   ?.split(" ")
//                   .slice(0, 2)
//                   .join(" ")}
//               />
//             </div>
//           )}

//           <div className="w-full min-w-0">
//             <div className="flex justify-between w-full mb-0 sm:mb-2">
//               <div className="flex gap-2 items-center flex-wrap">
//                 <div className="rounded-full py-1 px-4 bg-[#FAF5FF] text-[#F06292] flex gap-2">
//                   <span className="text-md Livvic-Medium ">{type}</span> <span className="text-md Livvic-Medium ">●</span> <span className="text-md Livvic-Medium ">{goal}</span>
//                 </div>
//               </div>
//               <div
//                 className="p-2 flex justify-center items-center rounded-full flex-shrink-0 ml-2"
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   e.preventDefault();
//                   favourite();
//                 }}
//               >
//                 {isFavorited ? (
//                   <HeartFilled className="text-red-500 cursor-pointer" style={{ fontSize: '30px' }} />
//                 ) : (
//                   <Heart className="text-secondary cursor-pointer" height={30} width={30} />
//                 )}
//               </div>
//             </div>

//             <p className="Livvic-Bold text-xl md:text-2xl leading-loose truncate">{name}</p>
//             <p className="Livvic text-base md:text-lg text-gray-400 line-clamp-2 sm:line-clamp-1">
//               {bio?.substring(0, 40)}...
//             </p>

//             <div className="flex flex-wrap gap-4 my-3">
//               <div className="flex gap-2 items-center text-gray-500">
//                 <Briefcase size={20} />
//                 <p className=" Livvic-Medium text-sm md:text-base">{experience}</p>
//               </div>
//               <div className="flex gap-1 items-center text-gray-500">
//                 <MapPin size={20} />
//                 <p className=" Livvic-Medium text-sm md:text-base">{location.neighborhood ?? distance}</p>
//               </div>
//               <div className="flex gap-1 items-center text-gray-500">
//                 <DollarSign size={20} />
//                 <p className=" Livvic-Medium text-sm md:text-base">${sharedRate}/{rateType === "hourly" ? "hr" : "wk"}</p>
//               </div>
//             </div>

//             <hr />

//             <div className="mt-2 mb-4">
//               <p className="Livvic-SemiBold text-gray-700 mb-2 text-sm md:text-base">Expertise</p>
//               <div className="flex flex-wrap gap-2">
//                 {roles.length > 0 &&
//                   roles.map((role, i) => (
//                     <div
//                       key={i}
//                       className="px-3 py-1 Livvic-Medium bg-[#FAF5FF] text-[#F06292] rounded-full text-xs md:text-sm"
//                     >
//                       {role}
//                     </div>
//                   ))}
//               </div>
//             </div>
//           </div>
//         </div>
//         <div className="flex gap-4 justify-center mt-4">
//           <CustomButton btnText={"View Profile"} className="border border-gray-300 w-1/2 !rounded-lg !py-3" />
//           <CustomButton btnText={<div className="flex justify-center gap-2 items-center">
//             <LockKeyhole size={20} className="text-white" />
//             <p className="Livvic-Medium text-white">Request Match</p>
//           </div>} className="bg-[#3AAAE4] w-1/2 !rounded-lg !py-3" />
//         </div>
//       </div>
//   );
// }
