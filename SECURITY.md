# Security

How authentication and session handling work in FamLink, what was changed on
2026-09-12, why each decision went the way it did, and what is still open.

This is a record of reasoning, not a checklist. Where something was *not* done,
the reason is written down too — a control that was considered and rejected is
more useful documented than silently absent.

---

## 1. Threat model in one paragraph

FamLink is a two-sided marketplace whose members are families with young
children and the people who care for them. The data worth protecting is not
just credentials: it is home neighbourhoods, children's ages and schools, work
schedules, and the simple fact of who is a member. That last one matters more
here than on most products — "does this person use a childcare service" is
itself sensitive — which is why several decisions below trade a slightly worse
error message for not confirming whether an account exists.

---

## 2. What was wrong, and what changed

### 2.1 Forgeable tokens via a committed fallback secret — **critical**

`src/shared/auth/middlewareAuth.js` read:

```js
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
```

With `JWT_SECRET` unset, every token was verified against a string committed to
this repository. Anyone who had read the file could sign `{ userId: <any id> }`
and be authenticated as that user. This middleware guards the **admin console**
(`modules/admin/admin.middleware.js`) as well as three remaining `Routes/`
files, so the forged id could be an admin's.

`JWT_SECRET` is **not set in the local `.env`** — this was live in development.
Production was protected only by `assertRequiredEnv()` refusing to boot without
it, which is a real control but leaves the app one environment variable away
from total compromise.

It also disagreed with the rest of the app: `config/index.js` resolves the
development fallback to `dev_jwt_secret`, so the two middlewares did not even
validate the same tokens.

**Changed.** The file is now a thin alias over `core/http/middleware/authenticate.js`,
which reads `config.auth` and has no fallback of its own. The export name is
kept so the legacy callers did not have to change in the same commit.

### 2.2 Password reset was unauthenticated account takeover — **critical**

`resetPasswordWithOtp` looked a user up **by the submitted code alone**:

```js
const user = await this.userRepository.findOne({ otp });
```

Not scoped to an email. With a 4-digit code (10,000 possibilities), no attempt
limit and no rate limit, submitting codes in a loop did not attack one chosen
account — it reset **whichever account happened to be holding the matching
code**, including an admin's.

This is not fixable by lengthening the code. The flaw is the unscoped lookup.

**Changed — the flow was removed, not hardened.** `POST /auth/forgot-password`
and `POST /auth/reset-password` are gone.

The decision to delete rather than repair rests on a fact worth stating: **the
frontend never called either route.** `ForgotPassword.jsx` uses
`requestPasswordReset` and `ResetPassword.jsx` uses `resetPasswordWithToken` —
the link-based flow, which was already correct (32 bytes of `crypto.randomBytes`,
stored only as a SHA-256 hash, one-hour expiry, matched against one specific
user row). The OTP pair was pure attack surface with no user.

The dead Redux thunks and service methods on the frontend were removed with it.

### 2.3 No rate limiting anywhere on auth — **critical**

Every auth endpoint was unbounded: password guessing, code guessing, account
enumeration, and mailing a stranger's inbox as fast as a script could send.

A well-built, Redis-backed limiter already existed at
`core/http/middleware/rateLimit.js` and was used by the location and report
modules. Auth simply never got it.

**Changed.** Limits are declared in `modules/auth/auth.module.js`:

| Route | Limit | Window | Keyed on |
|---|---|---|---|
| `POST /auth/login` | 20 | 5 min | IP |
| `POST /auth/login` | 10 | 5 min | **email** |
| `POST /auth/register` | 10 | 1 hr | IP |
| `POST /auth/check-user` | 30 | 10 min | IP |
| `POST /auth/send-otp`, `/resend-otp`, `/email-resend-otp` | 5 | 15 min | IP |
| `POST /auth/request-password-reset`, `/reset-password-token` | 5 | 15 min | IP |
| `POST /auth/verify-otp` | 10 | 5 min | IP |
| `POST /auth/refreshToken` | 60 | 5 min | IP |

