import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { BaseRepository } from "../../core/database/BaseRepository.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { MessageService } from "./message.service.js";
import { chatRepository } from "./chat.repository.js";
import { guardOutgoingMessage, attachFlagToMessage } from "./messageGuard.js";
import Message from "./message.model.js";

export const messageRepository = new BaseRepository(Message);

/** Bare message objects, not wrapped in `data` — preserved from the original. */
class MessageController extends BaseController {
  constructor({ messageService }) {
    super();
    this.messageService = messageService;
  }

  async send(req, res) {
    const message = await this.messageService.send({ userId: req.userId, ...req.body });
    return res.status(201).json(message);
  }

  async read(req, res) {
    const message = await this.messageService.read({
      userId: req.userId,
      messageId: req.params.id,
    });
    return this.ok(res, message);
  }

  async update(req, res) {
    const message = await this.messageService.update({
      userId: req.userId,
      messageId: req.params.id,
      ...req.body,
    });
    return this.ok(res, message);
  }

  async remove(req, res) {
    await this.messageService.remove({ userId: req.userId, messageId: req.params.id });
    return this.message(res, "Message deleted successfully");
  }
}

export class MessageModule extends RouteModule {
  static basePath = "/message";
  static moduleName = "message";

  registerRoutes(router) {
    const controller = new MessageController({
      messageService: new MessageService({
        messageRepository,
        chatRepository,
        guardOutgoingMessage,
        attachFlagToMessage,
      }),
    });

    router.use(authenticate);

    router.post("/", controller.send);
    router.get("/:id", controller.read);
    router.put("/:id", controller.update);
    router.delete("/:id", controller.remove);
  }
}

export default MessageModule;
