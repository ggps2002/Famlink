import { HttpService } from "@shared/api/HttpService";

/**
 * A booking's whole lifecycle. Every transition after the initial request is a
 * PUT keyed by booking id, which is why they read so alike.
 *
 * `status` takes already-built URLSearchParams from the caller, since the filter
 * it encodes is assembled from optional form fields.
 */
export class BookHireService extends HttpService {
  request(body) {
    return this.post("/book-hire/request", body);
  }

  status(params) {
    return this.get(`/book-hire/status?${params.toString()}`);
  }

  /**
   * The six transitions. All send an empty body — the id in the path is the
   * whole request.
   *
   * `withdraw` and `reconsider` used to read
   * `api.put(url, { headers: { Authorization: … } })`, and axios is
   * put(url, data, config), so their config object went out as the request body
   * with the access token inside it. Their four siblings passed `{}` first and
   * were correct. Nothing broke, because the interceptor sets the real header
   * either way — the only symptom was a token in a place it had no reason to be.
   */
  #transition(action, bookingId) {
    return this.put(`/book-hire/${action}/${bookingId}`, {});
  }

  withdraw(bookingId) {
    return this.#transition("withdraw", bookingId);
  }

  reconsider(bookingId) {
    return this.#transition("reconsider-booking", bookingId);
  }

  reject(bookingId) {
    return this.#transition("reject-request", bookingId);
  }

  accept(bookingId) {
    return this.#transition("accept-request", bookingId);
  }

  cancel(bookingId) {
    return this.#transition("cancel-booking", bookingId);
  }

  complete(bookingId) {
    return this.#transition("complete-booking", bookingId);
  }
}

export const bookHireService = new BookHireService();
export default bookHireService;