Login carries **two** limiters, and the second is the point. Per-IP limiting
does nothing against credential stuffing spread over a botnet: each address gets
a full allowance while the account under attack has no ceiling of its own.
Bucketing by the submitted email gives that account a ceiling regardless of
where the guesses come from. `rateLimit` grew an optional `identify` function
for this.

Numbers are chosen to be invisible to a person and ruinous to a script. A member
logs in once or twice and mistypes occasionally; ten attempts in five minutes is
already a bad day.

### 2.4 One-time codes were weak and unlimited — **high**

The code was `Math.floor(1000 + Math.random() * 9000)`: four digits from a
non-cryptographic PRNG, stored in the database in plaintext, with no cap on
wrong guesses.

**Changed** (`credentials.service.js`, `auth.service.js`):

- `crypto.randomInt` instead of `Math.random`. `Math.random` is not designed to
  be unpredictable and must not produce a credential.
- Six digits instead of four — 10,000 possibilities became 1,000,000.
- Only the **SHA-256 hash** is stored; the raw code exists solely in the email.
- A per-account attempt counter (`otpAttempts`, default 5). Six digits only
  resists guessing if the number of tries is bounded, and a per-IP rate limit
  cannot do that — IPs are cheap, the account is not.
- Comparison is constant-time (`crypto.timingSafeEqual`).
- Expiry is checked *before* the attempt is counted, so a lapsed code cannot be
  used to burn a victim's attempt budget.

**Why SHA-256 and not bcrypt.** Bcrypt's cost exists to make guessing a
low-entropy, long-lived secret expensive. These codes live two minutes, are drawn
uniformly from a million values, and are capped at five attempts — the guessing
ceiling comes from those limits, not from hash cost. A per-request bcrypt on a
verification endpoint is latency with no security return. Same reasoning the
pre-existing reset tokens already use.

### 2.5 Account enumeration — **high**

Login answered `404 "User not found"` for an unknown address and
`401 "Invalid password"` for a known one. Submitting any password told you
whether that person had an account.

**Changed.** Both produce an identical `401 "Invalid email or password"`, from a
single `INVALID_CREDENTIALS` constant so the two cannot drift apart. Verified
byte-identical. `resendEmailOtpByEmail` likewise returns silently for an unknown
address instead of 404ing, matching what `requestPasswordReset` already did.

**`POST /auth/check-user` deliberately still answers truthfully.** It exists so
the signup form can say "that email is already registered" instead of failing
opaquely, and removing the oracle removes the feature. The exposure is *priced*
rather than eliminated: 30 lookups per 10 minutes is a person checking their own
address, and is not a script walking a list of a million.

### 2.6 A password reset did not end the attacker's session — **high**

`revokeAllForUser` existed on the refresh-token repository and **had no callers
anywhere in the codebase**. Someone resetting their password because they
believed another person was in their account did not eject that person: a stolen
refresh token stayed valid for its full seven days.

**Changed.** `resetPasswordWithToken` now revokes every refresh token for the
account. Failure is logged, not thrown — the password has already changed by
that point, and reporting an error would tell the user their reset failed when
it did not.

### 2.7 Transport and headers — **medium**

- **`helmet` added.** Gives `nosniff`, `X-Frame-Options`, `Referrer-Policy` and
  HSTS. CSP is deliberately **off**: this process serves a JSON API and uploaded
  files and renders no HTML of its own, so a policy here protects nothing while
  a wrong one silently breaks avatar loading. The CSP that matters belongs on the
  frontend's origin. `crossOriginResourcePolicy` is relaxed to `cross-origin`
  because the frontend loads `/assets/uploads` from a different origin.
