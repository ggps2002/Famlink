import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { bookingListService } from "@features/booking/api/BookingListService";

// Define the initial state
const initialState = {
    isLoading: false,
    data: [],
    pagination: {
        currentPage: 1,
        totalPages: 0,
        pageSize: 0,
        totalRecords: 0,
    },
};

export const fetchComRequesterThunk = createAsyncThunk(
    "book-hire/fetchRequest",
    async ({ page, limit }, { rejectWithValue }) => {
        try {
            const {data} = await bookingListService.completed({ limit, page });

            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

const completedReqDataSlice = createSlice({
    name: "comReqData",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Handle pending state
            .addCase(fetchComRequesterThunk.pending, (state) => {
                state.isLoading = true;
            })
            // Handle fulfilled state
            .addCase(fetchComRequesterThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.data = action.payload.data;
                state.pagination = action.payload.pagination;
            })
            // Handle rejected state
            .addCase(fetchComRequesterThunk.rejected, (state) => {
                state.isLoading = false;
            })
    },
});

export default completedReqDataSlice.reducer;
