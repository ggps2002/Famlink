import { HttpService } from "@shared/api/HttpService";

/**
 * Match requests between members: sending them, listing them, and the four
 * decisions that can be taken on one.
 *
 * The accept/reject/block trio all POST with the match id in the query string
 * rather than the path, which is how the backend routes them — worth noting
 * because it looks like an oversight and is not.
 */
export class MatchService extends HttpService {
  sendRequest(body) {
    return this.post("/match/request", body);
  }

  outgoingRequests({ page = 1, limit = 10 } = {}) {
    return this.get(`/match/get-outgoing-requests?page=${page}&limit=${limit}`);
  }

  incomingRequests({ page = 1, limit = 10, status = "" } = {}) {
    return this.get(
      `/match/get-incoming-requests?page=${page}&limit=${limit}&status=${status}`
    );
  }

  /** How many incoming requests are still unanswered — the navbar badge. */
  pendingIncomingCount() {
    return this.get("/match/pending-incoming-count");
  }

  accept(matchId) {
    return this.post(`/match/accept-incoming-request?matchId=${matchId}`);
  }

  reject(matchId) {
    return this.post(`/match/reject-incoming-request?matchId=${matchId}`);
  }

  undoReject(matchId) {
    return this.post(`/match/undo-reject-incoming-request?matchId=${matchId}`);
  }

  block(matchId) {
    return this.post(`/match/block-match?matchId=${matchId}`);
  }

  unblock(matchId) {
    return this.post(`/match/unblock-match?matchId=${matchId}`);
  }

  matchWithUser(userId) {
    return this.get(`/match/get-match-with-user?userId=${userId}`);
  }
}

export const matchService = new MatchService();
export default matchService;
