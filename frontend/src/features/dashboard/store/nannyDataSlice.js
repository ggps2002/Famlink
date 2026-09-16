import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { dashboardService } from "@features/dashboard/api/DashboardService";

// Define the initial state
const initialState = {
    isLoading: false,
    error: null,
    selectedNanny: null,
    nannies: [], // To store the list of nannies
    pagination: {
        currentPage: 1,
        totalPages: 0,
        pageSize: 0,
        totalRecords: 0,
    },
};

// Thunk to fetch nannies, filtered.
//
// A commented-out earlier version read "/nanny/getAllData" — a route the server
// has never served, which is presumably why it was commented out rather than
// deleted. Removed along with the service method it called.
export const fetchAllNanniesThunk = createAsyncThunk(
    "nanny/getFilteredData",
    async ({ page, limit, avaiForWorking, ageGroupsExp, interestedPosi, salaryRange, location }, { rejectWithValue }) => {
        try {
            const { data } = await dashboardService.filteredUsers({
                params: {
                    userType: "Nanny",
                    page,
                    limit,
                    avaiForWorking,
                    ageGroupsExp,
                    interestedPosi,
                    salaryRange,
                    location,
                },
            });

            return {
                nannies: data.message, // Assuming message contains the list of nannies
                pagination: data.pagination, // Assuming pagination info is in this field
            };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const fetchNannyByIdThunk = createAsyncThunk(
    "nanny/getById",
    async (id, { rejectWithValue }) => {
        try {
            const { data } = await dashboardService.userById(id, { bustCache: true });
            return data.message; // Assuming message contains the nanny details
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Create the slice
const nannySlice = createSlice({
    name: "nanny",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Handle pending state
            .addCase(fetchAllNanniesThunk.pending, (state) => {
                state.isLoading = true;
            })
            // Handle fulfilled state
            .addCase(fetchAllNanniesThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.nannies = action.payload.nannies; // Store the fetched nannies
                state.pagination = action.payload.pagination; // Update pagination info
            })
            // Handle rejected state
            .addCase(fetchAllNanniesThunk.rejected, (state) => {
                state.isLoading = false;
            })

            .addCase(fetchNannyByIdThunk.pending, (state) => {
                state.isLoading = true;
                state.error = null;
                state.selectedNanny = null; // clear stale profile while loading a new one
            })
            // Handle fulfilled state for fetching nanny by ID
            .addCase(fetchNannyByIdThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.selectedNanny = action.payload; // Store the fetched nanny details
            })
            // Handle rejected state for fetching nanny by ID
            .addCase(fetchNannyByIdThunk.rejected, (state, action) => {
                state.isLoading = false;
                state.error =
                    action.payload?.message || "Unable to load this profile. Please try again.";
            });
    },
});

// Export the reducer
export default nannySlice.reducer;
