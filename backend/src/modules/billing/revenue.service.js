import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError } from "../../core/errors/index.js";

/**
 * Revenue reporting for the console.
 *
 * Amounts are in the smallest currency unit, as Stripe stores them — cents, not
 * dollars. Nothing here divides by 100; the console does, and doing it in two
 * places is how a figure ends up a hundred times too small.
 */
export class RevenueService extends BaseService {
  async #requireAdmin(userId, message) {
    const user = await this.userRepository.findById(userId, { select: "type", lean: true });
    if (!user || user.type !== "Admin") throw new ForbiddenError(message);
  }

  /** Total taken since the first of the current month. */
  async currentMonthTotal({ adminId, now = new Date() }) {
    await this.#requireAdmin(adminId, "Access denied.");

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [summary] = await this.revenueRepository.aggregate([
      { $match: { paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return summary?.total || 0;
  }

  /**
   * Month-by-month revenue for the year to date, for the console's chart.
   *
   * Every month up to the current one is present even when it took nothing —
   * a chart that omits empty months draws a line straight from March to May and
   * hides the fact that April was zero.
   */
  async monthlyBreakdown({ adminId, now = new Date() }) {
    await this.#requireAdmin(adminId, "Access denied");

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const byMonth = await this.revenueRepository.aggregate([
      { $match: { paidAt: { $gte: startOfYear } } },
      { $group: { _id: { $month: "$paidAt" }, total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]);

    const result = [];
    let previous = 0;

    for (let index = 0; index <= now.getMonth(); index += 1) {
      // $month is 1-based; the loop is 0-based, like Date.
      const found = byMonth.find((row) => row._id === index + 1);
      const revenue = found ? found.total : 0;

      result.push({
        name: new Date(0, index).toLocaleString("default", { month: "short" }),
        revenue,
        // Change against the previous month, not a percentage. January has no
        // predecessor in this window, so it reports 0 rather than its own total.
        growth: index === 0 ? 0 : revenue - previous,
      });

      previous = revenue;
    }

    return result;
  }
}

export default RevenueService;
