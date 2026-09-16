import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";

/**
 * ISO-8601 week number.
 *
 * Weeks belong to the year containing their Thursday, which is why the anchor
 * is January 4th — the earliest date that is always in week 1. Matching
 * MongoDB's `$week` matters here: the weekly signup chart pairs numbers this
 * function produces with numbers the aggregation produced, and a mismatch shows
 * as a week of zeroes rather than as an error.
 */
export const isoWeekNumber = (value) => {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayOfWeek = new Date(
    firstThursday.getFullYear(),
    firstThursday.getMonth(),
    firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7)
  );

  return Math.ceil(((date - firstDayOfWeek) / 86_400_000 + 1) / 7);
};

/** Percentage change, with the two edge cases spelled out. */
export const percentageChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/** How far back each dashboard filter looks. */
const WINDOW = {
  "1M": (now) => new Date(new Date(now).setMonth(now.getMonth() - 1)),
  "6M": (now) => new Date(new Date(now).setMonth(now.getMonth() - 6)),
  "1Y": (now) => new Date(new Date(now).setFullYear(now.getFullYear() - 1)),
};

/**
 * The admin dashboard's reporting.
 *
 * Read-only throughout. The admin gate is applied by the router, so nothing
 * here re-checks it — see adminUser.module.js.
 */
export class AdminDashboardService extends BaseService {
  /**
   * Booking volume and earnings over a window, plus a daily series.
   *
   * With no filter the window starts at the first booking ever recorded, so the
   * default view is "everything" rather than an arbitrary recent slice.
   */
  async bookingStats({ filter, now = new Date() }) {
    let startDate;

    if (WINDOW[filter]) {
      startDate = WINDOW[filter](now);
    } else {
      const first = await this.bookingRepository.earliest();
      if (!first) throw new NotFoundError("No applications found.");
      startDate = first.createdAt;
    }

    const [totalApplications, totalRejected, totalCompleted, totalEarnings, graphData] =
      await Promise.all([
        this.bookingRepository.countSince(startDate),
        this.bookingRepository.countSince(startDate, { status: "rejected" }),
        this.bookingRepository.countSince(startDate, { status: "completed" }),
        this.bookingRepository.earningsSince(startDate),
        this.bookingRepository.dailyStatsSince(startDate),
      ]);

    return {
      startDate,
      totalApplications,
      totalRejected,
      totalCompleted,
      totalEarnings,
      graphData,
    };
  }

  /** One page of completed bookings for the console's table. */
  async completedBookings({ page = 1, limit = 10 }) {
    const { bookings, totalRecords } = await this.bookingRepository.findCompletedPage({
      skip: (page - 1) * limit,
      limit,
    });

    return {
      data: bookings,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    };
  }

  recentBookings() {
    return this.bookingRepository.recentWithParties(5);
  }

  /**
   * Signups per week over the last month, by member type.
   *
   * Weeks with no signups are filled in with zeroes rather than omitted, so the
   * chart shows a flat week instead of joining the two weeks either side of it.
   */
  async userStats({ now = new Date() } = {}) {
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const [weekly, totals, previousTotals] = await Promise.all([
      this.userRepository.weeklySignups({ from: oneMonthAgo, to: now }),
      this.userRepository.countsByType(),
      this.userRepository.countsByTypeBefore(oneMonthAgo),
    ]);

    const countOf = (rows) =>
      rows.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {});

    const totalCounts = countOf(totals);
    const previousCounts = countOf(previousTotals);

    const weeks = [];
    for (
      const cursor = new Date(oneMonthAgo);
      cursor <= now;
      cursor.setDate(cursor.getDate() + 7)
    ) {
      const startOfWeek = new Date(cursor);
      const endOfWeek = new Date(cursor);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const at = (type) =>
        weekly.find(
          (stat) =>
            stat.week === isoWeekNumber(startOfWeek) &&
            stat.year === startOfWeek.getFullYear() &&
            stat.type === type
        )?.count ?? 0;

      weeks.push({ startOfWeek, endOfWeek, Nanny: at("Nanny"), Parents: at("Parents") });
    }

