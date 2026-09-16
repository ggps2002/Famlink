import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { chatService } from "@features/chat/api/ChatService";

export const getChatsThunk = createAsyncThunk(
  "chat/get-all",
  async (_, { rejectWithValue }) => {
    try {
      const { data, status } = await chatService.conversations();
      return { data, status };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getChatByIdThunk = createAsyncThunk(
  "chat/get-by-id",
  async ({ chatId, userId }, { rejectWithValue }) => {
    try {
      const { data, status } = await chatService.messages(chatId, userId);
      return { data, status };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createChatThunk = createAsyncThunk(
  "chat/create-chat",
  async ({ participants }, { rejectWithValue }) => {
    try {
      // Log request data
      const { data, status } = await chatService.createConversation({
        participants,
      });
      return { data, status };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteChatThunk = createAsyncThunk(
  "chat/delete-chat",
  async (chatId, { rejectWithValue }) => {
    try {
      const { data, status } = await chatService.deleteConversation(chatId);
      return { data, status }; // Return the response data
    } catch (error) {
      return rejectWithValue(error.response.data); // Handle error
    }
  }
);

const initialState = {
  isLoading: false,
  chatList: [],
  chatDetails: null,
  messages: [],
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // action.payload: array of messages (snapshot from "previousMessages").
    // Dedupes by _id defensively in case the server snapshot itself
    // contains a repeat (e.g. due to a socket reconnect re-emit).
    setMessages: (state, action) => {
      const incomingMessages = action.payload ?? [];
      const seen = new Set();
      state.messages = incomingMessages.filter((msg) => {
        if (!msg?._id) return true;
        if (seen.has(msg._id)) return false;
        seen.add(msg._id);
        return true;
      });
    },
    pushMessage: (state, action) => {
      const exists = state.messages.find(
        (msg) => msg._id === action.payload._id
      );
      if (!exists) {
        const message = action.payload;
        state.messages.push(message);
        const chatList = [...state.chatList];
        state.chatList = chatList.map((chat) =>
          chat._id !== message.chatId
            ? chat
            : {
                ...chat,
                lastMessage: message.content,
              }
        );
      }
    },
    increaseUnReadMessages: (state, action) => {
      const message = action.payload;
      const chatList = [...state.chatList];
      state.chatList = chatList.map((chat) =>
        chat._id !== message.chatId
          ? chat
          : {
              ...chat,
              unReadMessages: chat.unReadMessages + 1,
              lastMessage: message.content,
            }
      );
    },
    markMessagesAsRead: (state, action) => {
      const chatId = action.payload;
      const chatList = [...state.chatList];
      state.chatList = chatList.map((chat) =>
        chat._id !== chatId
          ? chat
          : {
              ...chat,
              unReadMessages: 0,
            }
      );
    },
    closeChat: (state) => {
      state.messages = [];
      state.chatDetails = null;
    },
    updateUserOnlineStatus: (state, action) => {
      const { userId, online } = action.payload;
      state.chatList = state.chatList.map((chat) =>
        chat.otherParticipant?._id?.toString() === userId
          ? { ...chat, otherParticipant: { ...chat.otherParticipant, online } }
          : chat
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // Chats
      .addCase(getChatsThunk.pending, (state) => {
        // state.isLoading = true;
      })
      .addCase(getChatsThunk.rejected, (state) => {
        // state.isLoading = false;
      })
      .addCase(getChatsThunk.fulfilled, (state, action) => {
        // state.isLoading = false;
        state.chatList = action.payload.data;
      })

      .addCase(createChatThunk.pending, (state) => {
        // state.isLoading = true;
      })
      .addCase(createChatThunk.rejected, (state) => {
        // state.isLoading = false;
      })
      .addCase(createChatThunk.fulfilled, (state, action) => {
        // state.isLoading = false;
      })

      .addCase(getChatByIdThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getChatByIdThunk.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(getChatByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.chatDetails = action.payload.data;
      })

      .addCase(deleteChatThunk.pending, (state) => {
        // state.isLoading = true; // Set loading state
      })
      .addCase(deleteChatThunk.fulfilled, (state, action) => {
        // state.isLoading = false;
      })
      .addCase(deleteChatThunk.rejected, (state) => {
        // state.isLoading = false; // Reset loading state on error
      });
  },
});

export const {
  setMessages,
  pushMessage,
  increaseUnReadMessages,
  markMessagesAsRead,
  closeChat,
  updateUserOnlineStatus,
} = chatSlice.actions;

export default chatSlice.reducer;