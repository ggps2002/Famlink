import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { accountSettingsService } from "@features/dashboard/api/AccountSettingsService";

const initialState = {
  isLoading: false,
};

export const updateEmailThunk = createAsyncThunk(
  "update/email",
  async ({ currentEmail, newEmail }, { rejectWithValue }) => {
    try {
      const { data, status } = await accountSettingsService.updateEmail({ currentEmail, newEmail });

      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error updating email");
    }
  }
);

export const updatePasswordThunk = createAsyncThunk(
  "update/password",
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const { data, status } = await accountSettingsService.updatePassword({ currentPassword, newPassword });

      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error updating password");
    }
  }
);

export const updateTextNotifThunk = createAsyncThunk(
  "update/text-notifications",
  async ({ sms }, { rejectWithValue }) => {
    try {
      const { data, status } = await accountSettingsService.updateTextNotifications({ sms });
      return {data, status};
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Error updating text notifications"
      );
    }
  }
);

export const updatePhoneThunk = createAsyncThunk(
  "update/phone",
  async ({ phoneNo }, { rejectWithValue }) => {
    try {
      const { data, status } = await accountSettingsService.updatePhone({ phoneNo : phoneNo });

      return { data, status };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Error updating phone number"
      );
    }
  }
);

export const updateEmailNotiThunk = createAsyncThunk(
  "update/email-notifications",
  async ({ emailNotification }, { rejectWithValue }) => {
    try {
      // Convert object to array of enabled keys
      const enabledKeys = Object.keys(emailNotification).filter(
        (key) => emailNotification[key] === true
      );

      const { data, status } = await accountSettingsService.updateEmailNotifications({ notifications: enabledKeys });

      return { data, status };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Error updating email-notifications"
      );
    }
  }
);

const updateSlice = createSlice({
  name: "update",
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(updateEmailThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateEmailThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(updateEmailThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(updatePasswordThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updatePasswordThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(updatePasswordThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(updatePhoneThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updatePhoneThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(updatePhoneThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(updateEmailNotiThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateEmailNotiThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(updateEmailNotiThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(updateTextNotifThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateTextNotifThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(updateTextNotifThunk.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export default updateSlice.reducer;
