import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { ChatService } from "./chat.service.js";
import { chatRepository } from "./chat.repository.js";
import { userRepository } from "../user/user.repository.js";
import Notification from "../notification/notification.model.js";

export const notificationRepository = new BaseRepository(Notification);

/**
 * Responses here are bare — a chat object or an array, not wrapped in `data`.
 * Preserved: the chat screen reads them at the top level.
 */
class ChatController extends BaseController {
  constructor({ chatService }) {
    super();
    this.chatService = chatService;
  }

  async list(req, res) {
    return this.ok(res, await this.chatService.listFor(req.userId));
  }

  async open(req, res) {
    const { chat, created } = await this.chatService.open({
      userId: req.userId,
      participants: req.body.participants,
    });

    return res.status(created ? 201 : 200).json(chat);
  }

  async read(req, res) {
    const chat = await this.chatService.read({
      callerId: req.userId,
      chatId: req.params.id,
      userId: req.params.userId,
    });

    return this.ok(res, chat);
  }

  async update(req, res) {
    const chat = await this.chatService.update({
      userId: req.userId,
      chatId: req.params.id,
      participants: req.body.participants,
    });

    return this.ok(res, chat);
  }

  async remove(req, res) {
    await this.chatService.remove({ userId: req.userId, chatId: req.params.id });
    return this.message(res, "Chat and related notifications deleted successfully.");
  }
}

export class ChatModule extends RouteModule {
  static basePath = "/chats";
  static moduleName = "chats";

  registerRoutes(router) {
    const controller = new ChatController({
      chatService: new ChatService({ chatRepository, userRepository, notificationRepository }),
    });

    router.use(authenticate);

    router.get("/", controller.list);
    router.post("/", controller.open);
    router.get("/:id/:userId", controller.read);
    router.put("/:id", controller.update);
    router.delete("/:id", controller.remove);
  }
}

export default ChatModule;
