import { HttpService } from "@shared/api/HttpService";

/**
 * Nanny share profiles: the member's own, and the browse over everyone else's.
 *
 * Two prefixes appear here and they are not interchangeable. `/nannyShare` is
 * the share record itself — create, read, edit, delete. `/share` is the browse
 * side: the filtered listing other members see and the caller's own profile as
 * it appears in it.
 */
export class NannyShareService extends HttpService {
  all() {
    return this.get("/nannyShare");
  }

  /**
   * The same listing, narrowed by query parameters.
   *
   * Takes an axios config rather than a filter object because the caller strips
   * undefined entries first — sending `?location=undefined` matches nothing, and
   * that is exactly what the unfiltered version used to do.
   */
  allFiltered(config) {
    return this.get("/nannyShare", config);
  }

  byId(id) {
    return this.get(`/nannyShare/${id}`);
  }

  update(id, body) {
    return this.patch(`/nannyShare/${id}`, body);
  }

  remove(id) {
    return this.delete(`/nannyShare/${id}`);
  }

  saveProfile(body) {
    return this.post("/nanny/nanny-share/profile", body);
  }

  sendQuestionnaireEmail(body) {
    return this.post("/nannyShare/send-questionnaire-email", body);
  }

  /**
   * The browse listing. Filters go in the body rather than the query string
   * because there are enough of them — ages, rates, schedule, job type,
   * location — to outgrow a URL.
   */
  browse(filters) {
    return this.post("/share/show-profiles", filters);
  }

  currentUserProfile() {
    return this.get("/share/current-user-profile");
  }
}

export const nannyShareService = new NannyShareService();
export default nannyShareService;
