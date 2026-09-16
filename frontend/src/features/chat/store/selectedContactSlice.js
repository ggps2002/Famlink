// redux/contactSlice.js
import { createSlice } from '@reduxjs/toolkit';

const contactSlice = createSlice({
  name: 'contact',
  initialState: {
    selectedContact: null, // Initial state
  },
  reducers: {
    setSelectedContact: (state, action) => {
      state.selectedContact = action.payload;
    },
    clearSelectedContact: (state) => {
      state.selectedContact = null;
    },
    updateSelectedContactOnlineStatus: (state, action) => {
      const { userId, online } = action.payload;
      if (state.selectedContact?.otherParticipant?._id?.toString() === userId) {
        state.selectedContact = {
          ...state.selectedContact,
          otherParticipant: { ...state.selectedContact.otherParticipant, online },
        };
      }
    },
  },
});

export const { setSelectedContact, clearSelectedContact, updateSelectedContactOnlineStatus } = contactSlice.actions;
export default contactSlice.reducer;