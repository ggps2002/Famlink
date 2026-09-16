import { HttpService } from "@shared/api/HttpService";

/**
 * The public share link: the member's own, and reading someone else's by token.
 *
 * `publicProfile` is the only call in the app a signed-out visitor makes to a
 * member's data, which is why the token is encoded rather than interpolated raw
 * — it arrives from the URL bar.
 */
export class ShareLinkService extends HttpService {
  myShareLink() {
    return this.get("/share/my-share-link");
  }

  publicProfile(token) {
    return this.get(`/share/public/${encodeURIComponent(token)}`);
  }
}

export const shareLinkService = new ShareLinkService();
export default shareLinkService;
