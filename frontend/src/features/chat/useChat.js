import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  closeChat,
  createChatThunk,
  getChatByIdThunk,
  getChatsThunk,
  increaseUnReadMessages,
  markMessagesAsRead,
  pushMessage,
  setMessages,
  updateUserOnlineStatus,
} from "@features/chat/store/chatSlice";
import useSocket from "@shared/realtime/useSocket";
import {
  setSelectedContact,
  updateSelectedContactOnlineStatus,
} from "@features/chat/store/selectedContactSlice";
import { fireToastMessage } from "@shared/ui/toast";

export const useChats = ({ chatId, data }) => {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const { socket } = useSocket();
  const { user } = useSelector((state) => state.auth);

  // Have we already fetched the chat list at least once this session?
  const hasFetchedChatList = useRef(false);
  // Which chatId we currently hold a joined socket room for. Prevents
  // re-emitting "joinChat" (and re-requesting a full history snapshot)
  // on every send, and prevents two effects from double-joining the
  // same chat on mount.
  const joinedChatIdRef = useRef(null);

  // Is the *other participant* in the currently open chat typing?
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  // Debounce/timeout handles for our own typing emits — not state,
  // doesn't need to trigger re-renders.
  const typingTimeoutRef = useRef(null);
  const isCurrentlyTypingRef = useRef(false);

  const { chatList, chatDetails, messages } = useSelector(
    (state) => state.chat
  );

  // Refs so listeners always read the *current* chatId / userId without
  // depending on stale closures. Updated synchronously on every render.
  const currentChatIdRef = useRef(chatId);
  currentChatIdRef.current = chatId;
  const currentUserIdRef = useRef(user?._id);
  currentUserIdRef.current = user?._id;

  const handleMarkMessagesAsSeen = useCallback(
    (chatId, userId) => {
      socket?.emit("messagesSeen", { chatId, userId });
    },
    [socket]
  );

  // Attach all socket listeners exactly once per socket instance.
  // socket.off(...) before socket.on(...) guarantees no duplicate
  // handlers stack up no matter how many times this is called.
  const attachSocketListeners = useCallback(() => {
    if (!socket) return;

    socket.off("previousMessages");
    socket.on("previousMessages", (msgs) => {
      dispatch(setMessages(msgs));
      const cid = currentChatIdRef.current;
      const uid = currentUserIdRef.current;
      if (cid && uid) handleMarkMessagesAsSeen(cid, uid);
    });

    socket.off("newMessage");
    socket.on("newMessage", (message) => {
      const cid = currentChatIdRef.current;
      const uid = currentUserIdRef.current;
      if (message.chatId === cid) {
        dispatch(pushMessage(message));
        handleMarkMessagesAsSeen(message.chatId, uid);
        if (message.sender?._id !== uid) setIsOtherUserTyping(false);
      } else if (message.sender?._id !== uid) {
        dispatch(increaseUnReadMessages(message));
      }
    });

    socket.off("messagesSeen");
    socket.on("messagesSeen", (seenChatId) => {
      dispatch(markMessagesAsRead(seenChatId));
    });

    // Refs ensure the correct chatId is always checked even if this
    // callback was created when a different chat was open.
    socket.off("userTyping");
    socket.on("userTyping", ({ chatId: typingChatId, userId }) => {
      if (typingChatId !== currentChatIdRef.current) return;
      if (userId === currentUserIdRef.current) return;
      setIsOtherUserTyping(true);
    });

    socket.off("userStoppedTyping");
    socket.on("userStoppedTyping", ({ chatId: typingChatId, userId }) => {
      if (typingChatId !== currentChatIdRef.current) return;
      if (userId === currentUserIdRef.current) return;
      setIsOtherUserTyping(false);
    });

  }, [socket, dispatch, handleMarkMessagesAsSeen]);

  // Join a chat room + fetch its details. Only emits "joinChat" the
  // first time a given chatId is selected — switching back to an
  // already-joined chat won't re-trigger a snapshot fetch, and calling
  // this twice in a row for the same chatId (e.g. from two effects on
  // mount) is a no-op the second time.
  const handleGetChatDetailsById = useCallback(
    async (targetChatId) => {
      if (!targetChatId || !socket || !user?._id) return;

      attachSocketListeners();

      if (joinedChatIdRef.current !== targetChatId) {
        joinedChatIdRef.current = targetChatId;
        socket.emit("joinChat", { chatId: targetChatId });
      }

      try {
        await dispatch(getChatByIdThunk({ chatId: targetChatId, userId: user._id }));
      } catch (err) {
        console.error("Error fetching chat details:", err);
      }
    },
    [socket, user, dispatch, attachSocketListeners]
  );

  // Send a message. Never re-joins the room or re-requests history —
  // the new message comes back through the "newMessage" listener above
  // (pushMessage), which already updates chatList's lastMessage locally.
  //
  // THROWS when the server refuses the message, so the composer can put the
  // text back in the box. This used to be fire-and-forget: both emits shared
  // one `resolve`, so the promise settled on whichever fired first and the
  // result of the send was never read. A message the server rejected — for
  // breaking the content rules, or because the conversation was blocked —
  // simply vanished from the sender's screen with no explanation.
  const handleSendMessage = useCallback(
    async (content) => {
      if (!content) return;
      if (!socket) throw new Error("You're offline. Check your connection.");

      // Sending implies typing is over — clear any pending debounce and
      // tell the other side immediately rather than waiting it out.
      if (isCurrentlyTypingRef.current) {
        clearTimeout(typingTimeoutRef.current);
        isCurrentlyTypingRef.current = false;
        if (content.chatId && user?._id) {
          socket.emit("stopTyping", { chatId: content.chatId, userId: user._id });
        }
      }

      const result = await new Promise((resolve) => {
        // A dropped connection means the ack never arrives and the composer
        // stays disabled forever. Settle it ourselves after 15s and treat that
        // as a failure, which restores the text rather than losing it.
        const timeout = setTimeout(
          () => resolve({ ok: false, reason: "Message timed out. Please try again." }),
          15000
        );
        socket.emit("sendMessage", { content }, (ack) => {
          clearTimeout(timeout);
          // An older server that doesn't acknowledge sends nothing. Treat a
          // missing ack as success so this doesn't break against one.
          resolve(ack ?? { ok: true });
        });
      });

      if (!result.ok) {
        const error = new Error(result.reason || "Message could not be sent.");
        error.code = result.code;
        throw error;
      }

      // Only now: a notification for a message that was never delivered would
      // tell the recipient about something they cannot open.
      socket.emit("sendNotification", { content: { ...content, type: "Message" } });
    },
    [socket, user]
  );

  // Call this from the input's onChange. Emits "typing" immediately on
  // the first keystroke, then auto-emits "stopTyping" after 2s of no
  // further calls — the standard chat-app debounce pattern, so we're
  // not emitting on every single keystroke.
  const emitTyping = useCallback(
    (targetChatId) => {
      if (!socket || !targetChatId || !user?._id) return;

      if (!isCurrentlyTypingRef.current) {
        isCurrentlyTypingRef.current = true;
        socket.emit("typing", { chatId: targetChatId, userId: user._id });
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isCurrentlyTypingRef.current = false;
        socket.emit("stopTyping", { chatId: targetChatId, userId: user._id });
      }, 2000);
    },
    [socket, user]
  );

  const handleCloseChat = useCallback(() => {
    joinedChatIdRef.current = null;
    clearTimeout(typingTimeoutRef.current);
    isCurrentlyTypingRef.current = false;
    setIsOtherUserTyping(false);
    dispatch(closeChat());
  }, [dispatch]);

  const handleSocketCleanUp = useCallback(() => {
    socket?.off("newMessage");
    socket?.off("previousMessages");
    socket?.off("messagesSeen");
    socket?.off("newNotification");
    socket?.off("userTyping");
    socket?.off("userStoppedTyping");
    socket?.off("userStatusChanged");
  }, [socket]);

  // Register userStatusChanged as soon as the socket is available so online
  // indicators update even before any chat is selected (attachSocketListeners
  // only runs when a chat is opened, which would miss earlier broadcasts).
  useEffect(() => {
    if (!socket) return;
    socket.off("userStatusChanged");
    socket.on("userStatusChanged", ({ userId, online }) => {
      dispatch(updateUserOnlineStatus({ userId, online }));
      dispatch(updateSelectedContactOnlineStatus({ userId, online }));
    });
    return () => {
      socket.off("userStatusChanged");
    };
  }, [socket, dispatch]);

  // Fetch the chat list once per user/socket session. This intentionally
  // does NOT depend on chatId — it only loads the sidebar list of chats,
  // it never joins a room itself.
  useEffect(() => {
    if (hasFetchedChatList.current) return;
    if (!user?._id || !socket) return;

    hasFetchedChatList.current = true;
    dispatch(getChatsThunk()).catch(() => {
      fireToastMessage({ message: "Error while retrieving chats", type: "error" });
    });

    return () => {
      handleSocketCleanUp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, socket, dispatch]);

  // The single source of truth for joining a chat room + loading its
  // messages. Runs whenever the selected chatId changes (including on
  // first mount/refresh with a contact pre-selected via the URL/Redux),
  // so there's no dependency on the chat-list effect above having run
  // first, and no second effect racing it.
  useEffect(() => {
    if (!chatId || !socket || !user?._id) return;

    // Switching contacts — any typing indicator left over from the
    // previous chat is no longer relevant.
    setIsOtherUserTyping(false);

    let isCancelled = false;
    setIsLoading(true);
    handleGetChatDetailsById(chatId).finally(() => {
      if (!isCancelled) setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, socket, user?._id]);

  // Handles the "no chatId yet, but we have a brand-new contact to
  // create a chat for" flow. Separate from the join effect above so it
  // only ever runs when there is genuinely nothing to join.
  useEffect(() => {
    if (chatId) return; // a real chat is selected — nothing to create
    if (!user?._id || !socket) return;
    if (!data || data?._id != null) {
      // No pending "new chat" request — just make sure we're not stuck
      // showing a stale chat view.
      handleCloseChat();
      return;
    }

    const createAndJoin = async () => {
      try {
        if (!data?.otherParticipant?._id) {
          throw new Error("Other participant ID is missing.");
        }
        const participants = [data.otherParticipant._id, user._id];
        const { data: newChatData } = await dispatch(
          createChatThunk({ participants })
        ).unwrap();

        if (!newChatData?._id) {
          throw new Error("New chat ID is missing.");
        }

        const { data: updatedChats } = await dispatch(getChatsThunk()).unwrap();
        dispatch(setSelectedContact(updatedChats[updatedChats.length - 1]));
        handleGetChatDetailsById(newChatData._id);
      } catch (error) {
        console.error("Error creating or fetching chat:", error);
      }
    };

    createAndJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, data, user?._id, socket]);

  return {
    chatList,
    chatDetails,
    messages,
    handleSendMessage,
    handleCloseChat,
    isLoading,
    isOtherUserTyping,
    emitTyping,
  };
};