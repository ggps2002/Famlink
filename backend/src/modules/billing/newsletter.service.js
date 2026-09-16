import jwt from "jsonwebtoken";
import { BaseService } from "../../core/http/BaseService.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors/index.js";
import config from "../../config/index.js";
import { confirmationEmail, confirmedPage, failedPage } from "./newsletter.templates.js";

/** How long a confirmation link stays usable. */
const TOKEN_TTL = "1h";

/**
 * Newsletter sign-up, with double opt-in.
 *
 * The address is not stored when someone submits the form — only when they
 * click the link in the email. That is the whole point of the design: anyone
 * can type anyone else's address into a public form, and a list built from
 * unconfirmed submissions is a list of people who never asked to be on it.
 *
 * The confirmation link carries a signed token rather than a database row, so
 * an unconfirmed address leaves no trace at all.
 */
export class NewsletterService extends BaseService {
  #backendUrl() {
    return config.urls.backend || "http://localhost:3000";
  }

  #frontendUrl() {
    return config.urls.frontend || "http://localhost:5173";
  }

  /**
   * Send a confirmation link.
   *
   * 409s an address already on the list, which does tell an unauthenticated
   * caller whether a given address is subscribed. Preserved from the original —
   * worth noting rather than changing silently, since the alternative (always
   * answering "check your inbox") would also change what the form displays.
   */
  async requestSubscription(email) {
    if (!email) throw new ValidationError("Email is required");

    if (await this.subscriptionRepository.exists({ email })) {
      throw new ConflictError("Already Subscribed");
    }

    const token = jwt.sign({ email }, config.auth.jwtSecret, { expiresIn: TOKEN_TTL });
    const confirmUrl = `${this.#backendUrl()}/subscribe/verify-email/${token}`;

    const { subject, html } = confirmationEmail(confirmUrl);
    await this.sendEmailConfirmation(email, subject, html);
  }

  /**
   * Complete the opt-in. Returns an HTML page, because this URL is opened in a
   * mail client and there is no application around it to render a result.
   */
  async confirmSubscription(token) {
    try {
      const { email } = jwt.verify(token, config.auth.jwtSecret);
      await this.subscriptionRepository.create({ email });

      return { status: 200, html: confirmedPage(this.#frontendUrl()) };
    } catch {
      // One page for an expired link, a forged one, and a duplicate — none of
      // which the reader can act on differently.
      return { status: 400, html: failedPage(this.#frontendUrl()) };
    }
  }

  /** The console's subscriber list. */
  async listSubscribers({ adminId, query = {} }) {
    const admin = await this.userRepository.findById(adminId, { select: "type", lean: true });
    if (!admin) throw new NotFoundError("User not found");
    if (admin.type !== "Admin") {
      throw new ForbiddenError("Access denied. Only Admins can get this data");
    }

    const limit = parseInt(query.limit, 10) || 10;
    const page = parseInt(query.page, 10) || 1;

    const filter = {};
    if (query.email) {
      // Escaped: an unescaped term makes this a regex denial of service against
      // the subscriber list.
      filter.email = { $regex: this.escapeRegex(query.email), $options: "i" };
    }

    const [data, totalRecords] = await Promise.all([
      this.subscriptionRepository.find(filter, {
        skip: (page - 1) * limit,
        limit,
        sort: { createdAt: -1 },
      }),
      this.subscriptionRepository.count(filter),
    ]);

    return {
      data,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    };
  }
}

export default NewsletterService;
