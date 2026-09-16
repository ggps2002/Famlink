import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { matchService } from "@features/matching/api/MatchService";

const initialState = {
    isMatchLoading: false,
    message: "",

    // Bumped every time a match request is successfully sent.
    // Used by views (e.g. ProfileList) to trigger a re-fetch so the
    // profile status reflects the new request without a page refresh.
    requestSentCount: 0,

    // Separate arrays per request type
    incomingMatches: [],
    outgoingMatches: [],

    // Incoming requests still waiting on an answer, for the navbar badge.
    //
    // Held apart from `incomingMatches` because it is a different question. That
    // array is one page of whatever the requests screen last asked for — ten
    // rows of every status — so counting pending entries in it undercounts an
    // inbox larger than a page and reads 0 before any screen has fetched. This
    // is the server's whole-inbox count, and the transitions below keep it
    // honest between fetches so answering a request updates the badge at once.
    pendingIncomingCount: 0,

    // Separate pagination per request type
    incomingPagination: {
        currentPage: 1,
        totalPages: 0,
        pageSize: 0,
        totalRecords: 0,
        hasMore: false,
    },
    outgoingPagination: {
        currentPage: 1,
        totalPages: 0,
        pageSize: 0,
        totalRecords: 0,
        hasMore: false,
    },
};