- **`trust proxy` set.** Behind fly.io, `req.ip` and `req.protocol` were the
  proxy's. Note the rate limiter never depended on this — it reads
  `Fly-Client-IP`, which the proxy overwrites and a caller cannot forge.
- **JWT algorithms pinned** to `HS256` on every `verify`. Without it,
  `jwt.verify` honours the `alg` the token's own header claims — the
  algorithm-confusion family. jsonwebtoken v9 already refuses the worst case;
  relying on a library default for this is relying on it never changing.

### 2.8 CORS was `origin: "*"` — **medium**

**Changed** to an allowlist (`core/http/corsPolicy.js`), and then changed again
once the session moved to a cookie. It is now a **fixed list in the file**:

```
production   https://famlink.care, https://www.famlink.care
development  the above, plus localhost:5173 / 127.0.0.1:5173 / localhost:3000
```

The second change is the one worth explaining, because the first version was
already an allowlist and looked fine.

**Why constants rather than environment variables.** Who may call this API is a
security decision, and it was being made by whatever the deployment happened to
have set. Two ways that went wrong:

- The list could be *lost*. `CORS_ORIGINS` **replaced** the defaults, so setting
  it to a single staging origin silently revoked the real frontend's access. It
  now **adds** to the built-in list instead.
- The list could be *widened by accident*. It fell back to
  `FRONTEND_URL`/`CLIENT_URL`/`APP_URL` — variables whose actual job is building
  links in outgoing email. Pointing one at a campaign domain for a week would
  have granted that domain access to this API, which is not a consequence anyone
  editing an email template would expect. That derivation is gone.

**Why the allow-everything fallback is gone.** There was a branch that allowed
every origin when the list came out empty, reasoning that failing closed would
take production down over a missing variable. Neither half of that holds now:
the list is built from constants and cannot come out empty by misconfiguration,
and with `credentials: true` (§4) "allow every origin" means any site on the
internet can make credentialed requests to this API and read the replies. It was
the one remaining path to a wildcard, and it is removed.

**A request with no `Origin` header is still allowed**, unchanged. Browsers
always send one cross-origin, so its absence means the caller is not a browser —
curl, a health check, a Stripe webhook. CORS is a browser mechanism and cannot
police those; rejecting them breaks integrations while stopping no attack.

Note `famlink.care` and `www.famlink.care` are separate origins to a browser and
both are listed; allowing only one strands whoever arrived by the other name.

### 2.9 Password strength — **medium**

There were no requirements at all.

**Changed.** A length floor (8, `PASSWORD_MIN_LENGTH`) plus a small deny-list of
the passwords credential-stuffing runs try first.

**Deliberately a length floor, not a composition rule.** "One uppercase, one
digit, one symbol" reliably produces `Password1!`, which is in every cracking
list. Length is what resists guessing; NIST SP 800-63B says the same and
explicitly advises against composition rules.

Enforced **only where a password is set** (registration, reset) and never on
login — an existing account whose password predates the rule must still be able
to sign in, or the rule locks out the users it is meant to protect.

### 2.10 localStorage held tokens and the full user record — **high**

`persist:auth` was 3.3 KB containing both tokens and 55 user fields, readable by
any script on the page. Among them `email`, `zipCode`, `location`, `stripeId`,
`subscriptionId` — and `moderationReason`, `suspiciousReason`,
`suspiciousFlaggedAt`.

