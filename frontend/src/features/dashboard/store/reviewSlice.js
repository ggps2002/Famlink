import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { dashboardService } from "@features/dashboard/api/DashboardService";// Replace with your API service setup

// A review is authorised one of two ways, and which fields you send decides
// which: `bookingId` for a review of a completed job, or `targetUserId` for one
// left from a profile page, where an accepted match is what entitles the
// reviewer. Sending neither is rejected by the server.
export const submitReviewThunk = createAsyncThunk(
    "reviews/submitReview",
    async ({ bookingId, rating, msg, userType, targetUserId }, { rejectWithValue }) => {
        try {
            const { data, status } = await dashboardService.addReview({ bookingId, rating, msg, userType, targetUserId });

            return { data, status }; // Return the response data
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message); // Handle error
        }
    }
);

export const getReviewThunk = createAsyncThunk(
    "review/getById",
    async (id, { rejectWithValue }) => {
        try {
            const { data } = await dashboardService.reviewsFor(id);
            return data; // Assuming message contains the nanny details
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

const reviewsSlice = createSlice({
    name: "reviews",
    initialState: {
        isLoading: false,
        reviews: {}, // Store reviews
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(submitReviewThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(submitReviewThunk.fulfilled, (state, action) => {
                state.isLoading = false;
            })
            .addCase(submitReviewThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload || "Failed to submit review";
            })

            .addCase(getReviewThunk.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(getReviewThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.reviews = action.payload.data // Assuming the review has an id
            })
            .addCase(getReviewThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload || "Failed to fetch review";
            });
    },
});

export default reviewsSlice.reducer;