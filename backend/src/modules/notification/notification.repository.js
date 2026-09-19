import { BaseRepository } from "../../core/database/BaseRepository.js";
import Notification from "./notification.model.js";

/**
 * In-app notifications.
 *
 * Exists so the booking lifecycle can retract a notification it raised — a
 * withdrawn request should not leave "Send request" sitting in the other
 * party's list — without importing the model directly.
 */
export class NotificationRepository extends BaseRepository {
  constructor(model = Notification) {
    super(model);
  }

  /**
   * Remove the notification a booking action has just made untrue.
   *
   * Matched on the triple the original used — booking, the party it was raised
   * against, and the literal `content` string — because that string is how
   * these rows are distinguished; there is no type column to match on.
   */
  retract({ bookingId, senderId, receiverId, content }) {
    const filter = { bookingId, content };
    if (senderId) filter.senderId = senderId;
    if (receiverId) filter.receiverId = receiverId;
    return this.deleteOne(filter);
  }
}

export const notificationRepository = new NotificationRepository();

export default notificationRepository;
