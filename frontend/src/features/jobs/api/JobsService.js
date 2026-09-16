import { HttpService } from "@shared/api/HttpService";

/** Job posts: the board, one post, and the poster's own. */
export class JobsService extends HttpService {
  create(body) {
    return this.post("/postJob", body);
  }

  all() {
    return this.get("/postJob");
  }

  /** The board, narrowed by query parameters the caller has already cleaned. */
  allFiltered(config) {
    return this.get("/postJob", config);
  }

  byId(id) {
    return this.get(`/postJob/${id}`);
  }

  update(id, body) {
    return this.patch(`/postJob/${id}`, body);
  }

  remove(id) {
    return this.delete(`/postJob/${id}`);
  }

  mine() {
    return this.get("/postJob/user-jobs");
  }
}

export const jobsService = new JobsService();
export default jobsService;
