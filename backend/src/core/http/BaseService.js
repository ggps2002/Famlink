/**
 * The base class for domain services.
 *
 * A service holds the business rules and knows nothing about HTTP: no `req`,
 * no `res`, no status codes. It receives plain arguments, talks to
 * repositories and other services, and either returns a value or throws one of
 * the errors from core/errors. That constraint is what makes the rules
 * testable without spinning up Express, and what lets the same rule be reused
 * by a cron job or a CLI script — several of the current cron jobs re-implement
 * logic that lives inside a route handler precisely because it was unreachable.
 *
 * Dependencies arrive through the constructor rather than being imported
 * directly, so a test can substitute a fake repository without module mocking.
 */
export class BaseService {
  /** @param {Record<string, unknown>} [dependencies] */
  constructor(dependencies = {}) {
    Object.assign(this, dependencies);
  }
}

export default BaseService;
