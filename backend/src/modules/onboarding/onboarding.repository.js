import { BaseRepository } from "../../core/database/BaseRepository.js";
import OnboardingShare from "../nannyShare/onboardingShare.model.js";

/**
 * The intake answers captured before (or alongside) account creation.
 *
 * Keyed on email rather than user id because the questionnaire is answered by
 * people who do not have an account yet — that is the whole point of it.
 */
export class OnboardingRepository extends BaseRepository {
  constructor(model = OnboardingShare) {
    super(model);
  }

  /**
   * Upsert the answers for an address.
   *
   * An upsert rather than an insert so re-submitting the form updates the same
   * row instead of leaving a trail of partial answers, one per abandoned
   * attempt.
   */
  upsertByEmail(email, answers) {
    return this.model.findOneAndUpdate({ email }, answers, { upsert: true, new: true }).exec();
  }
}

export const onboardingRepository = new OnboardingRepository();

export default onboardingRepository;
