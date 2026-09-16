import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { ReviewService } from "#src/modules/review/review.service.js";
import * as templates from "#src/modules/review/review.templates.js";
import { ForbiddenError, NotFoundError, ValidationError } from "#src/core/errors/index.js";

const NANNY_ID = new mongoose.Types.ObjectId();
const FAMILY_ID = new mongoose.Types.ObjectId();
const BOOKING_ID = new mongoose.Types.ObjectId();

const aBooking = (over = {}) => ({
  _id: BOOKING_ID,
  status: "completed",
  nannyReview: false,
  familyReview: false,
  requestBy: { _id: NANNY_ID },
  jobId: { user: { _id: FAMILY_ID } },
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const aUser = (over = {}) => ({
  _id: FAMILY_ID,
  email: "target@example.com",
  name: "Target",
  type: "Parents",
  reviews: [],
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const build = (over = {}) => {
  const deps = {
    bookingRepository: {
      findById: vi.fn().mockResolvedValue(aBooking()),
      ...over.bookingRepository,
    },
    userRepository: {
      findById: vi.fn().mockResolvedValue(aUser()),
      ...over.userRepository,
    },
    matchRepository: {
      findBetween: vi.fn().mockResolvedValue({ status: "accepted" }),
      ...over.matchRepository,
    },
    emailService: { sendEmail: vi.fn() },
    templates,
  };

  return { service: new ReviewService(deps), deps };
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ReviewService.submit", () => {
  const submitAsNanny = (over = {}) => ({
    userId: NANNY_ID,
    bookingId: String(BOOKING_ID),
    rating: 5,
    msg: "Great",
    userType: "nanny",
    ...over,
  });

  it("404s an unknown booking", async () => {
    const { service } = build({ bookingRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.submit(submitAsNanny())).rejects.toThrow(NotFoundError);
  });

  it("refuses someone who is not a participant", async () => {
    const stranger = new mongoose.Types.ObjectId();
    const { service } = build();

    await expect(service.submit(submitAsNanny({ userId: stranger }))).rejects.toThrow(
      ForbiddenError
    );
  });

  it("refuses a family reviewing through the nanny path", async () => {
    // Each side may only submit on its own side of the booking.
    const { service } = build();

    await expect(service.submit(submitAsNanny({ userId: FAMILY_ID }))).rejects.toThrow(
      "Unauthorized to submit review for this booking"
    );
  });

  it("rejects an unrecognised user type", async () => {
    const { service } = build();

    await expect(service.submit(submitAsNanny({ userType: "admin" }))).rejects.toThrow(
      "Invalid user type"
    );
  });

  it("refuses a review on a booking that is not complete", async () => {
    const { service } = build({
      bookingRepository: { findById: vi.fn().mockResolvedValue(aBooking({ status: "pending" })) },
    });

    await expect(service.submit(submitAsNanny())).rejects.toThrow(
      "Review can only be submitted for completed bookings"
    );
  });

  it("refuses a second review from the same side", async () => {
    const { service } = build({
      bookingRepository: { findById: vi.fn().mockResolvedValue(aBooking({ nannyReview: true })) },
    });

    await expect(service.submit(submitAsNanny())).rejects.toThrow(/already submitted/);
  });

  it("catches a duplicate even when the booking flag was never set", async () => {
    // The second of the two duplicate checks: the flag is the fast path, the
    // scan of existing reviews catches a booking whose flag was missed.
    const target = aUser({ reviews: [{ bookingId: BOOKING_ID }] });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await expect(service.submit(submitAsNanny())).rejects.toThrow(/already submitted/);
  });

  it("writes the review onto the reviewed user, newest first", async () => {
    const target = aUser({ reviews: [{ bookingId: new mongoose.Types.ObjectId() }] });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await service.submit(submitAsNanny({ rating: 4, msg: "Good" }));

    expect(target.reviews[0]).toMatchObject({ rating: 4, msg: "Good" });
    expect(target.save).toHaveBeenCalled();
  });

  it("marks the reviewer's side done on the booking", async () => {
    const booking = aBooking();
    const { service } = build({
      bookingRepository: { findById: vi.fn().mockResolvedValue(booking) },
    });

    await service.submit(submitAsNanny());

    expect(booking.nannyReview).toBe(true);
    expect(booking.familyReview).toBe(false);
    expect(booking.save).toHaveBeenCalled();
  });

  it("does not persist the side flag when a later check fails", async () => {
    // The flag is set before the completed-status check, so the booking must
    // not be saved on that path.
    const booking = aBooking({ status: "pending" });
    const { service } = build({
      bookingRepository: { findById: vi.fn().mockResolvedValue(booking) },
    });

    await expect(service.submit(submitAsNanny())).rejects.toThrow();
    expect(booking.save).not.toHaveBeenCalled();
  });

  it("still succeeds when the notification email fails", async () => {
    const { service, deps } = build();
    deps.emailService.sendEmail.mockImplementation(() => {
      throw new Error("smtp down");
    });

    await expect(service.submit(submitAsNanny())).resolves.toBeUndefined();
  });
});

describe("ReviewService.submit without a booking", () => {
  // The profile page's "Leave a review", which is offered to anyone the member
  // has matched with — see the class comment on ReviewService.
  const submitAsMatch = (over = {}) => ({
    userId: NANNY_ID,
    targetUserId: String(FAMILY_ID),
    rating: 5,
    msg: "Lovely to work with",
    ...over,
  });

  it("writes the review when the two have an accepted match", async () => {
    const target = aUser();
    const { service, deps } = build({
      userRepository: { findById: vi.fn().mockResolvedValue(target) },
    });

    await service.submit(submitAsMatch({ rating: 4, msg: "Good" }));

    expect(deps.matchRepository.findBetween).toHaveBeenCalledWith(NANNY_ID, String(FAMILY_ID));
    expect(target.reviews[0]).toMatchObject({ rating: 4, msg: "Good" });
    // No booking is involved, so the review carries no bookingId.
    expect(target.reviews[0].bookingId).toBeUndefined();
    expect(target.save).toHaveBeenCalled();
  });

  it("never reads a booking", async () => {
    const { service, deps } = build();

    await service.submit(submitAsMatch());

    expect(deps.bookingRepository.findById).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected", "blocked"])(
    "refuses a %s match",
    async (status) => {
      const { service } = build({
        matchRepository: { findBetween: vi.fn().mockResolvedValue({ status }) },
      });

      await expect(service.submit(submitAsMatch())).rejects.toThrow(ForbiddenError);
    }
  );

  it("refuses two people who have never matched", async () => {
    const { service } = build({
      matchRepository: { findBetween: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.submit(submitAsMatch())).rejects.toThrow(
      "You can only review someone you have matched with"
    );
  });

  it("requires a target when there is no booking", async () => {
    const { service } = build();

    await expect(service.submit(submitAsMatch({ targetUserId: undefined }))).rejects.toThrow(
      ValidationError
    );
  });

  it("refuses a review of yourself", async () => {
    const { service } = build();

    await expect(
      service.submit(submitAsMatch({ userId: FAMILY_ID, targetUserId: String(FAMILY_ID) }))
    ).rejects.toThrow("You cannot review yourself");
  });

  it("404s a target whose account is gone", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.submit(submitAsMatch())).rejects.toThrow(NotFoundError);
  });

  it("allows only one match review per reviewer", async () => {
    const target = aUser({ reviews: [{ userId: NANNY_ID, rating: 5 }] });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await expect(service.submit(submitAsMatch())).rejects.toThrow(
      "You have already reviewed this member"
    );
  });

  it("does not count someone else's review against this reviewer", async () => {
    const target = aUser({ reviews: [{ userId: new mongoose.Types.ObjectId(), rating: 5 }] });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await expect(service.submit(submitAsMatch())).resolves.toBeUndefined();
  });

  it("does not count this reviewer's booking reviews against them", async () => {
    // Booking reviews are per-job; the one-per-person limit is only about the
    // bookingless kind.
    const target = aUser({
      reviews: [{ userId: NANNY_ID, bookingId: BOOKING_ID, rating: 5 }],
    });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await expect(service.submit(submitAsMatch())).resolves.toBeUndefined();
    expect(target.reviews).toHaveLength(2);
  });

  it("does not trip over a bookingless review when checking a booking duplicate", async () => {
    // `r.bookingId.toString()` threw here before match reviews existed: a
    // booking review could not be written to anyone who had one.
    const target = aUser({ reviews: [{ userId: new mongoose.Types.ObjectId(), rating: 5 }] });
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(target) } });

    await expect(
      service.submit({
        userId: NANNY_ID,
        bookingId: String(BOOKING_ID),
        rating: 5,
        msg: "Great",
        userType: "nanny",
      })
    ).resolves.toBeUndefined();
  });
});

describe("ReviewService.submit validation", () => {
  it.each([0, 6, "", null, "abc"])("rejects a rating of %s", async (rating) => {
    const { service } = build();

    await expect(
      service.submit({ userId: NANNY_ID, targetUserId: String(FAMILY_ID), rating, msg: "x" })
    ).rejects.toThrow("Rating must be between 1 and 5");
  });

  it("rejects a blank message", async () => {
    const { service } = build();

    await expect(
      service.submit({ userId: NANNY_ID, targetUserId: String(FAMILY_ID), rating: 5, msg: "   " })
    ).rejects.toThrow("Review message is required");
  });
});

describe("ReviewService.listFor", () => {
  it("404s an unknown user", async () => {
    const { service } = build({ userRepository: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.listFor("nope")).rejects.toThrow(NotFoundError);
  });

  it("averages to one decimal and counts the total", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(
          aUser({ reviews: [{ rating: 5 }, { rating: 4 }, { rating: 4 }] })
        ),
      },
    });

    const result = await service.listFor(String(FAMILY_ID));

    expect(result.averageRating).toBe("4.3");
    expect(result.totalRatings).toBe(13);
  });

  it("reports 0 rather than NaN when there are no reviews", async () => {
    const { service } = build();

    await expect(service.listFor(String(FAMILY_ID))).resolves.toMatchObject({ averageRating: 0 });
  });

  it("exposes only the reviewer's name and avatar", async () => {
    // Never the rest of the reviewer's record.
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(
          aUser({
            reviews: [
              {
                rating: 5,
                msg: "Great",
                userId: { name: "Sam", imageUrl: "x.png", email: "sam@example.com" },
              },
            ],
          })
        ),
      },
    });

    const result = await service.listFor(String(FAMILY_ID));

    expect(result.reviews[0].reviewer).toEqual({ name: "Sam", imageUrl: "x.png" });
    expect(JSON.stringify(result)).not.toContain("sam@example.com");
  });

  it("falls back for a reviewer whose account is gone", async () => {
    const { service } = build({
      userRepository: {
        findById: vi.fn().mockResolvedValue(aUser({ reviews: [{ rating: 5, userId: null }] })),
      },
    });

    const result = await service.listFor(String(FAMILY_ID));

    expect(result.reviews[0].reviewer).toEqual({ name: "Unknown", imageUrl: null });
  });
});

describe("review templates", () => {
  it("sends a reviewed family to the job board and a caregiver to the hire board", () => {
    const family = templates.reviewReceived({
      reviewer: { type: "Parents", name: "A" },
      rating: 5,
      msg: "x",
    });
    const nanny = templates.reviewReceived({
      reviewer: { type: "Nanny", name: "B" },
      rating: 5,
      msg: "x",
    });

    expect(family.body).toContain("Job Board");
    expect(nanny.body).toContain("Hire Board");
  });

  it("produces nothing for an account type with no board", () => {
    expect(
      templates.reviewReceived({ reviewer: { type: "Admin", name: "C" }, rating: 5, msg: "x" })
    ).toBeNull();
  });
});
