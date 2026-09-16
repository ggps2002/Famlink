/**
 * Two-axis throttle for public endpoints that mail whatever address they are
 * handed — the waitlist confirmation and the resource-download link.
 *
 * Both are unauthenticated, so each is limited per-key (a double submit or a
 * retry must not send a second copy) and per-IP (one visitor cannot use it to
 * mail a list). The key is the caller's choice: an address alone for the
 * waitlist, or address-and-resource for downloads, where one person legitimately
 * wants two different files.
 *
 * Deliberately in memory. The state is worth nothing — a restart just reopens
 * the window, and the worst case is one duplicate email — so it buys none of
 * the coordination cost that a shared store would.
 */
export class ConfirmationThrottle {
  #sentTo = new Map(); // key -> timestamp
  #ipHits = new Map(); // ip -> timestamp[]

  constructor({ windowMs = 60 * 60 * 1000, maxPerIp = 10 } = {}) {
    this.windowMs = windowMs;
    this.maxPerIp = maxPerIp;
  }

  #sweep(now) {
    for (const [key, at] of this.#sentTo) {
      if (now - at > this.windowMs) this.#sentTo.delete(key);
    }
    for (const [ip, hits] of this.#ipHits) {
      const recent = hits.filter((at) => now - at < this.windowMs);
      if (recent.length) this.#ipHits.set(ip, recent);
      else this.#ipHits.delete(ip);
    }
  }

  /**
   * Decide whether this send may proceed, claiming the slot if so.
   *
   * The claim happens here rather than after the send, so two near-simultaneous
   * submits cannot both pass the check and each mail a copy.
   *
   * @returns {"allowed" | "already-sent" | "ip-limited"}
   */
  claim({ key, ip = "unknown", now = Date.now() }) {
    this.#sweep(now);

    const hits = this.#ipHits.get(ip) || [];
    if (hits.length >= this.maxPerIp) return "ip-limited";

    if (this.#sentTo.has(key)) return "already-sent";

    this.#sentTo.set(key, now);
    this.#ipHits.set(ip, [...hits, now]);
    return "allowed";
  }

  /**
   * Give a claim back after a failed send, so a mail error is retryable rather
   * than locking the address out for an hour by our own throttle.
   */
  release(key) {
    this.#sentTo.delete(key);
  }
}

export default ConfirmationThrottle;
