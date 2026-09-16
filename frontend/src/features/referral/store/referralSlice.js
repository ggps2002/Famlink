import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { referralService } from "@features/referral/api/ReferralService";

// Caregiver referral state — the share code, how many friends have joined, and
// how long the earned free matching runs for. Fetched on demand by the refer-a-
// friend screen and by the gate modal.

const initialState = {
  isLoading: false,
  error: null,

  code: null,
  link: null,
  // Friends whose profile is finished — these are the ones that paid out.
  referralCount: 0,
  // Signed up through the link but haven't completed a profile yet, so they
  // haven't earned anything. Worth showing: it's the referrer's cue to nudge.
  pendingCount: 0,
  matchingUntil: null,
  hasActiveMatching: false,
  daysLeft: 0,
  // True when this account is on the referral model (Nanny + hasFamily false)
  // rather than the subscription paywall.
  isReferralGated: false,
  freeMatchUsed: false,
  // > 0 when a referral has been credited that the user hasn't been shown the
  // celebratory popup for yet. Drives the one-time dashboard success modal.
  unseenReferralRewards: 0,

  friends: [],
  areFriendsLoading: false,
};

export const getMyReferralThunk = createAsyncThunk(
  "referral/me",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await referralService.me();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Failed to load referral" });
    }
  }
);

// Dismiss the one-time reward popup — tells the server we've shown it, so it
// won't fire again for this referral.
export const ackReferralRewardsThunk = createAsyncThunk(
  "referral/seenReward",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await referralService.markRewardSeen();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Failed to ack reward" });
    }
  }
);

export const getReferredFriendsThunk = createAsyncThunk(
  "referral/friends",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await referralService.friends();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Failed to load friends" });
    }
  }
);

const referralSlice = createSlice({
  name: "referral",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getMyReferralThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getMyReferralThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        Object.assign(state, action.payload);
      })
      .addCase(getMyReferralThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || "Failed to load referral";
      })

      .addCase(getReferredFriendsThunk.pending, (state) => {
        state.areFriendsLoading = true;
      })
      .addCase(getReferredFriendsThunk.fulfilled, (state, action) => {
        state.areFriendsLoading = false;
        state.friends = action.payload || [];
      })
      .addCase(getReferredFriendsThunk.rejected, (state) => {
        state.areFriendsLoading = false;
      })

      // Clear the popup optimistically the moment it's dismissed, so it can't
      // reappear on a re-render before the server round-trip finishes.
      .addCase(ackReferralRewardsThunk.pending, (state) => {
        state.unseenReferralRewards = 0;
      });
  },
});

export default referralSlice.reducer;
