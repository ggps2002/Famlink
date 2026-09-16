import { HttpService } from "@shared/api/HttpService";

/**
 * The six paginated lists behind the bookings screens — one per state a request
 * can be in.
 *
 * They exist separately because each has its own slice and its own pagination,
 * so a member paging through "completed" does not disturb "upcoming". The
 * endpoints differ only in their path, which is the whole reason to collect them
 * here rather than leave the strings scattered across six slices.
 */
export class BookingListService extends HttpService {
  #page(path, { limit, page }) {
    return this.get(`${path}/?limit=${limit}&page=${page}`);
  }

  requested(paging) {
    return this.#page("/book-hire/requested-data", paging);
  }

  pending(paging) {
    return this.#page("/book-hire/getPendingRequests", paging);
  }

  accepted(paging) {
    return this.#page("/book-hire/accepted-bookings-request", paging);
  }

  completed(paging) {
    return this.#page("/book-hire/completed-bookings-request", paging);
  }

  rejected(paging) {
    return this.#page("/book-hire/rejected-bookings-request", paging);
  }

  withdrawn(paging) {
    return this.#page("/book-hire/get-withdraw-requests", paging);
  }
}

export const bookingListService = new BookingListService();
export default bookingListService;
