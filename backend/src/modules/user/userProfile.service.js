import { BaseService } from "../../core/http/BaseService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import { SELF_USER_SELECT } from "./user.privacy.js";
import { displayRating, toAdminEditedRow } from "./user.presenter.js";

/**
 * Fields that arrive as JSON inside a multipart form.
 *
 * The profile form posts `multipart/form-data` because it carries an avatar, so
 * every value reaches the server as a string — including the ones that are
 * objects. They are parsed here rather than trusted.
 */
const JSON_FIELDS = ["location", "services", "noOfChildren"];

/**
 * A JSON string from a form field, or a 400.
 *
 * Before the refactor only `additionalInfo` was guarded this way; a malformed
 * `location` threw a raw SyntaxError and surfaced as a 500. A body the client
 * built wrong is a client error, so all four now answer 400.
 */
const parseJsonField = (value, field) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new ValidationError(`Invalid JSON format for ${field}`);
  }
};

/**
 * Editing the profile record itself — by its owner, or by an admin.
 *
 * The two paths differ in more than the permission check. The owner's edit
 * loads the document and saves it, so schema validation and hooks run and the
 * response is their own full record. The admin's edit updates by id and returns
 * the console's table row. Keeping them as separate methods rather than one
 * method with an `isAdmin` flag is deliberate: they have different inputs,
 * different outputs, and only one of them sends the member an email.
 */
export class UserProfileService extends BaseService {
  /**
   * Merge questionnaire answers into the stored array.
   *
   * `additionalInfo` is a list of `{ key, value }` pairs, not a map, so an
   * incoming answer either replaces the entry with the same key or is appended.
   * A form that posts three answers must not wipe the other twenty.
   *
   * Returns the indexes it overwrote so the caller can mark them modified:
   * assigning into an array element is not change-tracked by Mongoose on its
   * own, and without the mark the edit is silently dropped on save.
   */
  #mergeAdditionalInfo(existing, incoming) {
    const merged = Array.isArray(existing) ? existing : [];
    const touched = [];

    for (const entry of incoming) {
      const index = merged.findIndex((info) => info.key === entry.key);
      if (index >= 0) {
        merged[index].value = entry.value;
        touched.push(index);
      } else {
        merged.push(entry);
      }
    }

