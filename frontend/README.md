# FamLink — frontend

React 18 + Vite + Redux Toolkit, organised by feature. Every screen, its state,
its API calls and its helpers live in one folder, so a change to nanny shares is
a change inside `features/nanny-share/` and nowhere else.

```
npm run dev            # dev server on :5173
npm run build          # production build + prerendered meta + sitemap
npm run test           # vitest, single run
npm run test:watch     # vitest, watching
npm run lint           # eslint
```

---

## The shape of it

Three layers, and the dependency arrows only ever point downward.

```
                            ┌───────────────────────────────┐
   index.html ──▶ main.jsx  │  app/                         │
                            │                               │
                            │   Providers  ─ OAuth, store,   │
                            │               PersistGate,     │
                            │               socket           │
                            │   App        ─ the route table │
                            │   PageLayout ─ header/footer   │
                            │   RouteOutlet─ Suspense slot   │
                            │   store      ─ combines slices │
                            │   layout/    ─ navbars, footer │
                            └───────────────┬───────────────┘
                                            │  renders + dispatches
                                            ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  features/<domain>/                                                │
   │                                                                    │
   │    pages/        the screens a route points at                     │
   │    components/   pieces used only by this feature                  │
   │    store/        Redux slices + thunks for this feature            │
   │    api/          a service class owning this feature's URLs        │
   │    hooks/        feature-specific hooks                            │
   └────────────────────────────────┬───────────────────────────────────┘
                                    │  calls
                                    ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  shared/                                                           │
   │                                                                    │
   │    api/      axios client, HttpService base class                  │
   │    ui/       Button, Input, Loader, Modal-free primitives, toast   │
   │    lib/      dates, rates, children, strings, serviceArea…         │
   │    realtime/ socket hook + provider                                │
   │    seo/      route metadata, JSON-LD, <SEOMetaData>                │
   │    store/    the one slice no single feature owns (form buffer)    │
   └────────────────────────────────────────────────────────────────────┘
```

**`shared/` must never import from `features/`.** It is the bottom of the stack;
an arrow back upward makes it unusable on its own and creates import cycles that
only show up at runtime. Features importing each other is allowed and normal —
`matching` renders a profile card that `nanny-share` owns.

### The 18 features

| Feature | What it owns |
|---|---|
| `nanny-share` (53) | The core domain: post a share, browse, profiles, city landing pages, match form |
| `onboarding` (35) | The questionnaire flows run before a profile exists — caregiver-job, caregiver-share, family |
| `marketing` (23) | Public landing pages: home, caregivers, events |
| `jobs` (21) | Post a job, job listings, applications, the per-job-type questionnaires |
| `dashboard` (19) | The signed-in shell, settings, favourites, profile editing |
| `matching` (14) | Match requests in and out, the gates, the modals, reports |
| `booking` (14) | The booking request lifecycle — one slice per state a request can be in |
| `auth` (14) | Login, signup, password reset, phone/email verification |
| `resources` (13) | Resource centre, downloadable guides, articles |
| `hire` (11) | The public "find a nanny" lead form at `/hire` |
| `share-link` (9) | The public `/share/:token` page and its OG card |
| `chat` (8) | Messaging for both roles |
| `subscription` (7) | Stripe checkout, billing, plan settings |
| `referral` (5) | Refer-a-friend and its reward modals |
| `waitlist` `legal` `feedback` `notifications` | Small, single-purpose |

---

## How a request flows

Taking "a family logs in" end to end:

```
  Login.jsx                       features/auth/pages
      │  dispatch(loginThunk(credentials))
      ▼
  authSlice.js                    features/auth/store
      │  the thunk owns Redux state, nothing else
      ▼
  authService.login(credentials)  features/auth/api/AuthService
      │  owns the URL: POST /auth/login
      ▼
  HttpService#post                shared/api/HttpService
      │  normalises the response to { data, status }
      │  guarantees error.response.data exists on a network failure
      ▼
  api (axios)                     shared/api/client
      │  request interceptor attaches the session
      ▼
  backend
```

