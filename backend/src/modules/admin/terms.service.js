import mongoose from "mongoose";
import { BaseService } from "../../core/http/BaseService.js";
import { NotFoundError, ValidationError } from "../../core/errors/index.js";
import { sanitizeHtml, htmlToText } from "../../shared/utils/sanitizeHtml.js";
import {
  DEFAULT_TERMS_HTML,
  DEFAULT_TERMS_TITLE,
  DEFAULT_TERMS_EFFECTIVE_DATE,
  DEFAULT_TERMS_UPDATED_DATE,
} from "../legal/defaultTerms.js";

export const SLUGS = ["terms", "privacy", "community-guidelines"];

const MAX_TITLE = 200;
const MAX_SUMMARY = 500;

const resolveSlug = (raw) => (SLUGS.includes(raw) ? raw : "terms");

/**
 * Admin editing for the legal documents.
 *
 * ── Publishing appends ─────────────────────────────────────────────────────
 * A new version is written and the incumbent demoted, rather than the existing
 * row being edited. `User.termsAcceptedVersion` points at the text somebody
 * agreed to, and an in-place UPDATE would destroy the only record of what that
 * text said — which is the one thing these fields exist to preserve.
 *
 * ── Re-acceptance is a comparison, not a write ─────────────────────────────
 * Every member's accepted version is compared against the live one at read
 * time, so someone who accepted v3 is automatically out of date when v4
 * publishes. Clearing twenty thousand acceptance timestamps would erase the
 * history for no gain.
 */
