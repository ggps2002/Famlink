import { BaseRepository } from "../../core/database/BaseRepository.js";
import Booking from "./booking.model.js";

/**
 * Bookings — the paid engagements between a family and a caregiver.
 *
 * The `/book-hire` routes that create and manage these are deliberately out of
 * scope for the module restructure and still live on the legacy router. This
 * repository exists for the admin console's reads only, which is why it holds
 * reporting queries rather than a full lifecycle.
 */
export class BookingRepository extends BaseRepository {
  constructor(model = Booking) {
    super(model);
  }

  /** One page of completed bookings, with the family attached. */
  async findCompletedPage({ skip, limit }) {
    const filter = { status: "completed" };

    const [bookings, totalRecords] = await Promise.all([
      this.find(filter, {
        populate: { path: "familyId", select: "name email imageUrl zipCode additionalInfo" },
        skip,
        limit,
        // By _id rather than createdAt: these predate timestamps being reliable
        // on this collection, and a descending _id is the same ordering.
        sort: { _id: -1 },
      }),
      this.count(filter),
    ]);

    return { bookings, totalRecords };
  }

  findCompleted() {
    return this.find({ status: "completed" });
  }

  /** The oldest booking, for "since the beginning" reporting windows. */
  earliest() {
    return this.findOne({}, { sort: { createdAt: 1 }, select: "createdAt", lean: true });
  }

  countSince(since, extra = {}) {
    return this.count({ createdAt: { $gte: since }, ...extra });
  }

  /** Total paid across completed bookings since a date. */
  async earningsSince(since) {
    const [summary] = await this.aggregate([
      { $match: { status: "completed", createdAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: "$totalPayment" } } },
    ]);

    return summary?.total || 0;
  }

  /** Day-by-day counts and earnings, for the dashboard chart. */
  dailyStatsSince(since) {
    return this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
          totalApplications: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          earnings: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$totalPayment", 0] },
          },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);
  }

  /**
   * The five most recent live bookings, with both parties joined in.
   *
   * `preserveNullAndEmptyArrays: false` on both unwinds is doing real work: a
   * booking whose family or caregiver has since been deleted is dropped rather
   * than rendered as a row with a blank name.
   */
  recentWithParties(limit = 5) {
    return this.aggregate([
      { $match: { status: { $ne: "rejected" } } },
      {
        $lookup: {
          from: "users",
          localField: "familyId",
          foreignField: "_id",
          as: "familyInfo",
        },
      },
      { $unwind: { path: "$familyInfo", preserveNullAndEmptyArrays: false } },
      { $match: { "familyInfo.type": "Parents" } },
      {
        $lookup: {
          from: "users",
          localField: "nannyId",
          foreignField: "_id",
          as: "nannyInfo",
        },
      },
      { $unwind: { path: "$nannyInfo", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 1,
          nannyId: 1,
          familyId: 1,
          status: 1,
          totalPayment: 1,
          createdAt: 1,
          startAt: 1,
          completedAt: 1,
          // Named field by field: the joined documents are whole user records,
          // and projecting them wholesale would put a password hash and a home
          // address on the dashboard.
          familyInfo: { email: 1, name: 1, imageUrl: 1, location: 1, age: 1 },
          nannyInfo: { email: 1, name: 1, imageUrl: 1, location: 1, age: 1, experience: 1 },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);
  }
}

export const bookingRepository = new BookingRepository();

export default bookingRepository;
