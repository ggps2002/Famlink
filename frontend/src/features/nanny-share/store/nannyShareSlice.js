import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { nannyShareService } from "@features/nanny-share/api/NannyShareService";

// Define the initial state
const initialState = {
  isProfilesLoading: false,
  isCurrentProfileLoading: false,
  currentProfile: null,
  data: [], // To store the list of nannies
  pagination: {
    currentPage: 1,
    totalPages: 0,
    pageSize: 0,
    totalRecords: 0,
  },
};

/**
 * Never dispatched — kept only because `state.postNannyShare` is this slice's
 * key in the store and a dozen screens select from it.
 *
 * It does not do what its name says and never did. The call was
 * `api.get("/nannyShare", body, { headers })`: a GET, despite "post", and axios
 * reads a GET's second argument as its config, so `body` was passed as config
 * and the payload never left the browser. The third argument was ignored
 * outright. Shares are actually created through the questionnaire flow, which
 * is why nobody noticed.
 *
 * Left as a plain read rather than "fixed" into a POST: making it work would
 * introduce a write path no screen asks for. Delete it, and its three reducer
 * cases, when the slice is next touched.
 */
export const postNannyShare = createAsyncThunk(
  "nannyShare/",
  async (_body, { rejectWithValue }) => {
    try {
      const { data, status } = await nannyShareService.all();
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const nannyshareProfileThunk = createAsyncThunk(
  "nannyShareProfile/",
  async (body, { rejectWithValue }) => {
    try {
      const { data, status } = await nannyShareService.saveProfile(body);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
)

export const sendQuestionnaireFormEmail = createAsyncThunk(
  "nannyShare/email",
  async (body, { rejectWithValue }) => {
    try {
      const { data, status } = await nannyShareService.sendQuestionnaireEmail(body);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const viewNannyShareProfileThunk = createAsyncThunk(
  "viewNannyShareProfile/",
  async (body, { rejectWithValue }) => {
    try {
      const { data, status } = await nannyShareService.browse(body);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
)

export const viewCurrentUserProfileThunk = createAsyncThunk(
  "viewCurrentUserProfile/",
  async (_, { rejectWithValue }) => {
    try {
      const { data, status } = await nannyShareService.currentUserProfile();
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
)

export const fetchAllNanniesShareThunk = createAsyncThunk(
  "nannyShare/getFilteredData",
  async (params, { rejectWithValue }) => {
    try {
      // Remove undefined values from params
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined));

      // console.log('Filtered Params:', filteredParams);

      const { data } = await nannyShareService.allFiltered({
        params: filteredParams,
      });
      return {
        data: data.data, // Assuming message contains the list of nannies
        pagination: data.pagination, // Assuming pagination info is in this field
      };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const fetchNannyShareByIdThunk = createAsyncThunk(
  "nannyShare/getById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await nannyShareService.byId(id);
      return data.data; // Assuming message contains the nanny details
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const updateNannyShareThunk = createAsyncThunk(
  "nannyShare/updateById",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await nannyShareService.update(id, body);
      return data; // Return the updated job
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Error updating nanny share"
      );
    }
  }
);

export const deleteNannyShareThunk = createAsyncThunk(
  "nannyShare/deleteById",
  async (id, { rejectWithValue }) => {
    try {
      const data = await nannyShareService.remove(id);
      return data; // Return the deleted ID for removal from state
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Error deleting nanny share"
      );
    }
  }
);

// Create the slice
const nannyShareSlice = createSlice({
  name: "nannyShare",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Handle pending state
      .addCase(postNannyShare.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(postNannyShare.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(postNannyShare.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(viewNannyShareProfileThunk.pending, (state) => {
        state.isProfilesLoading = true;
      })
      // Handle fulfilled state
      .addCase(viewNannyShareProfileThunk.fulfilled, (state, action) => {
        state.isProfilesLoading = false;
        state.data = action.payload.data.data; // Store the fetched nannies
        state.pagination = action.payload.data.pagination; // Update pagination info
      })
      // Handle rejected state
      .addCase(viewNannyShareProfileThunk.rejected, (state) => {
        state.isProfilesLoading = false;
      })

      .addCase(viewCurrentUserProfileThunk.pending, (state) => {
        state.isCurrentProfileLoading = true;
      })
      // Handle fulfilled state
      .addCase(viewCurrentUserProfileThunk.fulfilled, (state, action) => {
        state.isCurrentProfileLoading = false;
        state.currentProfile = action.payload.data.data; // Store the fetched nannies
      })
      // Handle rejected state
      .addCase(viewCurrentUserProfileThunk.rejected, (state) => {
        state.isCurrentProfileLoading = false;
      })

      .addCase(fetchNannyShareByIdThunk.pending, (state) => {
        state.isLoading = true;
      })
      // Handle fulfilled state for fetching nanny by ID
      .addCase(fetchNannyShareByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload; // Store the fetched nanny details
      })
      // Handle rejected state for fetching nanny by ID
      .addCase(fetchNannyShareByIdThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(updateNannyShareThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateNannyShareThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        // console.log(action.payload)
        state.data = action.payload.job; // or update the specific job if needed
      })
      .addCase(updateNannyShareThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(deleteNannyShareThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteNannyShareThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(deleteNannyShareThunk.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

// Export the reducer
export default nannyShareSlice.reducer;