    return { merged, touched };
  }

  /** Upload every attached file, and return the last URL — the avatar. */
  async #uploadAvatar(files, user) {
    let imageUrl;
    for (const file of files) {
      imageUrl = await this.imageUploader(file.buffer, user.email, `${user._id}`);
    }
    return imageUrl;
  }

  /**
   * A member editing their own profile.
   *
   * Every field is optional and only present keys are written, so the form can
   * post one section at a time without blanking the others.
   */
  async updateOwn({ userId, body = {}, files = [] }) {
    const {
      name,
      location,
      gender,
      age,
      additionalInfo,
      services,
      noOfChildren,
      aboutMe,
      zipCode,
      hasSubmittedSheetResponse,
    } = body;

    const parsedAdditionalInfo =
      typeof additionalInfo === "string"
        ? parseJsonField(additionalInfo, "additionalInfo")
        : [];

    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (files.length > 0) {
      user.imageUrl = await this.#uploadAvatar(files, user);
    }

    if (name !== undefined) user.name = name;
    // Loose comparison on purpose: a null from a form field means "not sent".
    if (hasSubmittedSheetResponse != null) {
      user.hasSubmittedSheetResponse = hasSubmittedSheetResponse;
    }
    if (location !== undefined) user.location = parseJsonField(location, "location");
    if (gender !== undefined) user.gender = gender;
    if (age !== undefined) user.age = age;
    // Truthiness, not `!== undefined`: an empty zip is never an intentional
    // edit, and accepting it would blank the stored value and break the zip
    // fallback the dashboard search relies on.
    if (zipCode) user.zipCode = zipCode;
    if (aboutMe !== undefined) user.aboutMe = aboutMe;
    if (services) user.services = parseJsonField(services, "services");
    if (noOfChildren) user.noOfChildren = parseJsonField(noOfChildren, "noOfChildren");

    if (Array.isArray(parsedAdditionalInfo)) {
      const { merged, touched } = this.#mergeAdditionalInfo(
        user.additionalInfo,
        parsedAdditionalInfo
      );
      user.additionalInfo = merged;
      for (const index of touched) user.markModified(`additionalInfo.${index}.value`);
    }

    await user.save();

    this.#notifyProfileUpdated(user, {
      body,
      hasFiles: files.length > 0,
      parsedAdditionalInfo,
    });

    return this.#selfView(userId);
  }

  /**
   * Tell the member what changed, so an edit they did not make is visible.
   *
   * Fire-and-forget: the profile is already saved, and a mail outage must not
   * turn a successful edit into an error the member sees.
   */
  #notifyProfileUpdated(user, { body, hasFiles, parsedAdditionalInfo }) {
    const changed = [];

    if (body.name !== undefined) changed.push("name");
    if (hasFiles) changed.push("profile photo");
    if (body.location !== undefined) changed.push("location");
    if (body.zipCode) changed.push("zip code");
    if (body.gender !== undefined) changed.push("gender");
    if (body.age !== undefined) changed.push("age");
    if (body.aboutMe !== undefined) changed.push("about me");
    if (body.services) changed.push("services");
    if (body.noOfChildren) changed.push("number of children");
    if (Array.isArray(parsedAdditionalInfo) && parsedAdditionalInfo.length > 0) {
      // Named collectively: listing which questionnaire answers moved would put
      // the answers themselves in an email.
      changed.push("profile details");
    }

    if (changed.length === 0 || !user.email) return;

    this.sendProfileUpdatedEmail(user.email, user.name, changed.join(", ")).catch((error) =>
      console.error("Failed to send profile-updated email:", error)
    );
  }

  /** Re-read the saved record as its owner sees it, with reviewers populated. */
  async #selfView(userId) {
    const user = await this.userRepository.findById(userId, {
      select: SELF_USER_SELECT,
      populate: { path: "reviews.userId", select: "name imageUrl" },
    });

    if (!user) throw new NotFoundError("User not found");

    return { ...user.toObject(), averageRating: displayRating(user.reviews) };
  }

  /**
   * An admin editing someone else's profile from the console.
   *
   * Writes only the fields the request actually carried. The pre-refactor code
   * read the whole document, mutated the copy and wrote all of it back, which
   * meant a concurrent change to any unrelated field — a login timestamp, a
   * subscription webhook — was overwritten by whatever the console had loaded.
   */
  async updateAsAdmin({ adminId, body = {}, files = [] }) {
    const admin = await this.userRepository.findById(adminId, { select: "type", lean: true });
    if (!admin || admin.type !== "Admin") throw new ForbiddenError("Access denied");

    const {
      userId,
      name,
      location,
      gender,
      age,
      zipCode,
      aboutMe,
      services,
      noOfChildren,
      additionalInfo,
      removePfp,
    } = body;

    const parsedAdditionalInfo = additionalInfo
      ? parseJsonField(additionalInfo, "additionalInfo")
      : [];

    const user = await this.userRepository.findById(userId, { lean: true });
    if (!user) throw new NotFoundError("User not found");

    const update = {};

    // Checked against both forms: the console posts multipart, so `true`
    // arrives as the string "true".
    if (removePfp === "true" || removePfp === true) update.imageUrl = null;
    if (files.length > 0) update.imageUrl = await this.#uploadAvatar(files, user);

    if (name !== undefined) update.name = name;
    if (location !== undefined) update.location = parseJsonField(location, "location");
    if (gender !== undefined) update.gender = gender;
    if (age !== undefined) update.age = age;
    if (zipCode) update.zipCode = zipCode;
    if (aboutMe !== undefined) update.aboutMe = aboutMe;
    if (services && services.length > 0) update.services = parseJsonField(services, "services");
    if (noOfChildren) update.noOfChildren = parseJsonField(noOfChildren, "noOfChildren");

    if (parsedAdditionalInfo.length > 0 || !Array.isArray(user.additionalInfo)) {
      const { merged } = this.#mergeAdditionalInfo(user.additionalInfo, parsedAdditionalInfo);
      update.additionalInfo = merged;
    }

    // Validators run on the paths being set — the repository's default, and a
    // change from the pre-refactor write, which had them off. An admin edit
    // that would store an out-of-range age now fails loudly instead of landing.
    const updated = await this.userRepository.updateById(userId, update);
    if (!updated) throw new NotFoundError("User not found");

    return toAdminEditedRow(updated);
  }
}

export default UserProfileService;
