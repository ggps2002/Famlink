// The legacy auth middleware, kept only as an alias.
//
// ── Why this file no longer contains any logic ──────────────────────────────
//
// It used to read:
//
//     const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
//
// Two things were wrong with that, and the second is the dangerous one.
//
// 1. It disagreed with the rest of the app. config/index.js resolves the
//    development fallback to "dev_jwt_secret", so tokens minted by TokenService
//    were verified here against a different key and every legacy route rejected
//    every valid token whenever JWT_SECRET was unset.
//
// 2. Far worse: with JWT_SECRET unset, this verified tokens against a literal
//    committed to the repository. Anyone who has read this file could sign
//    `{ userId: <any id> }` with that string and be authenticated as that user.
//    This middleware guards the admin console (modules/admin/admin.middleware.js)
//    as well as the remaining Routes/ files, so the forged id could be an
//    admin's. Production is protected by assertRequiredEnv() refusing to boot
//    without the secret — but that is one env var away from total compromise,
//    and a default that only fails safe by accident is not a control.
//
// Everything now routes through `authenticate`, which reads config.auth and
// pins the accepted algorithms, issuer and audience. The export is kept so the
// three remaining Routes/ files and the admin middleware do not have to change
// in the same commit; new code should import `authenticate` directly.
export { authenticate as authMiddleware } from "../../core/http/middleware/authenticate.js";
export { authenticate, optionalAuthenticate } from "../../core/http/middleware/authenticate.js";