Coming back, `loginThunk.fulfilled` writes the user and tokens into `state.auth`,
redux-persist mirrors the whitelisted fields to localStorage, and `App.jsx`
re-renders — which swaps the route table from the logged-out branch to the member
branch.

### Why each hop exists

**`store/` (thunks) owns state, `api/` owns URLs.** Splitting them means changing
an endpoint is a one-line edit in one file, and the calls can be tested by handing
a service a fake client rather than standing up a store.

**Services never build an `Authorization` header.** The client's request
interceptor does it, reading from the store rather than from redux-persist's copy
in localStorage — that copy is written on a timer, so for a beat after login it
still says logged-out, and every request fired in that window came back 401 with
nothing to retry it. 57 call sites used to rebuild that header by hand; each was
reimplementing the interceptor with no way to benefit from its fix.

**The store hands its reader to the client, not the other way round:**

```js
// app/store.js
setAccessTokenReader(() => store.getState()?.auth?.accessToken);
```

`client.js` used to `import { store }`, making a cycle: store → slices → client →
store. It survived only because `store` was read *inside* the interceptor, long
after every module had evaluated. The moment a slice imported a service class —
`class AuthService extends HttpService`, which needs its import resolved at
definition time — the cycle broke the app with `Class extends value undefined`.
The inversion removes it.

---

## Conventions

### Import aliases

Defined once in `aliases.js`, consumed by `vite.config.js` and `vitest.config.js`;
`jsconfig.json` repeats them for the editor and a test asserts the two agree.

| Alias | Points at |
|---|---|
| `@/` | `src/` |
| `@app/` | `src/app/` |
| `@features/` | `src/features/` |
| `@shared/` | `src/shared/` |

Use them for anything outside the current folder. Relative paths are fine for
true siblings and are left alone deliberately — `./Step2` reads better than
`@features/onboarding/caregiver-job/Step2` when you are already in that folder.

### Modules that also run in Node ⚠️

`api/` (Vercel serverless functions) and `scripts/` (the build step) import from
`src/`, and **neither resolves the `@` aliases** — those exist only inside Vite.
Eight modules are reachable that way and must use relative paths *with file
extensions*:

```
shared/seo/routeMeta.js      shared/seo/jsonLd.js       shared/seo/articlesMeta.js
shared/lib/cityGeo.js        shared/lib/scheduleFormat.js
features/share-link/shareCardModel.js    features/share-link/shareProfileCopy.js
features/nanny-share/shareTypeGoals.js
```

Each carries a header saying so, and `tests/architecture/aliases.test.js` walks
the graph transitively and fails if any of them gains an alias import. Get this
wrong and `npm run build` breaks, or worse, the share-card OG image silently
stops rendering in production.

### Route-level code splitting

Every screen in `App.jsx` is a `React.lazy` chunk. Two things stay eager:
`PageLayout` (it renders the Suspense boundary, so it cannot sit behind one) and
the `/` landing page (the commonest cold entry — splitting it puts a spinner in
front of the first page most visitors see).

About a dozen screens export a const rather than a default, so they load through
`@app/lazyNamed`:

```js
const Screen4 = lazyNamed(() => import("@features/onboarding/caregiver-job/Screen4"), "Screen4");
```

Plain `lazy()` on one of those resolves fine, leaves `default` undefined, and
throws only when that route renders — a white screen on one page that the build
and the tests both pass. `lazyNamed` throws with the module and export named, and
`tests/architecture/lazyRoutes.test.js` checks statically that every name really
is exported.

The boundary lives in `app/RouteOutlet.jsx`, wrapping `<Outlet />` rather than
`<RouterProvider>`, so the header and footer stay put while a chunk loads.

### API services

Sixteen service classes, one per cohesive group of endpoints, all extending
`shared/api/HttpService`:

```
auth/api/          AuthService  VerificationService  PasswordResetService
booking/api/       BookingListService
chat/api/          ChatService
dashboard/api/     DashboardService  AccountSettingsService
hire/api/          BookHireService
jobs/api/          JobsService
matching/api/      MatchService  ReportService
nanny-share/api/   NannyShareService
referral/api/      ReferralService
resources/api/     BlogsService
share-link/api/    ShareLinkService
subscription/api/  PaymentService
```

