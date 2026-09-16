import { BaseRepository } from "../../core/database/BaseRepository.js";
import PostJob from "./postJob.model.js";

/**
 * Job posts.
 *
 * The /postJob HTTP routes are deliberately still served by the legacy router —
 * they are out of scope for this refactor. This repository exists because other
 * migrated modules (favourites, admin) read job posts, and they should go
 * through the same seam as everything else rather than importing the model.
 */
export class JobRepository extends BaseRepository {
  constructor(model = PostJob) {
    super(model);
  }

  findByOwner(userId, options = {}) {
    return this.find({ user: userId }, options);
  }
}

export const jobRepository = new JobRepository();

export default jobRepository;
