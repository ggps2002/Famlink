import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [],
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action) => {
      state.notifications = action.payload;
    },
    updateNotification: (state, action) => {
      const newNotif = action.payload;
      const exists = state.notifications.find(n => n._id === newNotif._id);
      if (!exists) {
        state.notifications.unshift(newNotif); // Add to top
      }
    },
    markNotificationAsSeen: (state, action) => {
      const id = action.payload;
      const notif = state.notifications.find(n => n._id === id);
      if (notif) {
        notif.seen = true;
      }
    },
  },
});

export const { addNotification, updateNotification, markNotificationAsSeen } =
  notificationSlice.actions;

export const selectUnseenCount = (state) =>
  state.notifications.notifications.filter((n) => !n.seen).length;

export default notificationSlice.reducer;
