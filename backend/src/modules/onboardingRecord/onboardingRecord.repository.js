import { BaseRepository } from "../../core/database/BaseRepository.js";
import OnboardingRecord from "./onboardingRecord.model.js";

export class OnboardingRecordRepository extends BaseRepository {
  constructor(model = OnboardingRecord) {
    super(model);
  }

  findByRecordId(recordId) {
    return this.model.findOne({ recordId }).lean().exec();
  }

  /**
   * Merge answers into a record, creating it if needed.
   *
   * Field by field ($set on fields.<column>) rather than replacing `fields`, so
   * each form step adds its columns without erasing what earlier steps wrote —
   * the same "update the row" behaviour the sheet script had.
   */
  mergeFields(recordId, fields, { email } = {}) {
    const set = {};
    for (const [column, value] of Object.entries(fields)) set[`fields.${column}`] = value;
    if (email) set.email = email;

    return this.model
      .findOneAndUpdate(
        { recordId },
        { $set: set, $setOnInsert: { recordId } },
        { upsert: true, new: true, lean: true }
      )
      .exec();
  }

  /** Newest first, for the admin console. */
  listRecent(limit) {
    return this.model.find({}).sort({ createdAt: -1 }).limit(limit).lean().exec();
  }
}

export const onboardingRecordRepository = new OnboardingRecordRepository();

export default onboardingRecordRepository;