export class TermsAdminService extends BaseService {
  #requireObjectId(id, field = "version id") {
    if (!mongoose.isValidObjectId(id)) throw new ValidationError(`Invalid ${field}`);
    return id;
  }

  /** The live version, the full history, and how many people are on each. */
  async read({ slug: rawSlug }) {
    const slug = resolveSlug(rawSlug);

    const [current, history] = await Promise.all([
      this.termsRepository.findPublished(slug, {
        populate: { path: "publishedBy", select: "name email" },
        lean: true,
      }),
      this.termsRepository.history(slug),
    ]);

    return {
      slug,
      current: current || null,
      history,
      acceptance: current ? await this.#acceptance(current.version) : null,
      defaults: this.#defaultsFor(slug),
    };
  }

  /**
   * How many members are on the live version, an older one, or none.
   *
   * The number an admin needs before deciding whether a change is worth
   * re-prompting everybody for.
   */
  async #acceptance(version) {
    const live = { status: { $ne: "Deleted" } };

    const [onCurrentVersion, onOlderVersion, neverRecorded] = await Promise.all([
      this.userRepository.count({ ...live, termsAcceptedVersion: version }),
      this.userRepository.count({
        ...live,
        termsAcceptedVersion: { $ne: null, $lt: version },
      }),
      this.userRepository.count({ ...live, termsAcceptedVersion: null }),
    ]);

    return { onCurrentVersion, onOlderVersion, neverRecorded };
  }

  /**
   * The wording the public site currently ships.
   *
   * Returned on every read, not only when nothing is published: it is also what
   * "restore the original wording" needs, and an admin who has edited a section
   * into a mess should be able to get the shipped text back without going to
   * the repository for it.
   *
   * Only `terms` has a bundled document. The privacy policy and community
   * guidelines have never existed as hardcoded pages, and inventing legal copy
   * for them here would be worse than an empty editor.
   */
  #defaultsFor(slug) {
    if (slug !== "terms") return null;

    return {
      title: DEFAULT_TERMS_TITLE,
      content: DEFAULT_TERMS_HTML,
      effectiveDate: DEFAULT_TERMS_EFFECTIVE_DATE,
      updatedDate: DEFAULT_TERMS_UPDATED_DATE,
    };
  }

  async readVersion(id) {
    this.#requireObjectId(id);

    const version = await this.termsRepository.findById(id, {
      populate: { path: "publishedBy", select: "name email" },
      lean: true,
    });

    if (!version) throw new NotFoundError("Version not found");
    return version;
  }

  /**
   * Publish a new version. Live the instant this returns.
   */
  async publish({ body = {}, adminId }) {
    const slug = resolveSlug(body.slug);
    const rawContent = body.content;

    if (typeof rawContent !== "string" || !rawContent.trim()) {
      throw new ValidationError("The document body cannot be empty.");
    }

    // Sanitised on the way IN, once, rather than at every read. The public page
    // renders this with dangerouslySetInnerHTML, so a stored script tag would
    // run in the browser of every visitor.
    const content = sanitizeHtml(rawContent);
    if (!htmlToText(content).trim()) {
      throw new ValidationError(
        "After sanitising, the document was empty. Check for unsupported markup."
      );
    }

    const current = await this.termsRepository.findPublished(slug, { lean: true });

    // Publishing an identical document would burn a version number and reset
    // everyone's acceptance for nothing — the fastest way to train members to
    // click through a consent prompt without reading it.
    if (
      current &&
      current.content === content &&
      current.title === (body.title || current.title)
    ) {
      throw new ValidationError(
        "This is identical to the published version — nothing to publish."
      );
    }

    const latest = await this.termsRepository.findHighestVersion(slug);
    const version = (latest?.version || 0) + 1;

    // Demote first, promote second. The partial unique index allows only one
    // published row per slug, so the other order is rejected outright — and
    // this ordering means a crash between the two leaves NO published document
    // rather than two, which the public endpoint handles by falling back to the
    // latest version instead of serving contradictory text.
    if (current) await this.termsRepository.setPublished(current._id, false);

    let published;
    try {
      published = await this.termsRepository.create({
        slug,
        version,
        title: String(body.title || "Terms & Conditions").slice(0, MAX_TITLE),
        content,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
        isPublished: true,
        requiresReacceptance: body.requiresReacceptance === true,
        changeSummary: String(body.changeSummary || "").slice(0, MAX_SUMMARY),
        publishedBy: adminId,
      });
    } catch (error) {
      // Put the previous version back rather than leaving the platform with no
      // published terms at all.
      if (current) {
        await this.termsRepository.setPublished(current._id, true).catch(() => {});
      }
      throw error;
    }

    return { published, version, slug, previousVersion: current?.version || null, content };
  }

  /**
   * Re-publish a historical version as a NEW version.
   *
   * Not by flipping the old row back to published: the history stays a strictly
   * increasing record of what was live and when. "We reverted to the March
   * wording on 5 June" is itself a fact worth keeping, and reactivating the old
   * row would erase it.
   */
  async restore({ id, adminId }) {
    this.#requireObjectId(id);

    const source = await this.termsRepository.findById(id, { lean: true });
    if (!source) throw new NotFoundError("Version not found");
    if (source.isPublished) throw new ValidationError("That version is already live.");

    const [current, latest] = await Promise.all([
      this.termsRepository.findPublished(source.slug, { lean: true }),
      this.termsRepository.findHighestVersion(source.slug),
    ]);

    if (current) await this.termsRepository.setPublished(current._id, false);

    const restored = await this.termsRepository.create({
      slug: source.slug,
      version: (latest?.version || 0) + 1,
      title: source.title,
      content: source.content,
      effectiveDate: new Date(),
      isPublished: true,
      // A restore is a correction, not a new agreement — members are not
      // re-prompted for wording they have already seen.
      requiresReacceptance: false,
      changeSummary: `Restored from version ${source.version}`,
      publishedBy: adminId,
    });

    return { restored, source };
  }

  /**
   * Run the sanitiser without saving, so an admin sees what will actually be
   * stored before publishing it.
   */
  preview(rawContent) {
    const html = sanitizeHtml(rawContent || "");

    return {
      html,
      text: htmlToText(html),
      // A visible signal that markup was removed. Silently dropping a table an
      // admin pasted from a Word document, with no indication, is how a clause
      // goes missing from a contract.
      modified: html !== String(rawContent || "").trim(),
    };
  }
}

export default TermsAdminService;
