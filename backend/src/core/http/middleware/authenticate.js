import jwt from "jsonwebtoken";
import config from "../../../config/index.js";
import { UnauthorizedError } from "../../errors/index.js";

/**
 * How a bearer token is checked.
 *
 * `algorithms` is the part that matters. Without it, `jwt.verify` trusts the
 * `alg` field in the token's own header — an attacker-controlled value — which
 * is the algorithm-confusion family of attacks. jsonwebtoken v9 already refuses
 * the worst case (`alg: none`), but relying on a library default for this is
 * relying on it never changing.
 *
 * `issuer` and `audience` are deliberately NOT asserted here yet. Tokens signed
 * before this shipped carry neither, so requiring them would reject every
 * session currently in flight — a forced logout for everyone, which is exactly
 * what this round of hardening was asked not to do. TokenService stamps both
 * onto new tokens as of now; once the 7-day refresh window has turned over,
 * adding `issuer: config.auth.jwtIssuer, audience: config.auth.jwtAudience`
 * here costs nothing and closes cross-token replay. See SECURITY.md.
 */
const VERIFY_OPTIONS = { algorithms: config.auth.jwtAlgorithms };

/**
 * Verify the bearer token and attach the caller's identity to the request.
 *
 * Sets `req.userId` — the same property the pre-refactor middleware set — so
 * handlers that have not been migrated yet keep working unchanged. `req.auth`
 * is the shape new code should read: it leaves room for claims beyond the id
 * without every handler learning a new top-level property on `req`.
 */
export const authenticate = (req, _res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new UnauthorizedError("Authentication token is missing"));
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret, VERIFY_OPTIONS);
    req.userId = decoded.userId;
    req.auth = { userId: decoded.userId, claims: decoded };
    return next();
  } catch {
    // The jwt library distinguishes expired from malformed, but the caller is
    // told neither: both mean "sign in again", and naming which one tells
    // someone probing with forged tokens whether their signature was accepted.
    return next(new UnauthorizedError("Invalid or expired token"));
  }
};

/**
 * Attach the caller if a token is present, but let the request through if not.
 *
 * For endpoints that serve both audiences from one URL — a shared profile page
 * shows a signed-in member a CTA into the real profile and a stranger the
 * public view. Without this those routes had to be left fully unauthenticated
 * and re-parse the header themselves.
 */
export const optionalAuthenticate = (req, _res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret, VERIFY_OPTIONS);
    req.userId = decoded.userId;
    req.auth = { userId: decoded.userId, claims: decoded };
  } catch {
    // A bad token on an optional route is treated as no token, not as an error.
  }

  return next();
};

export default authenticate;
