import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authService } from "@features/auth/api/AuthService";
import {
  getStoredReferralCode,
  clearStoredReferralCode,
} from "@features/referral/referral";
import { getMyReferralThunk } from "@features/referral/store/referralSlice";

const initialState = {
  isLoading: false,
  user: {
    _id: "",
    name: "",
    email: "",
    phoneNo: "",
    zipCode: "",
    additionalInfo: [],
    type: "", // Adjust as per your UserType definitions
    dob: new Date(0),
    imageUrl: "",
    location: "",
    favourite: [],
    verified: {},
    reviews: {},
    averageRating: "",
    notifications: {},
    services: [],
    aboutMe: "",
    noOfChildren: {},
  },
  // In memory only, and deliberately not in the persist whitelist — see the
  // note in @app/store. A reload starts here and trades the httpOnly refresh
  // cookie for a new one.
  accessToken: null,
  accessTokenExpiry: null,
  // The refresh token itself is NOT here and must not be: it lives in a cookie
  // this code cannot read. Its expiry is not a credential and is kept, because
  // it is what tells the app how long the session has left.
  refreshTokenExpiry: null,
};

// Thunks for login, register, and refresh token
export const loginThunk = createAsyncThunk(
  "auth/login",
  async (body, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.login(body);
      // Ensure your data structure matches this
      return {
        user: data.user,
        accessToken: data.accessToken,
        accessTokenExpiry: data.accessTokenExpiry,
        refreshTokenExpiry: data.refreshTokenExpiry,
        status,
      };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (body, { rejectWithValue }) => {
    try {
      // The referral code is attached here rather than at the ~20 call sites
      // that dispatch this thunk — every onboarding flow, job form and hire
      // form registers through it, and threading a code through all of them
      // would guarantee some path silently drops it.
      const referredByCode = getStoredReferralCode();
      const payload = referredByCode ? { ...body, referredByCode } : body;

      const { data, status } = await authService.register(payload);

      // Consume the code on success only — a failed attempt (duplicate email,
      // network drop) is usually retried straight after, and the code needs to
      // survive to that retry.
      if (referredByCode) clearStoredReferralCode();
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);
export const userCheckThunk = createAsyncThunk(
  "auth/user-check",
  async (body, { rejectWithValue }) => {
    try {
      const { status } = await authService.checkUser(body);
      return { status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);
/**
 * The refresh call currently in flight, if any.
 *
 * Every caller shares one request, and this is load-bearing rather than an
 * optimisation. Refreshing ROTATES the token: the server swaps the stored row
 * for a new one, so the token the second of two concurrent calls presents has
 * already been replaced by the time it arrives and comes back 401 — which the
 * response interceptor reads as "this session is over" and signs the member
 * out.
 *
 * That was survivable while a refresh only happened on expiry. It is not now:
 * a reload restores the session, and the nine components that dispatch this
 * thunk on mount would each start their own.
 */
let inFlightRefresh = null;

const refreshOnce = () => {
  if (!inFlightRefresh) {
    inFlightRefresh = authService.refreshToken();
    // Cleared however it settles, so the next refresh starts a new request
    // rather than re-awaiting a stale result. Both branches are handled here,
    // which also means the shared promise never counts as unhandled.
    const release = () => {
      inFlightRefresh = null;
    };
    inFlightRefresh.then(release, release);
  }

  return inFlightRefresh;
};

export const refreshTokenThunk = createAsyncThunk(
  "auth/refresh-token",
  async (_, { rejectWithValue }) => {
    try {
      // No argument: the refresh token is in an httpOnly cookie the browser
      // attaches itself, and this code has no copy of it to pass.
      const { data, status } = await refreshOnce();
      return {
        user: data.user,
        accessToken: data.accessToken,
        accessTokenExpiry: data.accessTokenExpiry,
        refreshTokenExpiry: data.refreshTokenExpiry,
        status,
      };
    } catch (error) {
      // `httpStatus` is added alongside the server's own payload rather than
      // merged into it: several endpoints return their own `status` field, and
      // overwriting that would change what existing callers read. The session
      // restore needs to tell "no session" (401) from "the network is down",
      // which the body alone cannot say.
      return rejectWithValue({
        ...(error.response?.data ?? {}),
        httpStatus: error.response?.status,
      });
    }
  }
);

/**
 * Sign out, on the server as well as here.
 *
 * A client-side logout is no longer enough to end a session: the refresh token
 * is in an httpOnly cookie, so clearing Redux and purging localStorage leaves
 * the browser holding a credential good for another seven days. The server call
 * is what deletes the stored session and clears the cookie.
 *
 * It never rejects. Signing out has to succeed from the member's point of view
 * whether or not the network cooperates — the local session is cleared either
 * way, and a failed request must not leave someone stuck signed in.
 */
export const logoutThunk = createAsyncThunk("auth/logout", async () => {
  try {
    await authService.logout();
  } catch (error) {
    console.error("[auth] sign-out request failed; clearing local session anyway", error);
  }
});

export const editUserThunk = createAsyncThunk(
  "auth/editUser",
  async (userData, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.editUser(userData);
      return {
        user: data.user,
        status,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error editing user data");
    }
  }
);

export const updateNannyProfileThunk = createAsyncThunk(
  "auth/updateNannyProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.updateNannyProfile(profileData);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error updating nanny profile");
    }
  }
);

export const verifyUserThunk = createAsyncThunk(
  "auth/verifyUser",
  async (userData, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.verifyUser(userData);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// `verifyCriminalRecordThunk` used to sit here, POSTing to
// /verify/criminal-record. Nothing dispatched it and the server serves only
// /verify, /verify/:id and /verify/unverify/:id — so the route never existed.

export const sendOtpThunk = createAsyncThunk(
  "auth/send-otp",
  async (_, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.sendOtp();
      return {
        data,
        status,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error sending otp");
    }
  }
);

export const verifyOtpThunk = createAsyncThunk(
  "auth/verify-otp",
  async (oneTimePass, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.verifyOtp(oneTimePass);
      return {
        data,
        status,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error verify otp");
    }
  }
);

export const resendOtpThunk = createAsyncThunk(
  "auth/resend-otp",
  async (_, { rejectWithValue }) => {
    try {
      const { data, status } = await authService.resendOtp();
      return {
        data,
        status,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Error resend otp");
    }
  }
);

export const deleteUserThunk = createAsyncThunk(
  "auth/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      // `/userData/users/:id`, not `/user/:id` — the latter has never existed,
      // so every "delete my account" confirmation 404'd and the modal's
      // .catch() swallowed it to the console. The account was not deleted and
      // the member was told nothing.
      const { data, status } = await authService.deleteUser(userId);
      return { status, message: data.message };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to delete user");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = initialState.user;
      state.accessToken = initialState.accessToken;
      state.accessTokenExpiry = initialState.accessTokenExpiry;
      state.refreshTokenExpiry = initialState.refreshTokenExpiry;
    },
    setNannyProfileCompleted: (state) => {
      state.user.nannyProfileCompleted = true;
    },
    increaseMatchRequestSent: (state) => {
      state.user.matchRequestsSent++;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (
          action.payload.user.type === "Parents" ||
          action.payload.user.type === "Nanny"
        ) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.accessTokenExpiry = action.payload.accessTokenExpiry;
          state.refreshTokenExpiry = action.payload.refreshTokenExpiry;
        }
      })

      .addCase(loginThunk.rejected, (state) => {
        state.isLoading = false;
      })
      // Register
      .addCase(registerThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(registerThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(registerThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(userCheckThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(userCheckThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(userCheckThunk.rejected, (state) => {
        state.isLoading = false;
      })
      // Refresh Token
      .addCase(refreshTokenThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.accessTokenExpiry = action.payload.accessTokenExpiry;
        state.refreshTokenExpiry = action.payload.refreshTokenExpiry;
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(editUserThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(editUserThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user; // Update the user data in the state
      })
      .addCase(editUserThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(updateNannyProfileThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateNannyProfileThunk.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateNannyProfileThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(verifyUserThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyUserThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user.verified.nationalIDVer = action.payload.data.data; // Update the user data in the state
      })
      .addCase(verifyUserThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(sendOtpThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(sendOtpThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(sendOtpThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(verifyOtpThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyOtpThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(verifyOtpThunk.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(resendOtpThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(resendOtpThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(resendOtpThunk.rejected, (state) => {
        state.isLoading = false;
      })
      // Both outcomes clear the session: the thunk swallows a failed request on
      // purpose (see above), and a member who asked to sign out must end up
      // signed out locally regardless of what the network did.
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = initialState.user;
        state.accessToken = null;
        state.accessTokenExpiry = null;
        state.refreshTokenExpiry = null;
      })
      .addCase(logoutThunk.rejected, (state) => {
        state.user = initialState.user;
        state.accessToken = null;
        state.accessTokenExpiry = null;
        state.refreshTokenExpiry = null;
      })

      .addCase(deleteUserThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteUserThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.user = initialState.user;
        state.accessToken = null;
        state.accessTokenExpiry = null;
        state.refreshTokenExpiry = null;
      })
      .addCase(deleteUserThunk.rejected, (state) => {
        state.isLoading = false;
      })

      // Referral fields ride along on the user object (login and token refresh
      // both spread the whole document), and Config/matchGate.js reads
      // referralMatchingUntil from there to decide whether a caregiver may
      // still match. That copy only refreshes with the access token — up to two
      // hours — so a caregiver whose friend just signed up would keep hitting
      // the wall they've already cleared. /referral/me returns the live values,
      // so fold them back in wherever it's fetched.
      .addCase(getMyReferralThunk.fulfilled, (state, action) => {
        const { code, referralCount, matchingUntil } = action.payload || {};
        state.user.referralCode = code;
        state.user.referralCount = referralCount;
        state.user.referralMatchingUntil = matchingUntil;
      });

  },
});

export const { logout, setNannyProfileCompleted, increaseMatchRequestSent } = authSlice.actions;

export default authSlice.reducer;
