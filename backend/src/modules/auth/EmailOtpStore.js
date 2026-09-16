import { client, connectRedis } from "../../shared/cache/RedisClient.js";

/**
 * Redis-backed storage for pre-account email verification codes.
 *
 * Keyed on the address rather than a user id, because this flow runs *before*
 * an account exists — it is how the signup form proves the address is real. The
 * code and the attempt counter live together so a wrong guess can be counted
 * without a second round trip.
 *
 * Connects lazily. The module this replaced called `await connectRedis()` at
 * top level, which meant importing it opened a socket as a side effect and the
 * process could never exit — the reason the legacy router cannot be imported by
 * a test. Here the connection happens on first use.
 */
export class EmailOtpStore {
  constructor({ redis = client, connect = connectRedis, ttlSeconds = 15 * 60 } = {}) {
    this.redis = redis;
    this.connect = connect;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * The Redis key for an address.
   *
   * Deliberately the bare address, preserved from the original. It shares a
   * namespace with anything else that keys on an email, which is worth
   * changing — but prefixing it now would invalidate every code currently in
   * flight, so it is a change to make on purpose rather than in passing.
   */
  static #keyFor(email) {
    return email;
  }

  async #ready() {
    await this.connect();
  }

  /** The stored `{ otp, attempts }` for an address, or null. */
  async read(email) {
    await this.#ready();
    const raw = await this.redis.get(EmailOtpStore.#keyFor(email));
    return raw ? JSON.parse(raw) : null;
  }

  /** Store a fresh code, resetting the attempt counter. */
  async issue(email, otp) {
    await this.#ready();
    await this.redis.set(EmailOtpStore.#keyFor(email), JSON.stringify({ otp, attempts: 0 }), {
      EX: this.ttlSeconds,
    });
  }

  /**
   * Record a failed guess without extending the code's life.
   *
   * The remaining TTL is read and re-applied: writing the record back with a
   * fresh 15 minutes would let an attacker keep a code alive indefinitely by
   * guessing wrong at intervals.
   */
  async recordFailedAttempt(email, data) {
    await this.#ready();
    const key = EmailOtpStore.#keyFor(email);
    const ttl = await this.redis.ttl(key);

    await this.redis.set(key, JSON.stringify({ ...data, attempts: data.attempts + 1 }), {
      EX: ttl > 0 ? ttl : this.ttlSeconds,
    });
  }

  async clear(email) {
    await this.#ready();
    await this.redis.del(EmailOtpStore.#keyFor(email));
  }
}

export default EmailOtpStore;
