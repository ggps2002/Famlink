import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input, Modal, Rate } from "antd";

import Ra from "@shared/ui/Rate";
import Reviews from "@features/dashboard/components/Reviews";
import { ProfileCard, SectionTitle } from "@features/dashboard/components/profileChrome";
import { fireToastMessage } from "@shared/ui/toast";
import { submitReviewThunk } from "@features/dashboard/store/reviewSlice";
import { getMatchWithUserThunk } from "@features/matching/store/matchSlice";

import CustomButton from "@shared/ui/Button";
/**
 * The Reviews panel every profile screen shows, and the rule that decides
 * whether it offers one: "Leave a review" appears only when the viewer and the
 * person whose profile this is have an ACCEPTED match.
 *
 * Written once and shared by all three profile screens (the caregiver profile
 * and the two nanny-share views) because the gate is a policy, not a layout
 * choice — the server enforces the same rule in review.service.js, and three
 * copies of it would be three chances for one to drift into offering a button
 * that then gets rejected.
 *
 * A review left here carries no bookingId: the match is what authorises it.
 *
 * Layout is the Figma panel (node 21:2055): a 124px score block, then the 5→1
 * distribution on 298x6 square tracks, with the pill and the rail arrows
 * stacked against the right edge.
 */

/** Square 6px track, #F6F3EE under #FFB73A — not the rounded antd Progress. */
const RatingBar = ({ num, pro }) => (
  <div className="flex items-center gap-[14px]">
    <span className="Livvic-SemiBold text-[14px] leading-[14px] text-black w-[9px] shrink-0">
      {num}
    </span>
    <div className="relative h-[6px] w-full max-w-[298px] bg-[#F6F3EE]">
      <div className="absolute inset-y-0 left-0 bg-[#FFB73A]" style={{ width: `${pro}%` }} />
    </div>
  </div>
);

