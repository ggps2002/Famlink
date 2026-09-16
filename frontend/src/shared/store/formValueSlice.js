import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  name: '',
  email: '',
  password: '',
  imageFile: null,
  dob: '',
  zipCode: '',
  location: '',
  additionalInfo: [], // Array of objects for additional info
};

const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    updateForm: (state, action) => {
      return { ...state, ...action.payload }; // Update entire form state
    },
    resetForm: (state) => {
      return initialState; // Reset to initial state
    },
    addOrUpdateAdditionalInfo: (state, action) => {
      const { key, value } = action.payload; // Assume payload contains { key, value }

      // Check if an object with the same key already exists
      const existingIndex = state.additionalInfo.findIndex(info => info.key === key);

      if (existingIndex !== -1) {
        // If it exists, update the existing value
        state.additionalInfo[existingIndex].value = value;
      } else {
        // If it does not exist, add the new object
        state.additionalInfo.push({ key, value });
      }
    },
  },
});

export const { updateForm, resetForm, addOrUpdateAdditionalInfo } = formSlice.actions;
export default formSlice.reducer;
