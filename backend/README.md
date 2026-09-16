# FamLink Backend

A Node/Express + MongoDB API organised as **feature modules** over a small
shared core. Every HTTP endpoint lives in exactly one module, and every module
is built from the same four pieces: a **RouteModule** that declares where it
mounts, a **Controller** that touches `req`/`res`, a **Service** that holds the
rules, and a **Repository** that talks to Mongo.

- **Runtime:** Node ≥ 18, ESM (`"type": "module"`)
- **Framework:** Express 4, Socket.IO, Mongoose
- **Tests:** Vitest — 729 tests, no database or network required
- **Scale:** 49 feature modules, 213 routes

---

## Contents

1. [Quick start](#quick-start)
2. [The block diagram](#the-block-diagram)
3. [How a request flows](#how-a-request-flows)
4. [The four layers](#the-four-layers)
5. [Worked example: one real request end to end](#worked-example-one-real-request-end-to-end)
6. [Directory map](#directory-map)
7. [The core, file by file](#the-core-file-by-file)
8. [Cross-cutting concerns](#cross-cutting-concerns)
9. [Boot and shutdown sequence](#boot-and-shutdown-sequence)
10. [Testing](#testing)
11. [The legacy `Routes/` remainder](#the-legacy-routes-remainder)
12. [Adding a new module](#adding-a-new-module)

---

## Quick start

```bash
npm install
cp .env.example .env

npm run db:up        # local MongoDB in Docker (see below)
npm run dev          # nodemon index.js

npm start            # node index.js
npm test             # vitest run
npm run test:watch
npm run test:coverage
```

### Development never talks to the production database

`.env` on a developer's machine holds the deployed `MONGO_DB_URI`, because it is
the same file the deployed environment uses. So `npm run dev` used to open a
connection to the production cluster, and every local experiment — a seed
script, a half-finished migration, a debugger stepping through a delete — ran
against real member data.

Outside production the URI now resolves in this order:

| | Source | Used when |
|---|---|---|
| 1 | `MONGO_DB_URI_DEV` | Set. Always wins — this is the "point me somewhere else" knob |
| 2 | `MONGO_DB_URI` | It is local, **or** `ALLOW_REMOTE_DB=true` |
| 3 | `mongodb://127.0.0.1:27017/famlink` | Nothing else applies |

A remote `MONGO_DB_URI` is therefore ignored in development rather than
obeyed. `src/core/database/Database.js` then refuses outright to open a
non-local connection outside production — that second check is the backstop for
code that skips the config, such as a script doing `new Database({ uri })`,
which is precisely where an accidental production connection is most likely and
most costly. It refuses rather than warns: a warning scrolls past, and by the
time it is read the writes have happened.

`ALLOW_REMOTE_DB=true` restores the old behaviour for the rare case where
pointing a local process at a staging cluster is the right thing to do. It has
to be typed on purpose.

**Production is unaffected** — it reads `MONGO_DB_URI` exactly as before.

### The local database

`mongod` is not required; the compose file runs it in Docker. Start Docker
Desktop first, then:

```bash
npm run db:up        # start it (waits until it answers queries)
npm run db:shell     # mongosh, attached to the famlink database
npm run db:down      # stop it, keeping the data
npm run db:reset     # destroy the volume and start clean
```

The container publishes to `127.0.0.1:27017` only, never `0.0.0.0` — on a
laptop the difference is whether the café wifi can reach your database. Data
lives in a named volume, so `db:down` is safe and `db:reset` is the deliberate
way to lose it. The local database is named `famlink`, matching the deployed
one, so a dump restores without renaming anything.

Prefer a MongoDB you already run? Point `MONGO_DB_URI_DEV` at it and skip all of
the above.

**Required environment variables** — the process refuses to boot in production
without these (`assertRequiredEnv` in `src/config/index.js`):

| Variable | Purpose |
|---|---|
| `MONGO_DB_URI` | MongoDB connection string. In development this is ignored unless local — see above |
| `JWT_SECRET` | Signs access tokens |
| `REFRESH_TOKEN_SECRET` | Signs refresh tokens |

Everything else is optional and degrades gracefully — an unset
`GOOGLE_SHEET_READER_URL` makes the sheets screen say "not set up yet" rather
than erroring. All of it is read in one place: **`src/config/index.js`**. No
other file reads `process.env`.

Path aliases (declared in both `package.json` `imports` and `vitest.config.js`):

```js
import { userRepository } from "#src/modules/user/user.repository.js";
```

---

## The block diagram

```
                                   ┌──────────────┐
   HTTP request                    │   frontend/  │  ┌─────────────────────┐
   ───────────────────────────────►│  Famylink-   │  │  Famylink-admin     │
                                   │  admin (sep. │  │  (separate Next.js  │
                                   │  repos)      │  │   repo → /admin/*)  │
                                   └──────┬───────┘  └──────────┬──────────┘
                                          │                     │
  ════════════════════════════════════════▼═════════════════════▼═══════════════
                              index.js  →  src/bootstrap.js
  ═══════════════════════════════════════════════════════════════════════════════
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │           src/core/Server.js               │
                    │  DB connect → HTTP listen → sockets → jobs │
                    └─────────────────────┬──────────────────────┘
                                          │ builds
                    ┌─────────────────────▼──────────────────────┐
                    │        src/core/Application.js             │
                    │        the middleware pipeline             │
                    └─────────────────────┬──────────────────────┘
                                          │
     ┌────────────────────────────────────▼─────────────────────────────────┐
     │  1. raw-body modules      ← BEFORE the JSON parser (Stripe webhook)  │
     │  2. express.json / urlencoded (10 mb)                                │
     │  3. cors                                                             │
     │  4. static  /assets/uploads, /assets/audio                           │
     │  5. GET /health           ← no DB touch; answers while Mongo is down  │
     │  6. ModuleRegistry router ← all 213 routes                           │
     │  7. legacy Routes/ router ← 4 excluded prefixes only                 │
     │  8. notFoundHandler → errorHandler   ← single exit for every error   │
     └────────────────────────────────────┬─────────────────────────────────┘
                                          │
     ┌────────────────────────────────────▼─────────────────────────────────┐
     │                       src/modules/<feature>/                         │
     │                                                                      │
     │   ┌──────────────┐   declares basePath + registerRoutes()            │
     │   │ RouteModule  │   e.g. "/userData", "/admin/reports"              │
     │   └──────┬───────┘                                                   │
     │          │ mounts                                                    │
     │   ┌──────▼───────┐   reads req, shapes res. NO business rules.       │
     │   │  Controller  │   auto-bound + async errors forwarded to next()   │
     │   └──────┬───────┘                                                   │
     │          │ plain values                                              │
     │   ┌──────▼───────┐   the rules. No req, no res, no status codes.     │
     │   │   Service    │   throws typed errors from core/errors            │
     │   └──────┬───────┘   collaborators arrive via the constructor        │
     │          │                                                           │
     │   ┌──────▼───────┐   every query against a collection                │
     │   │  Repository  │   owns projections — see user.privacy.js          │
     │   └──────┬───────┘                                                   │
     └──────────┼───────────────────────────────────────────────────────────┘
                │
        ┌───────▼────────┐        ┌──────────────────────────────────────┐
        │    Mongoose    │        │            src/shared/               │
        │    MongoDB     │        │  email · sms · storage · integrations│
        └────────────────┘        │  cache · jobs · throttle · utils     │
                                  └──────────────────────────────────────┘
                                                    │
                                    Stripe · Twilio · Cloudinary · Google
                                    Maps/Sheets · Redis · SMTP · Slack
```

**The one rule the arrows encode:** dependencies point *inward and downward*. A
module may use the core and the shared layer; the core knows nothing about any
module; `shared/` knows nothing about HTTP.

---

## How a request flows

1. **Express receives the request.** The Stripe webhook is matched first,
   before `express.json()`, because it needs the literal bytes it was signed
   over. Everything else gets a parsed body.

2. **The ModuleRegistry router matches a prefix.** Each module was mounted at
   its own `basePath`. The registry refuses duplicate basePaths at boot — two
   modules claiming `/admin` is not a merge, it is one of them never being
   reached.

3. **Module-level middleware runs.** Usually `authenticate` (sets `req.userId`
   and `req.auth`) or `adminOnly` (also sets `req.admin`). Mounted with
   `router.use(...)` at the top of the module so a route added later is
   protected by default rather than by whoever writes it remembering.

4. **The controller is invoked.** It pulls values off `req`, calls the service
   with plain arguments, and shapes the response. It has no `try/catch` —
   `BaseController` wraps every method so a rejected promise becomes
   `next(error)`.

5. **The service applies the rules.** It never sees `req` or `res`. When
   something is wrong it throws — `ValidationError`, `ForbiddenError`,
   `NotFoundError`, `ConflictError`, `UpstreamServiceError` — and never picks a
   status code itself.

6. **The repository runs the query.** Projections live here, not at call sites,
   so `findPublicById` cannot accidentally return a password hash.

7. **The response is shaped and sent,** or the error reaches
   **`errorHandler`** — the single place any failure becomes a status code and
   a body.

---

## The four layers

| Layer | File suffix | May touch | Must never |
|---|---|---|---|
| **Module** | `*.module.js` | Express router, middleware, wiring | Contain business rules |
| **Controller** | in `*.module.js` or `*.controller.js` | `req`, `res`, presenters | Query the database |
| **Service** | `*.service.js` | Repositories, other services, shared/ | Import `req`/`res` or set status codes |
| **Repository** | `*.repository.js` | Mongoose models | Know why it is being called |

Two supporting file kinds appear throughout:

- **`*.presenter.js`** — pure shaping of a document into a response body.
  Response shapes are fixed by the frontend, so isolating them keeps query
  logic readable.
- **`*.model.js`** — the Mongoose schema. Models are grouped by feature, not in
  one `Schema/` folder, so a feature is one directory.

### Why dependency injection

Services receive collaborators through the constructor:

```js
new BlogService({
  blogRepository,
  uniqueSlug,          // queries the collection for collisions
  imageUploader,       // Cloudinary
  notifyAboutNewBlog,  // SMTP
});
```

That is what makes the 729-test suite need **no database, no mail host and no
network** — a test passes plain objects. It is also why `uniqueSlug` is injected
rather than imported: it looks pure, but it queries Mongo.

---

## Worked example: one real request end to end

`GET /userData/getById/:id` — one member viewing another's profile.

```
  GET /userData/getById/64f… ─────────────────────────────────────────────┐
                                                                          │
  1. Application: cors → express.json → registry router                   │
                                                                          │
  2. UserDataModule (src/modules/user/userData.module.js)                 │
       static basePath = "/userData"                                       │
       router.use(authenticate)      ← verifies the bearer token,          │
                                       sets req.userId                     │
       router.get("/getById/:id", controller.profile)                      │
                                                                          │
  3. UserDataController.profile(req, res)                                 │
       calls directory.getProfile(req.params.id)                           │
                                                                          │
  4. UserDirectoryService.getProfile(id)                                  │
       userRepository.findPublicById(id, { populate: reviews.userId })     │
       → not found?  throw new NotFoundError("User not found")             │
       profileRepository.findByUserId(id)                                  │
       returns { ...toPublicUser(user), nannyProfile, averageRating }      │
                                                                          │
  5. UserRepository.findPublicById                                        │
       find with select: PUBLIC_USER_SELECT                                │
       ← the projection is the privacy control: the database is never      │
         asked for password, email, phoneNo, stripeId or coordinates       │
                                                                          │
  6. toPublicUser() coarsens the address a second time (street → city)     │
                                                                          │
  7. Controller: res 200 { status: 200, message: <profile> }               │
                                                                          │
  …or NotFoundError ──► errorHandler ──► 404 { message, code } ───────────┘
```

Note step 5 and step 6 are **two independent defences**. The projection stops
the database returning a home address; the serializer coarsens whatever is left.
Removing either one leaks on its own.

---

## Directory map

```
backend/
├── index.js                 Process entry point. 17 lines: "this process is a server."
├── vitest.config.js         Test runner + #src / #tests aliases
├── Dockerfile, fly.toml     Deployment
│
├── src/
│   ├── bootstrap.js         Assembles the app: registry + legacy router + jobs + sockets
│   ├── config/index.js      THE ONLY reader of process.env. Typed, with defaults.
│   ├── core/                Framework. Knows nothing about any feature.
│   ├── modules/             The features. One directory per feature.
│   └── shared/              Outward-facing capabilities. Knows nothing about HTTP.
│
├── tests/                   Mirrors src/. Vitest.
├── scripts/                 One-off operational scripts (run by hand)
├── Automated Emails/        HTML email templates (23 files)
│
├── Routes/                  LEGACY — 4 excluded prefixes only. See below.
└── Controllers/             LEGACY — 1 file (phantombuster)
```

### `src/core/` — the framework

| File | Purpose |
|---|---|
| `Application.js` | Builds the Express app: middleware order, module mount, error boundary. **Binds no port.** |
| `Server.js` | Owns the process: DB → HTTP listen → sockets → jobs, and graceful shutdown. |
| `database/Database.js` | Mongoose connection lifecycle. |
| `database/BaseRepository.js` | Shared query mechanics: `findById`, `paginate`, `updateById`, `aggregate`, `toObjectId`. |
| `http/RouteModule.js` | The contract every module implements: `basePath`, `registerRoutes()`, `describe()`. |
| `http/ModuleRegistry.js` | Mounts modules, refuses duplicate basePaths, produces the route table. |
| `http/BaseController.js` | Auto-binds methods and forwards async rejections to `next()`. Response helpers. |
| `http/BaseService.js` | Assigns constructor dependencies onto `this`. Deliberately tiny. |
| `http/middleware/authenticate.js` | `authenticate` + `optionalAuthenticate`. Sets `req.userId` / `req.auth`. |
| `http/middleware/errorHandler.js` | The single exit. Normalises Mongoose/JWT/multer errors; decides what a 5xx may say. |
| `http/middleware/rateLimit.js` | Per-route limiter (used by reports, OTP paths). |
| `http/middleware/upload.js` | Multipart parsing (multer, in-memory) with the size and part-count caps. |
| `errors/AppError.js` | Base error with `statusCode`, `code`, `details`, `isOperational`. |
| `errors/index.js` | `ValidationError` 400 · `UnauthorizedError` 401 · `ForbiddenError` 403 · `NotFoundError` 404 · `ConflictError` 409 · `TooManyRequestsError` 429 · `UpstreamServiceError` 502 |

### `src/modules/` — the features

Each directory is one feature and owns its models, rules and routes.

| Module | Mounts at | What it does |
|---|---|---|
| `auth` | `/auth`, `/email-verification`, `/sms-verification` | Register, sign in, tokens, OTP, account status policy |
| `user` | `/userData`, `/edit`, `/update` | Member directory, profile edit, account settings |
| `profile` | `/nanny` | The detailed care profile behind the nanny-share flow |
| `share` | `/share` | Nanny-share browse + public share links |
| `match` | `/match` | Match requests, accept/reject/block, the paywall |
| `messaging` | `/chats`, `/message` | Conversations, messages, moderation, sockets |
| `billing` | `/payment/stripe`, `/subscribe`, `/revenue`, `/stripe` | Cards, subscriptions, newsletter, the Stripe webhook |
| `blog` | `/blogs` | Resource articles, drafts, publishing |
| `review` · `feedback` · `report` | `/reviews`, `/feedback`, `/reports` | Ratings, in-app feedback, member reports |
| `referral` | `/referral` | Referral codes and the free-matching benefit |
| `waitlist` · `lead` | `/waitlist`, `/leads`, `/resource-leads`, `/onboarding-leads` | Capture funnels |
| `location` | `/location` | Geocoding and privacy-coarsened map pins |
| `legal` | `/legal` | Public terms & policies |
| `analytics` | `/analytics` | The page-view beacon |
| `verification` | `/verify` | Government-ID document review |
| `unsubscribe` · `favourite` · `onboarding` · `debug` | various | Self-explanatory |
| `admin` | `/admin/*`, `/adminUser` | The whole console — 17 sub-modules |
| `booking` · `job` · `nannyShare` · `notification` | — | Models/repositories only; their routes are excluded (see below) |

### `src/shared/` — outward-facing capabilities

Anything that talks to the outside world, or is used by more than one module.
**Nothing here imports Express.**

| Folder | Contents |
|---|---|
| `email/` | `email.js` (all senders), the send log, launch-email model, unsubscribe tokens |
| `sms/` | Twilio |
| `storage/` | Cloudinary — the client and `uploadImage()`. Multipart *parsing* is middleware, so it lives in `core/http/middleware/upload.js`. |
| `integrations/` | Google Maps, Google Sheets reader, Slack |
| `cache/` | Redis client (lazy-connecting) |
| `jobs/` | The seven cron jobs — reminders, digests, traffic rollup |
| `throttle/` | `ConfirmationThrottle` — key-based send throttling |
| `auth/` | `middlewareAuth.js`, the legacy auth middleware still used by `adminOnly` |
| `utils/` | `sanitizeHtml`, `serviceArea`, `capitalize`, `convertToSec`, `publicUrl` |

---

## The core, file by file

### `Application.js` — middleware order is behaviour, not style

```js
1  raw-body modules        // modules declaring `static rawBody = true`
2  express.json / urlencoded
3  cors
4  static assets
5  GET /health             // no DB access, so it answers while Mongo is down
6  registry.createRouter()
7  legacyRouter            // strictly after the modules
8  notFoundHandler
9  errorHandler
```

Two orderings carry real consequences:

- **Raw body before JSON.** Stripe signs the exact bytes it sent. `express.json()`
  consumes the stream and hands on an object, and re-serialising that object does
  not reproduce those bytes. If this inverted, every webhook would fail its
  signature check — and since `premium` is granted *only* from the webhook,
  customers would pay and stay on the free tier, silently. There is a test
  (`tests/core/rawBodyMounting.test.js`) asserting the order holds.
- **Modules before legacy.** Express matches in registration order, so a
  migrated prefix is answered by its module and never falls through.

### `BaseController.js` — two mechanics

```js
router.get("/x", controller.show)   // passed without its receiver
```

1. **Binding.** Every method is bound in the constructor, so `this` works and a
   missed `.bind(this)` cannot produce a crash on one endpoint only.
2. **Error forwarding.** Express 4 does not catch rejected promises from async
   handlers — the request hangs until the client gives up. Every method is
   wrapped so a rejection becomes `next(error)`. **This is why no controller in
   this codebase has a `try/catch`.**

Response helpers: `ok()`, `sendData()`, `created()`, `message()`, `noContent()`.
Their shapes are fixed by 35 existing Redux slices.

### `errorHandler.js` — what a failure is allowed to say

Normalises Mongoose `CastError` → 400, validation errors → 400 with per-field
detail, duplicate key `11000` → 409 (names the field, **never** echoes the
value), JSON parse failure → 400, JWT errors → 401.

Then one rule:

> A 4xx always speaks for itself; a 5xx only when it explicitly opted in.

So `NotFoundError("User not found")` reaches the client verbatim, while an
unexpected 500 becomes `"Something went wrong"`. `UpstreamServiceError` opts in
(`expose: true`) because "Could not reach Stripe" is useful — but only messages
*we* authored may be exposed, never an upstream's, since a third-party error
string can contain a URL carrying our API key.

### `BaseRepository.js`

`lean` defaults to **false**, so a document behaves like one from a bare
`Model.findById()` — it has virtuals and `.save()` works. Read-only paths pass
`{ lean: true }`. `paginate()` caps `limit` at 200; several list endpoints
return whole user records, and an uncaught `?limit=100000` would dump the
collection. `toObjectId()` turns a CastError-500 into a ValidationError-400.

---

## Cross-cutting concerns

### Privacy projections — `src/modules/user/user.privacy.js`

The most important file in the codebase. Fields are tiered:

| Tier | Who sees it |
|---|---|
| `SECRET_USER_FIELDS` | Nobody — not even the account owner (bcrypt hash, OTP, reset tokens) |
| `INTERNAL_USER_FIELDS` | Admins only (moderation notes — they can identify a reporter) |
| `PRIVATE_USER_FIELDS` | The owner and admins (email, phone, DOB, Stripe id) |
| `PUBLIC_USER_FIELDS` | Any signed-in member (the marketplace profile) |

Whitelists, not blacklists: a field added to the schema tomorrow is private
until somebody deliberately lists it. `location.coordinates` is never projected
— `PUBLIC_LOCATION_PATHS` names the address subpath by subpath, because
projecting the parent returns the whole subdocument including the exact lat/lng
of a home.

### The admin audit trail — `src/modules/admin/adminAudit.js`

`logAdminAction()` records who did what, to whom, and why. Two conventions:

- **Reading private messages is audited, and the row is written *before* the
  response.** If the trail cannot record the access, the access does not happen.
- **Destructive actions snapshot first.** A message is copied into the audit row
  before it is deleted, so the evidence survives the removal.

### Background jobs — `src/shared/jobs/`

Seven cron jobs, started by `Server` **after** the database is connected — they
used to be scheduled inside the `listen` callback, where a job could fire
against a database that had not finished connecting.

### Sockets — `*.socket.js`

`chat.socket.js` and `booking.socket.js` attach to the Socket.IO server.
`maxHttpBufferSize` is 10 MB for voice messages.

---

## Boot and shutdown sequence

```
index.js
   └─ startServer()                       src/bootstrap.js
        ├─ assertRequiredEnv()            fail fast on missing secrets
        ├─ buildApp({ legacy: true })
        │    ├─ createRegistry()          instantiate all 49 modules
        │    └─ new Application(...)      build the middleware pipeline
        └─ new Server({ app, jobs, socketHandlers }).start()
             ├─ 1. database.connect()     before anything can serve or run
             ├─ 2. http.listen(port)
             ├─ 3. Socket.IO attach
             └─ 4. start cron jobs

SIGTERM / SIGINT
   └─ server.stop()
        ├─ stop jobs → close sockets → close HTTP → disconnect DB
        └─ 10s force-exit backstop
```

`buildApp({ legacy: false })` produces a **completely inert** app — no port, no
database, no cron — which is what the route-parity and unit suites rely on.

---

## Testing

```bash
npm test
```

| Suite | What it guards |
|---|---|
| `tests/architecture/routes.test.js` | **Route parity.** Every migrated prefix must reproduce its pre-refactor route table exactly, from `route-baseline.json`. |
| `tests/architecture/imports.test.js` | The import graph — no module reaches into another's internals. |
| `tests/core/` | The framework: controller binding, error normalisation, repository mechanics, registry, raw-body order. |
| `tests/modules/` | One file per service. Fakes for every collaborator. |

### `route-baseline.json` — the safety net

A static snapshot of the route table as it existed **before** the refactor. The
parity test asserts every migrated prefix still serves exactly those
`{method, path}` pairs. A handler dropped, renamed, or given a different method
during a move fails a test instead of becoming a 404 for whoever calls it first.

It is regenerated **only** when a prefix is deliberately retired, and the
retirement is recorded in `RETIRED_PREFIXES`. Regenerating it to make a failure
go away defeats the entire point.

---

## The legacy `Routes/` remainder

Four prefixes are still served by the original router, mounted *after* the
module registry. Each is here for a stated reason, not because nobody got to it:

| Prefix | Why |
|---|---|
| `/nannyShare` | 7 frontend call sites; backs the six-step questionnaire funnel |
| `/postJob` | 6 call sites; post-a-job and job listing screens |
| `/book-hire` | 30 call sites across five Redux slices |
| `/phantombuster` | Scraped-profile intake. Left running, deliberately not restructured. |

The first three were scoped out of the restructure by the project owner. All
four are recorded in `UNMIGRATED_PREFIXES` in the parity test.

The old `Schema/`, `Services/`, `Routes/admin/` and the rest of the pre-refactor
tree are gone — models live with their feature under `src/modules/`, and shared
capabilities under `src/shared/`.

---

## Adding a new module

```
src/modules/widget/
├── widget.model.js       Mongoose schema
├── widget.repository.js  queries + projections
├── widget.service.js     the rules
└── widget.module.js      controller + routes + wiring
```

```js
// widget.module.js
import { RouteModule } from "../../core/http/RouteModule.js";
import { BaseController } from "../../core/http/BaseController.js";
import { authenticate } from "../../core/http/middleware/authenticate.js";
import { WidgetService } from "./widget.service.js";
import { widgetRepository } from "./widget.repository.js";

class WidgetController extends BaseController {
  constructor({ widgetService }) {
    super();
    this.widgetService = widgetService;
  }

  async list(req, res) {
    // No try/catch — BaseController forwards rejections to next().
    return this.sendData(res, await this.widgetService.list(req.userId));
  }
}

export class WidgetModule extends RouteModule {
  static basePath = "/widgets";
  static moduleName = "widgets";

  registerRoutes(router) {
    const controller = new WidgetController({
      widgetService: new WidgetService({ widgetRepository }),
    });

    router.use(authenticate);
    router.get("/", controller.list);
  }
}
```

Then register it in **`src/modules/index.js`** — that array is the API surface.
A module not listed there is unreachable.

### Checklist

- [ ] Routes declared in `registerRoutes`, literals before `/:params`
- [ ] Auth applied with `router.use(...)`, not per route
- [ ] Service throws typed errors; never sets a status code
- [ ] Repository owns the projection — no secrets in a member-facing read
- [ ] Collaborators injected via the constructor (anything touching Mongo, mail, or the network)
- [ ] Tests in `tests/modules/widget/` using fakes
- [ ] `npm test` green, including route parity
