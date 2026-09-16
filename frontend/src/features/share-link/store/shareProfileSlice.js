import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { shareLinkService } from "@features/share-link/api/ShareLinkService";

// State for the "Share Profile" feature — the owner's own link (what the share
// sheet copies) and the public payload behind a shared link (what a visitor
// reading /share/<token> sees). They're separate fields because both can be in
// play at once: a signed-in member can open someone else's shared link.

const initialState = {
  // Owner side
  link: null,
  token: null,
  preview: null, // the owner's own card, as strangers will see it
  isLinkLoading: false,
  linkError: null,

  // Visitor side
  sharedProfile: null,
  isSharedProfileLoading: false,
  sharedProfileError: null,
};

export const getMyShareLinkThunk = createAsyncThunk(
  "shareProfile/myLink",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await shareLinkService.myShareLink();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: "Could not create a share link" });
    }
  }
);

export const fetchSharedProfileThunk = createAsyncThunk(
  "shareProfile/public",
  async (token, { rejectWithValue }) => {
    try {
      const { data } = await shareLinkService.publicProfile(token);
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: "This share is no longer available" }
      );
    }
  }
);

const shareProfileSlice = createSlice({
  name: "shareProfile",
  initialState,
  reducers: {
    clearSharedProfile: (state) => {
      state.sharedProfile = null;
      state.sharedProfileError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMyShareLinkThunk.pending, (state) => {
        state.isLinkLoading = true;
        state.linkError = null;
      })
      .addCase(getMyShareLinkThunk.fulfilled, (state, action) => {
        state.isLinkLoading = false;
        state.link = action.payload?.url || null;
        state.token = action.payload?.token || null;
        state.preview = action.payload?.profile || null;
      })
      .addCase(getMyShareLinkThunk.rejected, (state, action) => {
        state.isLinkLoading = false;
        state.linkError = action.payload?.message || "Could not create a share link";
      })

      .addCase(fetchSharedProfileThunk.pending, (state) => {
        state.isSharedProfileLoading = true;
        state.sharedProfileError = null;
      })
      .addCase(fetchSharedProfileThunk.fulfilled, (state, action) => {
        state.isSharedProfileLoading = false;
        state.sharedProfile = action.payload;
      })
      .addCase(fetchSharedProfileThunk.rejected, (state, action) => {
        state.isSharedProfileLoading = false;
        state.sharedProfile = null;
        state.sharedProfileError =
          action.payload?.message || "This share is no longer available";
      });
  },
});

export const { clearSharedProfile } = shareProfileSlice.actions;
export default shareProfileSlice.reducer;
