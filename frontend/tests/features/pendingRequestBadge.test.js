import { describe, it, expect } from "vitest";
import matchReducer, {
  acceptIncomingRequestThunk,
  getPendingIncomingCountThunk,
  rejectIncomingRequestThunk,
  selectPendingIncomingBadge,
  undoRejectedIncomingRequestThunk,
} from "@features/matching/store/matchSlice";

/**
 * The count on the dashboard navbar's Matches item.
 *
 * Two things are worth holding still. The cap — the badge reads "5+" rather
 * than growing a header that has no room to grow — and the local adjustment
 * after an answer, which is the only reason the number moves while the member
 * sits on the requests screen: nothing refetches it there, so a decline that
 * did not decrement would leave a badge pointing at an empty inbox.
 */

const reduce = (state, action) => matchReducer(state, action);
const stateWith = (count) =>
  reduce(undefined, { type: getPendingIncomingCountThunk.fulfilled.type, payload: { data: { count } } });

const badgeFor = (count) =>
  selectPendingIncomingBadge({ matchRequest: stateWith(count) });

describe("the unanswered-requests badge", () => {
  it("shows nothing when the inbox is empty", () => {
    expect(badgeFor(0)).toBeNull();
  });

  it("shows the number up to five", () => {
    expect([1, 2, 3, 4, 5].map(badgeFor)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("caps at 5+ beyond that", () => {
    expect(badgeFor(6)).toBe("5+");
    expect(badgeFor(240)).toBe("5+");
  });

  it("survives a response with no count in it", () => {
    const state = reduce(undefined, {
      type: getPendingIncomingCountThunk.fulfilled.type,
      payload: {},
    });

    expect(selectPendingIncomingBadge({ matchRequest: state })).toBeNull();
  });
});

describe("answering a request", () => {
  const answered = { payload: { data: { _id: "match-1" } } };

  it("drops the count when one is accepted", () => {
    const state = reduce(stateWith(3), {
      type: acceptIncomingRequestThunk.fulfilled.type,
      ...answered,
    });

    expect(state.pendingIncomingCount).toBe(2);
  });

  it("drops the count when one is declined", () => {
    const state = reduce(stateWith(3), {
      type: rejectIncomingRequestThunk.fulfilled.type,
      ...answered,
    });

    expect(state.pendingIncomingCount).toBe(2);
  });

  it("puts it back when a decline is undone", () => {
    const state = reduce(stateWith(2), {
      type: undoRejectedIncomingRequestThunk.fulfilled.type,
      ...answered,
    });

    expect(state.pendingIncomingCount).toBe(3);
  });

  it("never goes negative", () => {
    // The screen can answer a request the count was fetched before, and a
    // negative count would render as a badge rather than as nothing.
    const state = reduce(stateWith(0), {
      type: rejectIncomingRequestThunk.fulfilled.type,
      ...answered,
    });

    expect(state.pendingIncomingCount).toBe(0);
    expect(selectPendingIncomingBadge({ matchRequest: state })).toBeNull();
  });
});
