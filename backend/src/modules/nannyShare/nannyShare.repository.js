import { BaseRepository } from "../../core/database/BaseRepository.js";
import NannyShare from "./nannyShare.model.js";

/**
 * Nanny share posts — the listings behind the browse screens and the public
 * city pages.
 *
 * `findNearbyUserIds` lives on the user repository rather than here; a share is
 * located by its poster, not by a coordinate of its own, so the geo query runs
 * against users and this repository filters by the ids it returns.
 */
export class NannyShareRepository extends BaseRepository {
  constructor(model = NannyShare) {
    super(model);
  }

  findByOwner(userId, options = {}) {
    return this.find({ user: userId }, options);
  }
}

export const nannyShareRepository = new NannyShareRepository();

export default nannyShareRepository;
