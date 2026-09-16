import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { reportService } from "@features/matching/api/ReportService";

// Reporting another member, from the chat header.
//
// Kept as its own slice rather than folded into matchSlice because blocking and
// reporting are different acts that happen to sit next to each other in the UI:
// blocking is a change to your own experience and takes effect immediately;
// reporting asks someone else to look at something and takes effect when they
// do. Sharing loading state between them would mean one spinner for two
// unrelated outcomes.

const initialState = {
  isSubmitting: false,
  // Keyed by the reported user's id: { reported: boolean, reportedAt: string }.
  // A map rather than a single flag because ChatView stays mounted while the
  // selected contact changes underneath it — a single boolean would carry the
  // "Reported" state from one conversation into the next.
  reportedUsers: {},
};

export const reportUserThunk = createAsyncThunk(
  "reportUser",
  async ({ reportedUserId, reason, details, messageId, chatId }, { rejectWithValue }) => {
    try {
      const { data } = await reportService.submit({
        reportedUserId,
        reason,
        details,
        messageId,
        chatId,
      });
      return { ...data, reportedUserId };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: "Could not submit the report" }
      );
    }
  }
);

// Whether the signed-in user has already reported someone. Drives the header
// showing "Reported" rather than a button after a refresh.
export const getReportStatusThunk = createAsyncThunk(
  "getReportStatus",
  async ({ userId }, { rejectWithValue }) => {
    try {
      const { data } = await reportService.status({ params: { userId } });
      return { userId, ...data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: "Could not check report status" }
      );
    }
  }
);

const reportSlice = createSlice({
  name: "report",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(reportUserThunk.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(reportUserThunk.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.reportedUsers[action.payload.reportedUserId] = {
          reported: true,
          reportedAt: new Date().toISOString(),
        };
      })
      .addCase(reportUserThunk.rejected, (state) => {
        state.isSubmitting = false;
      })
      .addCase(getReportStatusThunk.fulfilled, (state, action) => {
        state.reportedUsers[action.payload.userId] = {
          reported: action.payload.reported,
          reportedAt: action.payload.reportedAt,
        };
      });
  },
});

export default reportSlice.reducer;