// Thunk to send match request
export const sentMatchRequestThunk = createAsyncThunk(
    "sentMatchRequest",
    async (body, { rejectWithValue }) => {
        try {
            const { data } = await matchService.sendRequest(body);
            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk to get outgoing requests
export const getOutgoingRequestsThunk = createAsyncThunk(
    "getOutgoingRequests",
    async (
        { page = 1, limit = 10 },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.outgoingRequests({ page, limit });

            return {
                ...data,
                page,
            };
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to get incoming requests
export const getIncomingRequestsThunk = createAsyncThunk(
    "getIncomingRequests",
    async (
        { page = 1, limit = 10, status = "" },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.incomingRequests({ page, limit, status });

            return {
                ...data,
                page,
            };
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to get the number of unanswered incoming requests
export const getPendingIncomingCountThunk = createAsyncThunk(
    "getPendingIncomingCount",
    async (_, { rejectWithValue }) => {
        try {
            const { data } = await matchService.pendingIncomingCount();

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to accept incoming request
export const acceptIncomingRequestThunk = createAsyncThunk(
    "acceptIncomingRequest",
    async (
        { matchId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.accept(matchId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to reject incoming request
export const rejectIncomingRequestThunk = createAsyncThunk(
    "rejectIncomingRequest",
    async (
        { matchId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.reject(matchId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

export const undoRejectedIncomingRequestThunk = createAsyncThunk(
    "undoRejectedIncomingRequest",
    async (
        { matchId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.undoReject(matchId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to block a matched profile
export const blockMatchThunk = createAsyncThunk(
    "blockMatch",
    async (
        { matchId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.block(matchId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to unblock a previously blocked profile
export const unblockMatchThunk = createAsyncThunk(
    "unblockMatch",
    async (
        { matchId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.unblock(matchId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// Thunk to fetch the match between the current user and another user (either
// direction) — used by the chat screen to detect a blocked conversation.
export const getMatchWithUserThunk = createAsyncThunk(
    "getMatchWithUser",
    async (
        { userId },
        { rejectWithValue }
    ) => {
        try {
            const { data } = await matchService.matchWithUser(userId);

            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data);
        }
    }
);

// `checkMatchRequestThunk` used to sit here, POSTing to /match/check-match.
// Nothing dispatched it and the server has no such route, so it could only ever
// have 404'd. Match state is read from getMatchWithUserThunk instead.

// Create the slice
const matchSlice = createSlice({
    name: "matchRequest",
    initialState,
    reducers: {
        clearIncomingMatches: (state) => {
            state.incomingMatches = [];
            state.incomingPagination = initialState.incomingPagination;
        },
        clearOutgoingMatches: (state) => {
            state.outgoingMatches = [];
            state.outgoingPagination = initialState.outgoingPagination;
        },
    },
    extraReducers: (builder) => {
        builder
            // ─── sentMatchRequest ───────────────────────────────────────────
            .addCase(sentMatchRequestThunk.pending, (state) => {
                state.isMatchLoading = true;
            })
            .addCase(sentMatchRequestThunk.fulfilled, (state, action) => {
                state.isMatchLoading = false;
                state.message = action.payload.message;
                state.requestSentCount += 1;
            })
            .addCase(sentMatchRequestThunk.rejected, (state) => {
                state.isMatchLoading = false;
            })

            // ─── getOutgoingRequests ────────────────────────────────────────
            .addCase(getOutgoingRequestsThunk.pending, (state) => {
                state.isMatchLoading = true;
            })
            .addCase(getOutgoingRequestsThunk.fulfilled, (state, action) => {
                state.isMatchLoading = false;

                if (action.payload.page === 1) {
                    state.outgoingMatches = action.payload.data;
                } else {
                    state.outgoingMatches = [
                        ...state.outgoingMatches,
                        ...action.payload.data,
                    ];
                }

                state.outgoingPagination.hasMore = action.payload.pagination.hasMore;
                state.message = action.payload.message;
            })
            .addCase(getOutgoingRequestsThunk.rejected, (state) => {
                state.isMatchLoading = false;
            })

            // ─── getIncomingRequests ────────────────────────────────────────
            .addCase(getIncomingRequestsThunk.pending, (state) => {
                state.isMatchLoading = true;
            })
            .addCase(getIncomingRequestsThunk.fulfilled, (state, action) => {
                state.isMatchLoading = false;

                if (action.payload.page === 1) {
                    state.incomingMatches = action.payload.data;
                } else {
                    state.incomingMatches = [
                        ...state.incomingMatches,
                        ...action.payload.data,
                    ];
                }

                state.incomingPagination.hasMore = action.payload.pagination.hasMore;
                state.message = action.payload.message;
            })
            .addCase(getIncomingRequestsThunk.rejected, (state) => {
                state.isMatchLoading = false;
            })

            // ─── getPendingIncomingCount ────────────────────────────────────
            // No pending/rejected cases: the badge is ambient, so a failed or
            // in-flight fetch should leave the last known number on screen
            // rather than flashing a spinner or dropping to zero.
            .addCase(getPendingIncomingCountThunk.fulfilled, (state, action) => {
                state.pendingIncomingCount = action.payload?.data?.count ?? 0;
            })

            // ─── acceptIncomingRequest ──────────────────────────────────────
            .addCase(acceptIncomingRequestThunk.pending, (state) => {
                state.isMatchLoading = true;
            })
            .addCase(acceptIncomingRequestThunk.fulfilled, (state, action) => {
                const acceptedMatch = action.payload.data;

                // Both transitions below are only reachable from a pending
                // request — the server refuses them in any other state — so the
                // badge can be adjusted without re-asking for the count.
                state.pendingIncomingCount = Math.max(0, state.pendingIncomingCount - 1);

                state.incomingMatches = state.incomingMatches.map((match) => {
                    if (String(match.matchId) === String(acceptedMatch._id)) {
                        return { ...match, status: "accepted" };
                    }
                    return match;
                });

                state.isMatchLoading = false;
            })
            .addCase(acceptIncomingRequestThunk.rejected, (state) => {
                state.isMatchLoading = false;
            })

            // ─── rejectIncomingRequest ──────────────────────────────────────
            .addCase(rejectIncomingRequestThunk.pending, (state) => {
                state.isMatchLoading = true;
            })
            .addCase(rejectIncomingRequestThunk.fulfilled, (state, action) => {
                const rejectedMatch = action.payload.data;

                state.pendingIncomingCount = Math.max(0, state.pendingIncomingCount - 1);

                state.incomingMatches = state.incomingMatches.map((match) => {
                    if (String(match.matchId) === String(rejectedMatch._id)) {
                        return { ...match, status: "rejected" };
                    }
                    return match;
                });

                state.isMatchLoading = false;
            })
            .addCase(rejectIncomingRequestThunk.rejected, (state) => {
                state.isMatchLoading = false;
            })

            // ─── undoRejectedIncomingRequest ──────────────────────────────────────
            .addCase(undoRejectedIncomingRequestThunk.pending, (state) => {
                // state.isMatchLoading = true;
            })
            .addCase(undoRejectedIncomingRequestThunk.fulfilled, (state, action) => {
                const rejectedMatch = action.payload.data;

                // Undoing a decline puts the request back in the inbox.
                state.pendingIncomingCount += 1;

                state.incomingMatches = state.incomingMatches.map((match) => {
                    if (String(match.matchId) === String(rejectedMatch._id)) {
                        return { ...match, status: "pending" };
                    }
                    return match;
                });

                // state.isMatchLoading = false;
            })
            .addCase(undoRejectedIncomingRequestThunk.rejected, (state) => {
                // state.isMatchLoading = false;
            })

            // ─── blockMatch ───────────────────────────────────────────────────
            .addCase(blockMatchThunk.fulfilled, (state, action) => {
                const updated = action.payload.data;
                const apply = (m) =>
                    String(m.matchId) === String(updated._id)
                        ? { ...m, status: "blocked" }
                        : m;
                state.incomingMatches = state.incomingMatches.map(apply);
                state.outgoingMatches = state.outgoingMatches.map(apply);
            })

            // ─── unblockMatch ─────────────────────────────────────────────────
            .addCase(unblockMatchThunk.fulfilled, (state, action) => {
                const updated = action.payload.data;
                const apply = (m) =>
                    String(m.matchId) === String(updated._id)
                        ? { ...m, status: "accepted" }
                        : m;
                state.incomingMatches = state.incomingMatches.map(apply);
                state.outgoingMatches = state.outgoingMatches.map(apply);
            });
    },
});

export const { clearIncomingMatches, clearOutgoingMatches } = matchSlice.actions;

export const selectPendingIncomingCount = (state) =>
    state.matchRequest.pendingIncomingCount;

/**
 * The badge's label, or null when there is nothing to show.
 *
 * Capped at "5+" rather than growing: the badge sits on a nav item in a fixed
 * header, and past a handful the exact number changes nothing the member would
 * do about it.
 */
export const selectPendingIncomingBadge = (state) => {
    const count = selectPendingIncomingCount(state);
    if (!count || count < 1) return null;
    return count > 5 ? "5+" : String(count);
};

// Export the reducer
export default matchSlice.reducer;