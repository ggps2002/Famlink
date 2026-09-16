import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { dashboardService } from "@features/dashboard/api/DashboardService";

// Define the initial state
const initialState = {
    isLoading: false,
    families: [],
    selectedFamily: null,
    pagination: {
        currentPage: 1,
        totalPages: 0,
        pageSize: 0,
        totalRecords: 0,
    },
};

export const fetchAllFamiliesThunk = createAsyncThunk(
    "family/getFilteredData",
    async ({ page, limit, avaiForWorking, ageGroupsExp, interestedPosi, salaryRange, location, start }, { rejectWithValue }) => {
        try {
            const { data } = await dashboardService.filteredUsers({
                params: {
                    userType: "Parents",
                    page,
                    limit,
                    avaiForWorking,
                    ageGroupsExp,
                    interestedPosi,
                    location,
                    start,
                },
            });

            return {
                families: data.message,
                pagination: data.pagination,
            };
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const fetchFamilyByIdThunk = createAsyncThunk(
    "family/getById",
    async (id, { rejectWithValue }) => {
        try {
            const { data } = await dashboardService.userById(id);
            return data.message;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Create the slice
const familySlice = createSlice({
    name: "family",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Handle pending state
            .addCase(fetchAllFamiliesThunk.pending, (state) => {
                state.isLoading = true;
            })
            // Handle fulfilled state
            .addCase(fetchAllFamiliesThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.families = action.payload.families;
                state.pagination = action.payload.pagination;
            })
            // Handle rejected state
            .addCase(fetchAllFamiliesThunk.rejected, (state) => {
                state.isLoading = false;
            })

            .addCase(fetchFamilyByIdThunk.pending, (state) => {
                state.isLoading = true;
            })
           
            .addCase(fetchFamilyByIdThunk.fulfilled, (state, action) => {
                state.isLoading = false;
                state.selectedFamily = action.payload; 
            })
            
            .addCase(fetchFamilyByIdThunk.rejected, (state) => {
                state.isLoading = false;
            });
    },
});

// Export the reducer
export default familySlice.reducer;