export default function ProfileReviews({
  targetUserId,
  targetName,
  reviews,
  averageRating,
  onReviewed,
  className = "",
}) {
  const dispatch = useDispatch();
  const scrollRef = useRef(null);
  const { user } = useSelector((s) => s.auth);

  const [matchStatus, setMatchStatus] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwnProfile = String(targetUserId ?? "") === String(user?._id ?? "");

  useEffect(() => {
    if (!targetUserId || isOwnProfile) {
      setMatchStatus(null);
      return undefined;
    }
    let active = true;
    dispatch(getMatchWithUserThunk({ userId: targetUserId }))
      .unwrap()
      .then((res) => { if (active) setMatchStatus(res?.data?.status ?? null); })
      .catch(() => { if (active) setMatchStatus(null); });
    return () => { active = false; };
  }, [dispatch, targetUserId, isOwnProfile]);

  const reviewList = useMemo(() => (Array.isArray(reviews) ? reviews : []), [reviews]);
  const totalReviews = reviewList.length;

  const ratingPercentages = useMemo(() => {
    const counts = reviewList.reduce((acc, review) => {
      const score = Math.floor(review.rating);
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});
    return [5, 4, 3, 2, 1].map((num) => ({
      num,
      pro: totalReviews > 0 ? Math.round(((counts[num] || 0) / totalReviews) * 100) : 0,
    }));
  }, [reviewList, totalReviews]);

  // Only a bookingless review counts: the server allows one of those per
  // reviewer, while booking reviews are one per job and someone may hold
  // several of them for the same person.
  const alreadyReviewed = reviewList.some(
    (review) =>
      !review.bookingId &&
      String(review.userId?._id ?? review.userId ?? "") === String(user?._id ?? ""),
  );

  const canLeaveReview = matchStatus === "accepted" && !isOwnProfile && !alreadyReviewed;

  const close = () => {
    setIsOpen(false);
    setRating(0);
    setMessage("");
  };

  const submit = async () => {
    if (!rating || !message.trim()) {
      fireToastMessage({ type: "error", message: "Please add both a rating and a message" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await dispatch(
        submitReviewThunk({ targetUserId, rating, msg: message.trim() }),
      ).unwrap();
      fireToastMessage({ message: data?.message || "Review submitted" });
      close();
      onReviewed?.();
    } catch (error) {
      fireToastMessage({ type: "error", message: error?.message || "Could not submit review" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollBy = (amount) => scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });

  const reviewButton = canLeaveReview ? (
    <CustomButton
      type="button"
      onClick={() => setIsOpen(true)}
      className="h-[38px] px-[20px] rounded-[25px] bg-[#AEC4FF] hover:bg-[#C1D6FF] transition-colors border-none cursor-pointer Livvic-SemiBold text-[14px] leading-[14px] text-[#000F36] whitespace-nowrap py-0"
    >
      Leave a review
    </CustomButton>
  ) : null;

  return (
    <ProfileCard className={`px-[25px] pt-[30px] pb-[30px] ${className}`}>
      <SectionTitle>Reviews</SectionTitle>

      {totalReviews > 0 ? (
        <>
          <div className="mt-[25px] flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-[30px] lg:gap-[50px] flex-1 min-w-0">
              {/* Content-sized rather than the design's flat 124px: Figma's
                  stars sit on a 6px gap, antd's on 8px, so five 20px stars need
                  ~132px and the fifth wrapped to its own line at a fixed 124. */}
              <div className="flex flex-col gap-[14px] shrink-0 whitespace-nowrap">
                <p className="Livvic-SemiBold text-[60px] leading-[60px] text-[#001243]">
                  {averageRating}
                </p>
                <Ra points={Number(averageRating) || 0} size={20} color="#FFB73A" />
                <p className="Livvic-SemiBold text-[14px] leading-[14px] text-black">
                  {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"}
                </p>
              </div>

              <div className="flex flex-col gap-[17px] flex-1 min-w-0 pt-[6px]">
                {ratingPercentages.map(({ num, pro }) => (
                  <RatingBar key={num} num={num} pro={pro} />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start xl:items-end gap-[20px] shrink-0">
              {reviewButton}
              <div className="flex gap-[12px]">
                <button
                  type="button"
                  onClick={() => scrollBy(-351)}
                  aria-label="Previous reviews"
                  className="size-[40px] rounded-full border border-[#EEEEEE] bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50"
                >
                  <ChevronLeft className="size-[24px] text-[#001243]" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollBy(351)}
                  aria-label="More reviews"
                  className="size-[40px] rounded-full border border-[#EEEEEE] bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50"
                >
                  <ChevronRight className="size-[24px] text-[#001243]" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="mt-[20px] flex flex-nowrap gap-[16px] overflow-x-auto scroll-smooth snap-x hide-scrollbar"
          >
            {reviewList.map((review, index) => (
              <Reviews
                key={review._id || index}
                points={review?.rating}
                para={review?.msg}
                name={review?.userId?.name}
                img={review?.userId?.imageUrl}
                created={review?.createdAt}
                starColor="#FFB73A"
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-[18px] flex flex-col items-start gap-[20px]">
          <p className="Livvic-Medium text-[16px] leading-[24px] text-[#555555]">
            No reviews available
          </p>
          {reviewButton}
        </div>
      )}

      <Modal
        title={targetName ? `Review ${targetName}` : "Leave a review"}
        open={isOpen}
        onCancel={close}
        onOk={submit}
        okText="Submit review"
        confirmLoading={isSubmitting}
        okButtonProps={{ disabled: !rating || !message.trim() }}
      >
        <div className="space-y-4 py-2">
          <div>
            <p className="Livvic-SemiBold text-sm text-primary mb-1">Rating</p>
            <Rate value={rating} onChange={setRating} style={{ color: "#FFB73A" }} />
          </div>
          <div>
            <p className="Livvic-SemiBold text-sm text-primary mb-1">Your review</p>
            <Input.TextArea
              rows={4}
              maxLength={1000}
              showCount
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={`What was it like working with ${targetName || "them"}?`}
            />
          </div>
        </div>
      </Modal>
    </ProfileCard>
  );
}
