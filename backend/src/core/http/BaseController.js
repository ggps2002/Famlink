/**
 * The base class for controllers.
 *
 * A controller is the only place that touches `req` and `res`. It reads the
 * request, calls a service with plain values, and shapes the response. It
 * contains no business rules — if a method here has an `if` about what a user
 * is allowed to do, that check belongs in the service.
 *
 * Two mechanics matter:
 *
 * 1. Method binding. `router.get("/x", controller.show)` passes the function
 *    without its receiver, so `this` inside it would be undefined. Every method
 *    is bound in the constructor, which means routes can be registered in the
 *    natural way and a missed `.bind(this)` can't produce a crash that only
 *    happens on one endpoint.
 *
 * 2. Error forwarding. Async handlers that throw do not reach Express 4's error
 *    middleware — the rejection is unhandled and the request hangs until the
 *    client gives up. `#wrap` catches and forwards to `next`, so a service is
 *    free to throw and no handler needs its own try/catch. That is why the
 *    controllers here have none.
 */
export class BaseController {
  constructor() {
    this.#bindHandlers();
  }

  /**
   * Bind and error-wrap every method the subclass defines.
   *
   * Walks the prototype chain rather than `Object.keys(this)` because class
   * methods live on the prototype, and stops before BaseController so the
   * helpers below aren't wrapped as if they were route handlers.
   */
  #bindHandlers() {
    let proto = Object.getPrototypeOf(this);

    while (proto && proto !== BaseController.prototype) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === "constructor") continue;

        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        // Getters must not be invoked here — reading `descriptor.value` on an
        // accessor would run it at construction time.
        if (!descriptor || typeof descriptor.value !== "function") continue;

        this[key] = this.#wrap(descriptor.value.bind(this));
      }
      proto = Object.getPrototypeOf(proto);
    }
  }

  /** Wrap a handler so a rejected promise becomes `next(error)`. */
  #wrap(handler) {
    return (req, res, next) => {
      try {
        const result = handler(req, res, next);
        if (result instanceof Promise) result.catch(next);
        return result;
      } catch (error) {
        return next(error);
      }
    };
  }

  /* ───────────────────────────── response helpers ──────────────────────────
   * These write the response shapes the existing frontend already parses:
   * a `message` string, and payloads under `data` with `pagination` alongside.
   * Changing that shape would mean changing 35 Redux slices, so it is fixed. */

  /** 200 with an optional body. */
  ok(res, body = {}) {
    return res.status(200).json(body);
  }

  /** 200 carrying a resource under `data`, matching the existing list/detail shape. */
  sendData(res, data, { message, pagination, status = 200, ...rest } = {}) {
    const body = { ...rest, data };
    if (message) body.message = message;
    if (pagination) body.pagination = pagination;
    return res.status(status).json(body);
  }

  /** 201 for a resource this request brought into existence. */
  created(res, data, { message = "Created successfully", ...rest } = {}) {
    return this.sendData(res, data, { message, status: 201, ...rest });
  }

  /** 200 with only a message — for actions whose result is the side effect. */
  message(res, message, status = 200) {
    return res.status(status).json({ message });
  }

  /** 204 for a successful action with nothing to say about it. */
  noContent(res) {
    return res.status(204).end();
  }
}

export default BaseController;
