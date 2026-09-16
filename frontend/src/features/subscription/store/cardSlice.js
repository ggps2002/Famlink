import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { paymentService } from "@features/subscription/api/PaymentService";
import "dotenv";

const initialState = {
  isLoading: false,
  data: [],
  subscriptionStatus: {
    active: true,
    cancelAtPeriodEnd: true,
    periodEnd: 1755998400,
    plan: "nanny_premium",
  },
};
export const saveCardThunk = createAsyncThunk(
  "auth/saveCard",
  async (paymentMethod, { rejectWithValue }) => {
    try {
      const { data, status } = await paymentService.saveCard({ paymentMethod });
      return { data, status }; // Return the response data
    } catch (error) {
      return rejectWithValue(error.response.data); // Handle error
    }
  }
);

export const getSaveCardThunk = createAsyncThunk(
  "auth/getSaveCard",
  async (_, { rejectWithValue }) => {
    try {
      const { data, status } = await paymentService.savedCards();
      return { data, status }; // Return the response data
    } catch (error) {
      return rejectWithValue(error.response.data); // Handle error
    }
  }
);

export const deleteCardThunk = createAsyncThunk(
  "auth/deleteCard",
  async (paymentMethodId, { rejectWithValue }) => {
    try {
      const { data, status } = await paymentService.deleteCard(paymentMethodId);
      return { data, status }; // Return the response data
    } catch (error) {
      console.error("Error deleting card:", error.message);
      return rejectWithValue(error.response.data); // Handle error
    }
  }
);

// `processWebhook` used to live here: a thunk that POSTed a Stripe event to
// /payment/stripe/webhook from the browser. Nothing dispatched it, the server
// has no such route, and a webhook is server-to-server by definition — Stripe
// signs the request and calls the backend directly. Removed along with
// `createPaymentThunk`, both leftovers of the embedded-Elements checkout that
// createCheckoutThunk replaced.

export const createSubscriptionThunk = createAsyncThunk(
  "auth/createSubscription",
  async ({ paymentMethodId, priceId }, { rejectWithValue }) => {
    try {
      const { data } = await paymentService.createSubscription({ paymentMethodId, planPriceId: priceId });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const getSubscriptionStatusThunk = createAsyncThunk(
  "card/getSubscriptionStatus",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await paymentService.subscriptionStatus();
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch subscription"
      );
    }
  }
);

export const confirmCheckoutThunk = createAsyncThunk(
  "card/confirmCheckout",
  async ({ sessionId }, { rejectWithValue }) => {
    try {
      const { data } = await paymentService.confirmCheckout(sessionId);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Could not confirm the payment");
    }
  }
);

export const cancelSubscriptionThunk = createAsyncThunk(
  "auth/cancelSubscription",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await paymentService.cancelSubscription({});
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);


export const createCheckoutThunk = createAsyncThunk(
  "auth/createCheckout",
  async ({ priceId }, { rejectWithValue }) => {
    try {
      const { data, status } = await paymentService.createCheckoutSession({
          priceId,
        }
      );

      return { data, status };
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const cardSlice = createSlice({
  name: "card",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(saveCardThunk.pending, (state) => {
        state.isLoading = true; // Set loading state
      })
      .addCase(saveCardThunk.fulfilled, (state, action) => {
        state.isLoading = false; // Reset loading state
      })
      .addCase(saveCardThunk.rejected, (state) => {
        state.isLoading = false; // Reset loading state on error
      })

      .addCase(getSaveCardThunk.pending, (state) => {
        state.isLoading = true; // Set loading state
      })
      .addCase(getSaveCardThunk.fulfilled, (state, action) => {
        state.isLoading = false; // Reset loading state
        state.data = action.payload.data;
      })
      .addCase(getSaveCardThunk.rejected, (state) => {
        state.isLoading = false; // Reset loading state on error
      })

      .addCase(deleteCardThunk.pending, (state) => {
        state.isLoading = true; // Set loading state
      })
      .addCase(deleteCardThunk.fulfilled, (state, action) => {
        state.isLoading = false;
      })
      .addCase(deleteCardThunk.rejected, (state) => {
        state.isLoading = false; // Reset loading state on error
      })

      .addCase(createSubscriptionThunk.fulfilled, (state, action) => {
        state.subscriptionStatus = {
          active: true,
          plan: action.payload?.plan || null, // you must return `plan` from backend
        };
        state.isLoading = false;
      })

      .addCase(getSubscriptionStatusThunk.fulfilled, (state, action) => {
        state.subscriptionStatus = {
          active: action.payload.active,
          cancelAtPeriodEnd: action.payload.cancelAtPeriodEnd,
          periodEnd: action.payload.periodEnd,
          plan: action.payload.plan,
        };
      });
  },
});

export default cardSlice.reducer;