Those last three are notable: `user.privacy.js` is explicit that the **owner**
must never see them ("the user gets the generic deactivation email; the reasoning
stays in the console"), because a moderator's wording can identify whoever filed
a report. They reached the browser anyway, because `SELF_USER_SELECT` is
exclusion-based and cannot express that tier — and were then written to disk.

**Changed, in two steps.**

First, a redux-persist transform (`features/auth/store/persistedUser.js`) strips
PII, financial identifiers, internal moderation notes and account lifecycle
detail before anything reaches localStorage. Measured: 3,289 → 2,135 bytes, with
none of the prohibited fields present, and the app verified working across a
reload.

Then the tokens went too — the persist whitelist is now `["user"]` and nothing
else. The refresh token moved into an httpOnly cookie and the access token into
Redux only, which is §4 below; it is no longer "next", it is done.

**Why a deny-list rather than the four-field allow-list.** The allow-list is the
stronger shape and is where this should end up. It is not safe yet: `PageLayout.jsx`
only re-fetches the user when the access token has **already expired**, so on an
ordinary reload the persisted object *is* the user for up to two hours. Dropping
`_id`, `onboarding` or `nannyProfileCompleted` today breaks routing, match gating
and chat for that window. It becomes an allow-list in the same change that makes
the shell rehydrate from the server on mount — see §4.

This is defence in depth, not the repair. The real fix is for the server to stop
sending the internal tier at all; the transform holds regardless of what the API
returns, including fields added later.

---

## 3. Decisions taken *not* to act

### 3.1 Refresh tokens are still stored unhashed — **accepted, with reasoning**

The database holds complete, valid, signed JWTs. A read-only leak (a backup, a
replica, an exposed mongod) hands over sessions replayable for seven days.
Hashing the stored copy — as this codebase already does for reset tokens, with
the comment *"Only the hash is persisted, so a leaked database does not hand over
working reset links"* — would close that.

It was **not done**, by decision, because the rollout invalidates every existing
row and signs all users out once, which was ruled out for this round.

Still open, and the argument against it is now weaker than it was: the cookie
migration (§4) signs everyone out once anyway, so the cost that ruled hashing
out has already been paid. Doing it in the same deploy would have been free.

A distinction worth keeping straight, because the two get conflated:

- **Encrypting the token (JWE)** — *not needed, correctly.* The refresh token is
  a JWT whose payload is `{ userId, iat, exp }`: an internal ObjectId, no PII.
  The relevant guidance says such a token needs "encryption (JWE) **or strict
  signing**", and strict signing (HS256, verified against a secret) is in place.
- **Hashing the server's stored copy** — a different control, still open, and the
  one that matters for a database leak.

Client-side at-rest encryption (Keychain/Keystore) does not apply: this is a web
app, and any key used to encrypt `localStorage` would sit next to the ciphertext.
The real answer there is httpOnly cookies — §4.

### 3.2 `issuer` / `audience` are signed but not yet verified

`TokenService` now stamps both onto new tokens. `authenticate` does **not**
assert them, because tokens minted before this shipped carry neither and
requiring them would reject every session in flight.

Once the seven-day refresh window has turned over, adding
`issuer: config.auth.jwtIssuer, audience: config.auth.jwtAudience` to
`VERIFY_OPTIONS` costs nothing and closes cross-token replay. **One line, safe
after 2026-09-19.**

---

## 4. Moving the session to httpOnly cookies — **done, one piece still open**

The remaining exposure was that a successful XSS read both tokens out of
`localStorage`. It no longer can: neither token is there.

**Where they live now.**

| | before | now |
|---|---|---|
| Access token | `localStorage`, 2h | Redux only, dies with the tab |
| Refresh token | `localStorage`, 7d | `HttpOnly` cookie, `Path=/auth` |

An XSS can still *act* as the member while the page is open — no client-side
control prevents that, and claiming otherwise would be the wrong lesson to draw
from this. What it can no longer do is take a seven-day credential away with it.
That is the whole of what httpOnly buys, and it is worth having: the difference
between an attack that ends when the tab closes and one that continues from the
attacker's own machine for a week.

### The cross-site problem, and what was done about it

The frontend is `https://famlink.care`; the API is
`backend-bitter-shape-3085.fly.dev`. Different registrable domains, so every
request from the app to the API is **cross-site**, and a cookie set
`SameSite=Strict` or `Lax` would simply not be sent — nobody could sign in.

So production sets `SameSite=None; Secure`, which is the only value that travels
cross-site. That removes the CSRF protection `SameSite` would otherwise provide,
and this is worth stating plainly rather than glossing: `Authorization: Bearer`
had **no** CSRF exposure at all, because a foreign page cannot set that header.
Moving to a cookie *introduces* a risk that was not there before.

**What replaces it.** A request must carry `X-Session-Transport: cookie` or the
server ignores the cookie entirely — `readRefreshCookie` returns null and the
request is treated as having presented nothing. A cross-site form post cannot
set a custom header, and a fetch or XHR that tries triggers a preflight that the
CORS allowlist fails. This is option 2's "enforced custom header", and it costs
one header on four endpoints.

The same header is how a client opts into cookie transport at all, which is what
keeps the **admin console** — a separate application calling the same
`/auth/login` — working unchanged: no header, no cookie, `refreshToken` in the
body exactly as before. It moves over whenever it sends the header.

That combination cannot be used to downgrade an attack. The body path only hands
a token back to a caller that already presented one, and an XSS on the frontend
has none to present — it cannot read the cookie, which is the point. Asking
without the header gets it nothing.

### What is still open: option 1, the DNS record

**Putting the API on `api.famlink.care` is still the right answer** and is now a
one-variable change rather than a migration. Frontend and API become same-site,
`REFRESH_COOKIE_SAMESITE=strict` takes effect, and the CSRF protection comes
from the browser instead of from a header check. It also removes the exposure to
browsers progressively restricting `SameSite=None` cookies in third-party
contexts, which is exactly this pattern.

It was not done here because it is an infrastructure decision — a DNS record and
a fly certificate — not a code change.

### What shipped alongside

- `withCredentials: true` on the axios instance, and `X-Session-Transport` added
  to the CORS `allowedHeaders` (without it the preflight fails and no session can
  be established at all).
- **`POST /auth/logout`**, which did not exist. Signing out used to be entirely
  client-side, so the stored row stayed valid for seven days after every "sign
  out" regardless of what the browser did with its copy. It cannot be
  client-side now in any case: JavaScript cannot delete an httpOnly cookie.
- A **boot-time session restore** (`features/auth/store/restoreSession.js`). The
  access token no longer survives a reload, so the app trades the cookie for a
  new one on load, and a request gate in `@shared/api/client` holds outgoing
  requests until it settles.
- **A rehydrate guard** (`discardStoredTokens`). Dropping the tokens from the
  persist whitelist is not sufficient on its own: redux-persist consults the
  whitelist in `createPersistoid`, when *writing*, and nowhere when reading. A
  key that is no longer whitelisted keeps being rehydrated out of every browser
  that still holds an older copy of the blob. Without the guard the first load
  after this deploy would have restored the old access token from disk, skipped
  the session restore because a token was already in hand, and dropped the
  member mid-session up to two hours later instead of once, cleanly, at the
  start. There is a test asserting the underlying behaviour, so the reason the
  guard exists does not have to be remembered.

- **Single-flight refresh.** Refreshing rotates the token, so two concurrent
  refreshes meant the second presented one that had already been replaced and
  got a 401 — read as "session over", signing the member out. Harmless while a
  refresh only happened on expiry; not harmless once every reload triggers one
  and nine components dispatch it on mount.

### Still to do, in order

1. **`api.famlink.care`** (above), then `REFRESH_COOKIE_SAMESITE=strict`.
2. **Hash the stored refresh tokens** (§3.1). The one-time logout that ruled it
   out has now been spent anyway.
3. **Tighten `persistedUser` to an allow-list** (§2.10). The shell is re-fetched
   on every load now; what remains is gating the first render on the restore so
   the four-field object is never what routing reads.
4. **Assert `issuer`/`audience`** (§3.2) — one line, safe after 2026-09-19.

**Note this signs everyone out once.** Existing sessions have their tokens in
`localStorage`, which the new build no longer reads, and there is no cookie yet
to replace them. Members sign in again; nothing else about their account is
affected.

---

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | *required in prod* | Access-token signing key. No fallback. |
| `REFRESH_TOKEN_SECRET` | *required in prod* | Refresh-token signing key. |
| `CORS_ORIGINS` | *empty* | Extra browser origins, comma-separated. **Added to** the built-in list in `corsPolicy.js`, never replacing it — so leaving it unset is the normal case and cannot lock the frontend out. |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum length where a password is set. |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses before a code is burned. |
| `JWT_ISSUER` | `famlink` | Stamped on new tokens; not yet verified. |
| `JWT_AUDIENCE` | `famlink-app` | Stamped on new tokens; not yet verified. |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost. |
| `REFRESH_COOKIE_SAMESITE` | `none` in prod, `lax` otherwise | The one setting that depends on where the API lives. `none` is required while the API is cross-site from the frontend; becomes `strict` the day it moves to `api.famlink.care`. |
| `REFRESH_COOKIE_SECURE` | `true` in prod | Forced true whenever SameSite is `none` — browsers discard that combination without it, which would mean no session cookie at all. |
| `REFRESH_COOKIE_NAME` | `famlink_rt` | Cookie name. |
| `REFRESH_COOKIE_DOMAIN` | *unset* | Left unset so the cookie is host-only, which is narrower and correct while the API has its own hostname. |

`JWT_SECRET` and `REFRESH_TOKEN_SECRET` are absent from the local `.env`, which
is why the development fallbacks in `config/index.js` are in use. Production
refuses to boot without them.

---

## 6. What happens now

**For members.** Everyone is signed out once, by the cookie migration (§4) — the
tokens the browser is holding are in `localStorage`, which the new build no
longer reads. Signing in again is all that is required; nothing else about an
account changes. Passwords and the reset link flow work unchanged. Other visible
differences: a failed sign-in says "Invalid email or password" rather than
distinguishing the two cases, repeated failures are throttled, and new or reset
passwords must be at least 8 characters.

**Deploy order: backend first.** The backend change is backward compatible — a
client that sends no `X-Session-Transport` header gets exactly the old response —
so it can ship on its own and the current frontend keeps working. The frontend
cannot: it needs `/auth/logout` and the cookie to exist. Shipping the frontend
first would leave members unable to stay signed in past their access token.

**On deploy.** Nothing to configure for CORS: both production frontend origins
are constants in `corsPolicy.js` (§2.8), so no variable has to be right for the
app to reach its own API. If the frontend ever moves to another hostname, that
is a one-line edit to `PRODUCTION_ORIGINS` and a code review — which is the
point. The cookie variables in §5 have working defaults and need no action.
`helmet` is a new dependency.

**Verified.** 778 backend tests and 143 frontend tests pass. Retired routes
return 404; unknown-email and wrong-password login responses are byte-identical;
the login limiter returns 429 on the 11th attempt for an account; unknown CORS
origins receive no `Access-Control-Allow-Origin`; security headers present.

Against a running server and database, over HTTP: sign-in returns
`Set-Cookie: famlink_rt=…; Path=/auth; HttpOnly` and **no** `refreshToken` in the
body; refresh works from the cookie alone and rotates it; the same cookie without
`X-Session-Transport` is refused, which is the CSRF case; the access token
authenticates a real endpoint and its absence 401s; `/auth/logout` clears the
cookie and revokes the row, so a token that worked seconds earlier is then
rejected; and a client that sends no transport header — the admin console — still
receives `refreshToken` in the body, receives no cookie, and can still refresh.

**Next, in order.** §4's remaining list: the DNS record for `api.famlink.care`
and `REFRESH_COOKIE_SAMESITE=strict`, then refresh-token hashing (§3.1), then the
allow-list tightening (§2.10). The `issuer`/`audience` assertion (§3.2) is a
one-line change safe from 2026-09-19.
