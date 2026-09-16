import { BaseController } from "../../core/http/BaseController.js";

/**
 * Translates match requests to and from HTTP.
 *
 * Note what is absent: no try/catch (BaseController forwards rejections to the
 * error boundary) and no rules (those are in MatchService). What is left is
 * reading inputs and choosing a response shape — and the shapes are fixed by
 * the Redux slices already parsing them, so they are reproduced exactly.
 */
export class MatchController extends BaseController {
  /** @param {{ matchService: import("./match.service.js").MatchService }} deps */
  constructor({ matchService }) {
    super();
    this.matchService = matchService;
  }

  /** Paging as the client sends it — page/limit in the query, defaulting to 1/10. */
  static #paging(query) {
    return {
      page: Number(query.page || 1),
      limit: Number(query.limit || 10),
    };
  }

  async requestMatch(req, res) {
    const { senderId, receiverId, message } = req.body;

    await this.matchService.requestMatch({
      userId: req.userId,
      senderId,
      receiverId,
      message,
    });

    // `data: []` rather than the created request: the client only reads the
    // message and bumps a counter, and the request row carries both members'
    // ids. Preserved as-is.
    return this.sendData(res, [], { message: "Request sent successfully" });
  }

  async getOutgoingRequests(req, res) {
    const { data, pagination } = await this.matchService.listOutgoing({
      userId: req.userId,
      ...MatchController.#paging(req.query),
    });

    return this.sendData(res, data, {
      status: 200,
      message: "Request success",
      pagination,
    });
  }

  async getIncomingRequests(req, res) {
    const { data, pagination } = await this.matchService.listIncoming({
      userId: req.userId,
      ...MatchController.#paging(req.query),
    });

    return this.sendData(res, data, {
      status: 200,
      message: "Request success",
      pagination,
    });
  }

  async getPendingIncomingCount(req, res) {
    const count = await this.matchService.countPendingIncoming({ userId: req.userId });

    // An object rather than the bare number so the field can be joined by a
    // second one later (unread messages, say) without the client's parse of
    // `data` changing shape underneath it.
    return this.sendData(res, { count }, { message: "Request success" });
  }

  async acceptIncomingRequest(req, res) {
    const request = await this.matchService.accept({
      userId: req.userId,
      matchId: req.query.matchId,
    });

    return this.sendData(res, request, { message: "Request accepted" });
  }

  async rejectIncomingRequest(req, res) {
    const request = await this.matchService.reject({
      userId: req.userId,
      matchId: req.query.matchId,
    });

    // "Request accepted" on the reject path is wrong, and preserved: the client
    // ignores this message entirely (matchSlice reads only `data`), so
    // correcting it here would be a behaviour change smuggled into a refactor.
    // Worth fixing deliberately, separately.
    return this.sendData(res, request, { message: "Request accepted" });
  }

  async undoRejectedIncomingRequest(req, res) {
    const request = await this.matchService.undoReject({
      userId: req.userId,
      matchId: req.query.matchId,
    });

    return this.sendData(res, request, { message: "Request accepted" });
  }

  async blockMatch(req, res) {
    const request = await this.matchService.block({
      userId: req.userId,
      matchId: req.query.matchId,
    });

    return this.sendData(res, request, { message: "Profile blocked" });
  }

  async unblockMatch(req, res) {
    const request = await this.matchService.unblock({
      userId: req.userId,
      matchId: req.query.matchId,
    });

    return this.sendData(res, request, { message: "Profile unblocked" });
  }

  async getMatchWithUser(req, res) {
    const match = await this.matchService.findMatchWith({
      userId: req.userId,
      otherUserId: req.query.userId,
    });

    // No match is a 200 with a null body, not a 404 — the chat screen asks this
    // on every open and "these two have never matched" is a normal answer.
    return this.sendData(res, match);
  }
}

export default MatchController;
