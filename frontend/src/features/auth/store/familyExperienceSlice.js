// familyExpSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    familyExp: [], // Initialize as an empty array
};

const familyExpSlice = createSlice({
    name: 'familyExp',
    initialState,
    reducers: {
        updateFamilyExp: (state, action) => {
            state.familyExp.push(action.payload.values); // Push the new values to the array
        },
        clearFamilyExp: (state) => {
            state.familyExp = []; // Clear all values
        },
    },
});

export const { updateFamilyExp, clearFamilyExp } = familyExpSlice.actions;
export default familyExpSlice.reducer;
