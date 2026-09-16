import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { passwordResetService } from "@features/auth/api/PasswordResetService";

const initialState = {
  isLoading: false,
}

// The OTP-based reset thunks that lived here (sendOtpThunk / verifyOtpThunk,
// posting to /auth/forgot-password and /auth/reset-password) were removed with
// the routes behind them — the server matched on the code alone, so a guessed
// code reset an arbitrary account. Nothing rendered them. The email-verification
// OTP is a different thing and lives in authSlice. See SECURITY.md.

// Link-based password reset: request the branded reset email (template 10).
export const requestPasswordResetThunk = createAsyncThunk(
  'auth/request-password-reset',
  async ({ email }, { rejectWithValue }) => {
    try {
      const { data, status } = await passwordResetService.requestReset({
        email,
      })
      return { data, status }
    } catch (error) {
      return rejectWithValue(
        error.response?.data || 'Error requesting password reset'
      )
    }
  }
)

// Link-based password reset: consume the emailed token and set a new password.
export const resetPasswordWithTokenThunk = createAsyncThunk(
  'auth/reset-password-token',
  async ({ email, token, newPassword }, { rejectWithValue }) => {
    try {
      const { data, status } = await passwordResetService.resetWithToken({
        email,
        token,
        newPassword,
      })
      return { data, status }
    } catch (error) {
      return rejectWithValue(
        error.response?.data || 'Error resetting password'
      )
    }
  }
)

export const resendOtpThunk = createAsyncThunk(
  'auth/email-resend-otp',
  async (email, { rejectWithValue }) => {
    try {
      const { data, status } = await passwordResetService.resendEmailOtp(email)

      return {
        data,
        status
      }
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Error resend otp')
    }
  }
)
const authSlice = createSlice({
  name: 'auth',
  initialState,
  extraReducers: builder => {
    builder
      // The sendOtpThunk / verifyOtpThunk cases were removed with the thunks
      // themselves — see the note above.

      .addCase(resendOtpThunk.pending, state => {
        state.isLoading = true
      })
      .addCase(resendOtpThunk.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(resendOtpThunk.rejected, state => {
        state.isLoading = false
      })

      .addCase(requestPasswordResetThunk.pending, state => {
        state.isLoading = true
      })
      .addCase(requestPasswordResetThunk.fulfilled, state => {
        state.isLoading = false
      })
      .addCase(requestPasswordResetThunk.rejected, state => {
        state.isLoading = false
      })

      .addCase(resetPasswordWithTokenThunk.pending, state => {
        state.isLoading = true
      })
      .addCase(resetPasswordWithTokenThunk.fulfilled, state => {
        state.isLoading = false
      })
      .addCase(resetPasswordWithTokenThunk.rejected, state => {
        state.isLoading = false
      })
  }
})

export default authSlice.reducer
