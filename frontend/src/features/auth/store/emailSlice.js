import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { verificationService } from "@features/auth/api/VerificationService";

const initialState = {
  isLoading: false,
  message: null,
  error: null
}

export const requestOTP = createAsyncThunk(
  "email/request-otp",
  async ({ email }, { rejectWithValue }) => {
    try {
      const { data, status } = await verificationService.sendEmailOtp({ email : email});
      return {data, status};
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error resend otp");
    }
  }
);

export const verifyOTP = createAsyncThunk(
  "email/verify-otp",
  async ({ oneTimePass, email }, { rejectWithValue }) => {
    try {
      const { data, status } = await verificationService.verifyEmailOtp({
          otp: oneTimePass,
          email: email,
        }
      );
      return {data, status};
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error resend otp");
    }
  }
);

export const resendOTP = createAsyncThunk(
  "email/resend-otp",
  async ({ email }, { rejectWithValue }) => {
    try {
      const { data } = await verificationService.resendEmailOtp({email : email});
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error resend otp");
    }
  }
);

const emailSlice = createSlice({
  name: 'sms',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(requestOTP.pending, state => {
        state.isLoading = true
      })
      .addCase(requestOTP.fulfilled, (state, action) => {
        state.isLoading = false
        state.message = action.payload.message
      })
      .addCase(requestOTP.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload || 'Error while requesting otp'
      })

      .addCase(verifyOTP.pending, state => {
        state.isLoading = true
      })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false
        state.message = action.payload.message 
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload || 'Error while verifying otp'
      })

    .addCase(resendOTP.pending, (state) => {
      state.isLoading = true;
    })
    .addCase(resendOTP.fulfilled, (state, action) => {
      state.isLoading = false;
       state.message = action.payload.message 
    })
    .addCase(resendOTP.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || "Error while resending otp";
    });

  }
})

export default emailSlice.reducer