    return {
      totalCounts,
      percentageChanges: ["Nanny", "Parents"].map((type) => ({
        type,
        percentageChange: parseFloat(
          percentageChange(totalCounts[type] || 0, previousCounts[type] || 0).toFixed(2)
        ),
      })),
      weeklyStats: weeks.map((week, index) => {
        if (index === 0) return { ...week, NannyPercentage: 0, ParentsPercentage: 0 };

        const previous = weeks[index - 1];
        return {
          ...week,
          NannyPercentage: parseFloat(percentageChange(week.Nanny, previous.Nanny).toFixed(2)),
          ParentsPercentage: parseFloat(
            percentageChange(week.Parents, previous.Parents).toFixed(2)
          ),
        };
      }),
    };
  }

  /**
   * Total and weekly earnings from completed bookings.
   *
   * `percentageChanges` compares the current week against the ALL-TIME total,
   * not against the previous week — so on a healthy platform it is always a
   * large negative number. That is what this endpoint has always returned and
   * what the dashboard renders; changing it would silently move a figure
   * somebody may be reading. Flagged rather than fixed.
   */
  async earningStats({ now = new Date() } = {}) {
    const completed = await this.bookingRepository.findCompleted();
    const totalEarning = completed.reduce(
      (sum, booking) => sum + (booking.totalPayment || 0),
      0
    );

    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    // Back up to that week's Sunday, matching moment's default week start.
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const weeklyEarnings = [];
    for (const cursor = new Date(start); cursor < now; cursor.setDate(cursor.getDate() + 7)) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const earnings = completed
        .filter((booking) => {
          if (!booking.completedAt) return false;
          const at = new Date(booking.completedAt);
          return at >= weekStart && at < weekEnd;
        })
        .reduce((sum, booking) => sum + (booking.totalPayment || 0), 0);

      weeklyEarnings.push({ week: weekStart.toISOString().slice(0, 10), earnings });
    }

    const currentWeek = weeklyEarnings[weeklyEarnings.length - 1]?.earnings || 0;

    return {
      totalEarning,
      weeklyEarnings,
      percentageChanges:
        totalEarning === 0
          ? currentWeek > 0
            ? 100
            : 0
          : ((currentWeek - totalEarning) / totalEarning) * 100,
    };
  }

  /** Every caregiver's pin, plus the three commonest areas. */
  async nannyLocations() {
    const nannies = await this.userRepository.find(
      { type: "Nanny" },
      { select: "name location email age gender imageUrl", lean: true }
    );

    return {
      nannies,
      topLocations: await this.userRepository.topLocations("Nanny", nannies.length),
    };
  }

  /** Best-rated members of one type, paginated. */
  async topUsers({ type, sort, page = 1, limit = 5 }) {
    if (!type || !["Nanny", "Parents"].includes(type)) {
      throw new ValidationError("Invalid or missing type filter.");
    }

    const { users, totalRecords } = await this.userRepository.rankedByReviews({
      type,
      sortBy: sort === "reviews" ? "totalReviews" : "avgRating",
      skip: (page - 1) * limit,
      limit,
    });

    return {
      users,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    };
  }

  /**
   * The console's messaging sidebar: every member, with a conversation attached
   * where one exists.
   *
   * Members without a chat are included so an admin can start one, which is why
   * this is a full user list joined against the admin's chats rather than a
   * chat list.
   */
  async chatDirectory({ adminId, exclude = [] }) {
    const [users, chats] = await Promise.all([
      this.userRepository.find(
        { _id: { $ne: adminId, $nin: exclude } },
        { select: "email name imageUrl type _id", lean: true }
      ),
      this.chatRepository.find(
        { participants: adminId },
        {
          populate: { path: "participants", select: "email name imageUrl type _id" },
          sort: { updatedAt: -1 },
        }
      ),
    ]);

    const byCounterparty = new Map();
    for (const chat of chats) {
      const other = chat.participants.find(
        (participant) => participant._id.toString() !== String(adminId)
      );
      if (!other) continue;

      byCounterparty.set(other._id.toString(), {
        _id: chat._id,
        lastMessage: chat.lastMessage,
        otherParticipant: other,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        type: chat.type,
      });
    }

    return users
      .map(
        (user) =>
          byCounterparty.get(user._id.toString()) ?? {
            otherParticipant: user,
            lastMessage: null,
            createdAt: null,
            updatedAt: null,
            type: null,
          }
      )
      // Most recently active first; everyone with no conversation sorts to the
      // bottom together, since a null date becomes 0.
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }
}

export default AdminDashboardService;
