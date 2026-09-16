import { HttpService } from "@shared/api/HttpService";

/**
 * Member directory lookups shared by the family and nanny dashboards.
 *
 * `userById` deliberately takes a cache-buster. The nanny-side profile screen
 * re-reads a user straight after an edit, and without it the browser served the
 * previous response — the member saved a change and watched the old value come
 * back. The family-side screen never had that problem because it reads a
 * different view, so the parameter is optional rather than baked in.
 */
export class DashboardService extends HttpService {
  filteredUsers(config) {
    return this.get("/userData/getFiltered", config);
  }

  userById(id, { bustCache = false } = {}) {
    const suffix = bustCache ? `?t=${new Date().getTime()}` : "";
    return this.get(`/userData/getById/${id}${suffix}`);
  }

  favourites({ limit, page }) {
    return this.get(`/favourite/getData/?limit=${limit}&page=${page}`);
  }

  addFavourite(body) {
    return this.post("/favourite/add", body);
  }

  addReview(body) {
    return this.post("/reviews", body);
  }

  reviewsFor(id) {
    return this.get(`/reviews/${id}`);
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
