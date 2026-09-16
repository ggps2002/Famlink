import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, Copy, Gift, Loader2, Share2, Users } from "lucide-react";
import {
  getMyReferralThunk,
  getReferredFriendsThunk,
} from "@features/referral/store/referralSlice";
import { fireToastMessage } from "@shared/ui/toast";

/* Settings → Refer a Friend. Caregivers looking for a share position don't
   subscribe — every friend who signs up with their link buys them a month of
   matching. This is the standing home for that link, as opposed to
   ReferAFriendModal which is the same offer shown at the moment they're
   blocked. Families and nannies who already have a family see Subscription
   instead; the settings sidebar picks between the two. */

const SHARE_TEXT =
  "I'm using FamLink to find a nanny share — join with my link and we both get matched faster:";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

export default function ReferAFriendSettings() {
  const dispatch = useDispatch();
  const {
    code,
    link,
    referralCount,
    matchingUntil,
    hasActiveMatching,
    daysLeft,
    friends,
    isLoading,
  } = useSelector((s) => s.referral);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dispatch(getMyReferralThunk());
    dispatch(getReferredFriendsThunk());
  }, [dispatch]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      fireToastMessage({
        type: "error",
        message: "Couldn't copy — select the link and copy it manually",
      });
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    try {
      await navigator.share({ title: "Join me on FamLink", text: SHARE_TEXT, url: link });
    } catch {
      /* dismissed */
    }
  };

  if (isLoading && !code) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">Loading your referral link…</span>
      </div>
    );
  }

  const untilLabel = formatDate(matchingUntil);

  return (
    <div className="space-y-6">
      {/* Status */}
      <div
        className={`rounded-2xl p-6 ${
          hasActiveMatching
            ? "bg-[#F0FBE2] border border-[#D6FB9A]"
            : "bg-[#F5F5F5] border border-gray-200"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <Gift className="text-[#075B49]" size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg Livvic-SemiBold text-primary mb-1">
              {hasActiveMatching ? "Free matching is active" : "Refer a friend to start matching"}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {hasActiveMatching && untilLabel ? (
                <>
                  You can match until{" "}
                  <span className="Livvic-SemiBold text-gray-800">{untilLabel}</span>
                  {daysLeft > 0 && ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)`}.
                  Refer another friend any time to add a month.
                </>
              ) : (
                <>
                  Caregivers never pay on FamLink. When a friend joins with your
                  link and sets up their profile, you get a full month of
                  unlimited matching — refer one a month and it never runs out.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Share link */}
      <div>
        <label className="block text-sm Livvic-SemiBold text-gray-700 mb-2">
          Your referral link
        </label>
        <div className="flex items-center gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
          <span className="flex-1 text-sm text-gray-600 truncate" title={link || ""}>
            {link || "Link unavailable"}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!link}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1.5 text-xs Livvic-SemiBold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        {code && (
          <p className="mt-2 text-xs text-gray-400">
            Or share your code{" "}
            <span className="Livvic-SemiBold text-gray-600 tracking-wide">{code}</span>
          </p>
        )}

        {canShare && link && (
          <button
            type="button"
            onClick={handleShare}
            className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 bg-[#D6FB9A] rounded-full px-8 py-3 text-base Livvic-Bold text-[#075B49]"
          >
            <Share2 size={16} />
            Share Your Link
          </button>
        )}
      </div>

      {/* Friends who joined */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-500" />
          <h4 className="text-sm Livvic-SemiBold text-gray-700">
            Friends who joined ({referralCount})
          </h4>
        </div>

        {friends.length === 0 ? (
          <p className="text-sm text-gray-400 leading-relaxed">
            No one yet. Share your link with another caregiver — you'll see them
            here, and your free month starts once they've set up their profile.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
            {friends.map((friend) => (
              <li key={friend._id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm Livvic-SemiBold shrink-0 overflow-hidden ${
                    friend.credited
                      ? "bg-[#F0FBE2] text-[#075B49]"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {friend.imageUrl ? (
                    <img
                      src={friend.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (friend.name || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {friend.name || "A friend"}
                  </p>
                  {/* Only a completed profile pays out, so a pending friend is
                      shown as pending rather than counted as a win. */}
                  {!friend.credited && (
                    <p className="text-xs text-gray-400">
                      Setting up their profile — no month yet
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs shrink-0 ${
                    friend.credited ? "text-[#075B49]" : "text-gray-400"
                  }`}
                >
                  {friend.credited ? "+1 month" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
