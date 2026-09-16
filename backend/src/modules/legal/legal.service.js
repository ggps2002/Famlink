import { BaseService } from "../../core/http/BaseService.js";
import { ConflictError, NotFoundError } from "../../core/errors/index.js";

/** The documents this endpoint will serve. Anything else is a 404. */
export const LEGAL_SLUGS = ["terms", "privacy", "community-guidelines"];

const PUBLISHED_FIELDS =
  "slug version title content effectiveDate requiresReacceptance createdAt";

/**
 * The single source of truth for the legal documents.
 *
 * THIS IS THE PROPAGATION MECHANISM. The requirement — "once the terms are
 * updated, make sure they change everywhere on the platform" — is satisfied by
 * every surface reading from here instead of holding its own copy. There is no
 * push, no cache invalidation, no list of places to update: change the
 * published row and the next render of any surface shows the new text, because
 * there is only one place for any of them to read.
 *
 * The surfaces that must use this: the standalone terms page, the signup
 * acceptance checkbox, the subscription checkout consent, and every
 * questionnaire footer that links to or quotes the terms. A screen that
 * hardcodes the copy is outside this guarantee, which is the bug this exists to
 * remove.
 */
export class LegalService extends BaseService {
  /**
   * Small in-process cache. The terms page is anonymous traffic and the text
   * changes a few times a year, so a database read per visitor is pure waste.
   *
   * A short TTL rather than explicit invalidation: a publish becomes visible
   * within a minute everywhere, which is well inside what "immediately" means
   * for a legal document, and it needs no coordination between machines — which
   * is exactly the kind of coordination that goes wrong and leaves one machine
   * serving superseded terms indefinitely.
   */
  #cache = new Map();

  constructor(deps) {
    super(deps);
    this.cacheTtlMs = deps.cacheTtlMs ?? 60 * 1000;
  }

  isKnownSlug(slug) {
    return LEGAL_SLUGS.includes(slug);
  }

  async readPublished(slug) {
    const hit = this.#cache.get(slug);
    if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.payload;

    let doc = await this.termsRepository.findOne(
      { slug, isPublished: true },
      { select: PUBLISHED_FIELDS, lean: true }
    );

    // Fall back to the highest version if nothing is marked published. That
    // state is only reachable if a publish crashed between demoting the
    // incumbent and promoting its replacement — rare, but the failure mode
    // without this is a blank terms page, which is worse than showing the most
    // recent text.
    if (!doc) {
      doc = await this.termsRepository.findOne(
        { slug },
        { select: PUBLISHED_FIELDS, sort: { version: -1 }, lean: true }
      );
    }

    this.#cache.set(slug, { at: Date.now(), payload: doc || null });
    return doc || null;
  }

  /** The full document. */
  async getDocument(slug) {
    if (!this.isKnownSlug(slug)) throw new NotFoundError("Unknown document");

    const doc = await this.readPublished(slug);
    if (!doc) {
      // An explicit, machine-readable answer so the frontend can fall back to
      // its bundled copy rather than rendering an empty legal page.
      throw new NotFoundError("No published version of this document yet.", {
        code: "NOT_PUBLISHED",
      });
    }

    return doc;
  }

  /**
   * Version and date only.
   *
   * What the acceptance checkbox and the re-acceptance banner poll. Separate
   * from the full document so a screen that only needs to know whether the user
   * is current doesn't transfer several kilobytes of legal text to find out.
   */
  async getVersion(slug) {
    if (!this.isKnownSlug(slug)) throw new NotFoundError("Unknown document");

    const doc = await this.readPublished(slug);
    if (!doc) throw new NotFoundError("Not published", { code: "NOT_PUBLISHED" });

    return {
      slug: doc.slug,
      version: doc.version,
      effectiveDate: doc.effectiveDate,
      requiresReacceptance: doc.requiresReacceptance,
    };
  }

  /**
   * Record that a member has accepted the current document.
   *
   * The version stored is read from the SERVER's published document, never from
   * the request body. A client that could name the version it was accepting
   * could claim to have agreed to any text at all, including one that was never
   * published. The body's `version` is used only to detect a stale page.
   */
  async accept({ userId, slug: rawSlug, version }) {
    const slug = this.isKnownSlug(rawSlug) ? rawSlug : "terms";
    const doc = await this.readPublished(slug);

    if (!doc) {
      throw new ConflictError("There is no published version to accept yet.", {
        code: "NOT_PUBLISHED",
      });
    }

    // The page they were reading is older than what is live. They are told to
    // refresh rather than silently recorded as accepting text they never saw.
    if (version != null && Number(version) !== doc.version) {
      throw new ConflictError(
        "The terms have changed since this page loaded. Please review the current version.",
        { code: "VERSION_MISMATCH", details: { currentVersion: doc.version } }
      );
    }

    if (slug === "terms") {
      await this.userRepository.updateById(userId, {
        $set: { termsAcceptedAt: new Date(), termsAcceptedVersion: doc.version },
      });
    }

    return { version: doc.version, acceptedAt: new Date() };
  }

  /** Whether this member has to accept again. */
  async statusFor(userId) {
    const [doc, user] = await Promise.all([
      this.readPublished("terms"),
      this.userRepository.findById(userId, {
        select: "termsAcceptedAt termsAcceptedVersion",
        lean: true,
      }),
    ]);

    if (!doc || !user) return { needsAcceptance: false, currentVersion: null };

    const accepted = user.termsAcceptedVersion;

    // Someone who has never accepted anything is prompted regardless of the
    // `requiresReacceptance` flag — that flag governs whether an EXISTING
    // acceptance is invalidated by a change, not whether consent is needed at
    // all.
    const needsAcceptance =
      accepted == null || (accepted < doc.version && doc.requiresReacceptance);

    return {
      needsAcceptance,
      currentVersion: doc.version,
      acceptedVersion: accepted,
      acceptedAt: user.termsAcceptedAt,
      effectiveDate: doc.effectiveDate,
    };
  }
}

export default LegalService;