Each exports both the class and a ready instance. Thunks use the instance;
tests construct the class with a fake client, which is why there is not a single
module mock in `tests/features/services.test.js`.

`HttpService` keeps the two axios call shapes in separate methods on purpose.
axios spells them `get(url, config)` but `post(url, data, config)`, and code
that blurs the two silently posts a config object as the request body. That had
happened in three places — `/auth/send-otp`, `/auth/resend-otp` and two
`/book-hire` transitions — each sending the access token as its payload. It
worked, because the interceptor sets the real header regardless, so nothing ever
looked wrong.

### Redux

30 slices, combined in `app/store.js`, each living in its feature's `store/`.
Only `auth` is persisted, and only its session fields (`store.js` holds the
whitelist). `shared/store/formValueSlice.js` is the exception to feature
ownership: it is the multi-step form buffer every questionnaire writes into.

---

## Tests

```
tests/
  architecture/   the refactor's safety net — see below
  shared/         pure logic: rates, dates, children, HttpService
  app/            lazyNamed
```

`tests/architecture/` is worth understanding before changing structure:

| File | Asserts |
|---|---|
| `routes.test.js` | The 67 routes in `route-baseline.json` still exist, still point at the same component, and are still registered in the same auth branch |
| `imports.test.js` | Every relative and aliased import in `src/` resolves. Reports *all* failures in ~1s; `vite build` stops at the first and takes 30s |
| `aliases.test.js` | `jsconfig.json` matches `aliases.js`, and the Node-reachable graph stays alias-free |
| `lazyRoutes.test.js` | Every lazy route names an export that exists |
| `backendContract.test.js` | Every URL a service calls is a route the backend serves. Skips if `../backend` is absent |

**The route baseline is a contract, not a snapshot.** Regenerate
`route-baseline.json` only when a route is deliberately added or removed, and say
so in the commit. Regenerating it to make a failure go away defeats the point.

The auth-branch check is the one a build can never catch: a route in the wrong
branch is not a 404 — it falls through to the `*` fallback and *silently
redirects*. That is how an unsubscribe link in an email ends up bouncing its
recipient to a dashboard.

---

## Refactoring tools

`scripts/` holds the codemods used to build this structure. They are still here
because the migration is not finished.

| Script | Does |
|---|---|
| `rewrite-imports.mjs <old-path> <new-specifier>` | Repoints everyone who imports a module you are about to move |
| `rebase-imports.mjs <file-or-dir>` | Fixes a moved file's *own* imports, which broke in the other direction |
| `migrate.mjs <manifest.json>` | Both of the above plus `git mv`, in the only order that leaves nothing dangling |
| `build-manifest.mjs` | Generates a move manifest from directory rules |
| `find-unreachable.mjs [--delete]` | Lists files no entry point can reach |

Two things these learned the hard way, both preserved in their comments:

- **Match by resolving paths, not by string tails.** A module is imported as
  `../../NewComponents/Button`, `../Button` and `./Button`, and only the first
  contains the directory name. Tail matching repoints one in three and reports
  success.
- **Only rewrite specifiers in import/export/require position.** A pattern that
  matches any quoted relative path also rewrites `path.resolve(here,
  "../../src/App.jsx")` — a *filesystem* path — into an alias `readFileSync`
  cannot open.

`find-unreachable.mjs` walks outward from the real entry points (`main.jsx`,
`api/`, `scripts/`, `tests/`) rather than grepping for names, because a dead file
importing another dead file makes the second look alive.

---

## Known remaining work

- **`postNannyShare` is never dispatched** but is kept, because
  `state.postNannyShare` is its slice's key in the store and a dozen screens
  select from it. Documented in place: it issues a GET despite its name and
  never sent its payload. Delete it and its three reducer cases when the slice
  is next touched.
- **`App.css` is minified and holds dead rules** — four background-image `url()`s
  point at files that do not exist, for class names nothing uses.
- **`dashboard/components/Modals.jsx` is 1,547 lines** of unrelated dialogs and
  wants splitting per dialog.
