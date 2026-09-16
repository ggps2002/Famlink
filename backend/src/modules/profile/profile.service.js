import { BaseService } from "../../core/http/BaseService.js";
import { UnauthorizedError } from "../../core/errors/index.js";

/**
 * Answers that are objects or arrays but arrive as strings.
 *
 * The profile form posts `multipart/form-data` because it carries an avatar, so
 * every value reaches the server as text — including the ones the schema types
 * as objects. A field left unparsed is stored as the string `"[1,2]"`, which
 * reads back wrong forever after.
 *
 * The two lists differ, and that difference is inherited rather than chosen:
 * the create path never parsed `languages`, `salaryExp`, `hourlyRate` and the
 * rest, so a profile first saved through a flow that posts them holds strings
 * where the update path would have stored objects. Widening the create list
 * would change what gets written for those fields, which is a data change, not
 * a move — so it is left alone and named here instead.
 */
const CREATE_JSON_FIELDS = [
  "availability",
  "preferredAges",
  "responsibilities",
  "certifications",
  "specificDays",
  "budget",
  "hourlyBudget",
  "childrenAges",
];

const UPDATE_JSON_FIELDS = [
  ...CREATE_JSON_FIELDS,
  "languages",
  "ageGroupsExp",
  "additionalDetails",
  "agesCare",
  "hourlyRate",
  "salaryExp",
  "salaryRange",
];

/**
 * Answers that gate other features and must end up as real booleans.
 *
 * `hasFamily: "false"` — the string, as FormData delivers it — is truthy, and
 * the match paywall compares against the boolean `false`. A profile that stored
 * the string silently bypassed the gate.
 */
const BOOLEAN_FIELDS = ["hasFamily", "hasNanny"];

/** Parse a JSON-ish form value, leaving anything that isn't JSON as it is. */
const parseIfJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const asBoolean = (value) => value === "true" || value === true;

/**
 * The detailed care profile behind the nanny-share flow.
 *
 * Both entry points upsert, because the questionnaire saves as the member moves
 * through it and neither the client nor the server tracks which step created
 * the record. That is also why `create` is not restricted to members without a
 * profile — re-running an earlier step must not fail.
 */
export class ProfileService extends BaseService {
  /**
   * Pay out the referrer of `userId`, if there is one.
   *
   * Fired on every save rather than only on the step that looks like
   * completion. The previous code hung this off a `!careType` heuristic that
   * does not hold across all the onboarding flows, so a referred friend could
   * finish a profile and silently credit nobody.
   *
   * Safe to call repeatedly: the underlying claim is atomic and only pays when
   * the member was actually referred and has not been credited yet. Non-blocking
   * — a referral payout must not be able to fail someone's profile save.
   */
  #creditReferral(userId) {
    this.creditReferrer(userId)
      .then((result) => {
        if (!result) return;

        const { referrer, referred } = result;
        return this.sendReferralRewardEmail(referrer.email, referrer.name, {
          friendName: referred.name,
          monthsEarned: referrer.referralCount,
          matchingUntil: referrer.referralMatchingUntil,
        });
      })
      .catch((error) => console.error("Failed to credit referral on profile save:", error));
  }

  #coerce(data, jsonFields) {
    const out = { ...data };

    for (const field of jsonFields) {
      if (out[field] !== undefined) out[field] = parseIfJson(out[field]);
    }
    for (const field of BOOLEAN_FIELDS) {
      if (out[field] !== undefined) out[field] = asBoolean(out[field]);
    }

    return out;
  }

  /**
   * First save of a profile, from the onboarding questionnaire.
   *
   * The uploaded avatar is written to the user record as well as the profile,
   * so the member's photo appears everywhere and not just on the share card.
   */
  async create({ userId, body = {}, file }) {
    const user = await this.userRepository.findById(userId, { select: "_id", lean: true });
    if (!user) throw new UnauthorizedError("Access denied");

    const document = this.#coerce(body, CREATE_JSON_FIELDS);

    let imageUrl = "";
    if (file) {
      imageUrl = await this.imageUploader(file.buffer, userId, "new_user");
      await this.userRepository.updateById(userId, { imageUrl });
    }
    document.imageFile = imageUrl;

    const profile = await this.profileRepository.saveForUser(userId, document);

    // `careType` marks a mid-questionnaire step; its absence is what the flow
    // uses to mean "this was the last one".
    if (!body.careType) {
      await this.userRepository.updateById(userId, { nannyProfileCompleted: true });
    }

    this.#creditReferral(userId);

    return profile;
  }

  /** A later edit, from the profile screen or a subsequent questionnaire step. */
  async update({ userId, body = {}, file }) {
    const data = this.#coerce(body, UPDATE_JSON_FIELDS);

    if (file) {
      data.imageFile = await this.imageUploader(file.buffer, userId, "nanny_profile");
      await this.userRepository.updateById(userId, { imageUrl: data.imageFile });
    } else {
      // No new upload, but the user record may still be out of step with the
      // profile — re-point it at the picture the profile already holds.
      const existing = await this.profileRepository.findByUserId(userId, { lean: true });
      if (existing?.imageFile) {
        await this.userRepository.updateById(userId, { imageUrl: existing.imageFile });
      }
    }

    const profile = await this.profileRepository.saveForUser(
      userId,
      { $set: data },
      { validate: true }
    );

    this.#creditReferral(userId);

    return profile;
  }
}

export default ProfileService;
