import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  value: {
    nanny: true,
    privateEducator: false,
    specializedCaregiver: false,
    sportsCoaches: false,
    musicInstructor: false,
    swimInstructor: false,
    houseManager: false,
  },
};

export const additionalServicesSlice = createSlice({
  name: 'additionalSer',
  initialState,
  reducers: {
    // Set additional services
    setAddSer: (state, action) => {
      // Loop through payload and update existing fields
      Object.keys(action.payload).forEach((key) => {
        if (key in state.value) {
          state.value[key] = action.payload[key]; // Update the value if it exists in the state
        }
      });
    },
  },
});

// Action creators are generated for each case reducer function
export const { setAddSer } = additionalServicesSlice.actions;

export default additionalServicesSlice.reducer;
