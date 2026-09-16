import { HttpService } from "@shared/api/HttpService";

/**
 * Conversation list and history. Messages themselves arrive over the socket
 * (see @shared/realtime) — these are the REST calls around it.
 */
export class ChatService extends HttpService {
  conversations() {
    return this.get("/chats");
  }

  /** History for one conversation, scoped to the reader so reads can be marked. */
  messages(chatId, userId) {
    return this.get(`/chats/${chatId}/${userId}`);
  }

  createConversation(body) {
    return this.post("/chats", body);
  }

  deleteConversation(chatId) {
    return this.delete(`/chats/${chatId}`);
  }
}

export const chatService = new ChatService();
export default chatService;
