# Deployment

How the frontend and backend get to production, the exact commands, and the
failure modes that have actually bitten — including one that shipped a broken
build to the live site on 2026-09-17 and what prevents it recurring.

Like the other docs here this is a record of reasoning rather than a checklist.
Where a step looks redundant, the reason it exists is written down.

---

## 1. Topology

| Piece | Runs on | Config in repo | Notes |
|---|---|---|---|
| Frontend | Cloudflare Workers (static assets) | `frontend/wrangler.jsonc` | No Worker script — assets only |
| Backend | Fly.io, app `backend-bitter-shape-3085`, region `ord` | `backend/fly.toml` | Docker build, Node 22 |
| Database | MongoDB Atlas | not in repo | URI is a Fly secret |
| Local DB | Docker `mongo:7`, `famylink-mongo` | `backend/docker-compose.yml` | Bound to `127.0.0.1` on purpose |

The frontend and backend deploy independently. Neither deploy touches the
database; schema changes ride along with backend code.

---

## 2. The rule that matters most

**Vite inlines `import.meta.env.VITE_*` at build time.** The values are frozen
into the bundle by whoever runs `npm run build`. Nothing at runtime can correct
them — not a Cloudflare setting, not a header, not a redeploy of the same
artifact.

So *where you build* decides what the site talks to:

- Building in Cloudflare's build pipeline picks up the project's environment
  variables. This is correct.
- Building on a laptop picks up `frontend/.env`, which is a **development**
  file. This is not.

On 2026-09-17 a local build was deployed straight to production. `frontend/.env`
contains `VITE_API_BASE_URL="http://localhost:3000"`, so the live bundle
shipped with:

```js
var _r = "http://localhost:3000", Nr = b.create({ baseURL: _r, ... })
```

The site rendered perfectly and every API call pointed at the visitor's own
machine. Nothing in the build, the tests or the deploy output flagged it,
because from the toolchain's point of view the value was simply a string.

**Rule: production builds happen in CI, not on a laptop.** If you must build
locally — an outage, a CI failure — put production values in
`frontend/.env.production.local` (gitignored, and Vite prefers it over `.env`
for production builds) and verify with §6 before trusting the deploy.

---

## 3. Frontend — Cloudflare Workers

### 3.1 One-time setup

```bash
npx wrangler@4 login      # OAuth, opens a browser; wrangler is not installed globally
npx wrangler@4 whoami     # confirm the account and that the token has workers:write
```

### 3.2 Config

`frontend/wrangler.jsonc` is what makes the deploy reproducible. Before it
existed the project was configured entirely in the Cloudflare dashboard, and
moving to Workers Builds produced:

```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

Three things in it are load-bearing:

- **No `main`.** Assets-only. Adding a Worker script means every request runs
  it, and nothing here needs server-side logic.
- **`not_found_handling: "single-page-application"`.** React Router owns the URL
  space, so an unmatched path is a client route and must return `index.html`
  with a 200. Cloudflare's default is `none`, i.e. a 404 on every deep link.
- **`html_handling: "drop-trailing-slash"`.** Cloudflare defaults to
  `auto-trailing-slash`, which 307s `/find-nanny-share` to
  `/find-nanny-share/` — an extra round trip on every arrival from search, to a
  URL that disagrees with the canonical tag on the page. Canonicals have no
  trailing slash, matching `trailingSlash: false` in `vercel.json`.

`frontend/public/_headers` is copied into `dist/` by the build and read by
Cloudflare. It exists because the default was `max-age=0, must-revalidate` for
*everything*, including content-hashed bundles — so a repeat visit revalidated
every critical-path file before it could paint. `/assets/*` is `immutable`
because the hash means a change ships under a new URL. Unhashed paths (fonts,
root images) get a month and must **never** be `immutable`, since a replacement
reuses the URL.

### 3.3 Deploy

```bash
cd frontend
npm ci                          # not `npm install` — honours the lockfile exactly
npm run build                   # vite build && node scripts/prerender-meta.mjs
npx wrangler@4 deploy --dry-run # validates config, reports the file count, uploads nothing
npx wrangler@4 deploy           # uploads and takes traffic immediately
```

`wrangler deploy` versus `wrangler versions upload`: the CI deploy command is
`npx wrangler versions upload`, which stages a version **without giving it
traffic**. A green build whose changes never appear is usually this. Promote a
staged version with:

```bash
npx wrangler@4 versions list
npx wrangler@4 versions deploy <version-id>
```

### 3.4 Cloudflare build settings

For CI builds to work, the project needs:

- **Root directory:** `frontend` — this is where `package.json` and
  `wrangler.jsonc` live. Wrangler will not find the config from the repo root.
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler versions upload` (or `wrangler deploy`)
- **Environment variables:** every `VITE_*` in §7, with *production* values.

### 3.5 Automatic deploys from GitHub

`.github/workflows/deploy-frontend.yml` builds and deploys on every push to
`main` that touches `frontend/**`, plus on demand via *Actions > Run workflow*.
It publishes to the `famlink` Worker, which serves
<https://famlink.pradiptoshivam5317.workers.dev>.

This exists because **nothing in this repo deployed anything**. The only other
workflow is the mirror, and it has been skipped on every run since it was added
(see §3.6), so pushing to `main` never reached any site. Deploys were happening
by hand from a laptop, which is what §2 warns about.

Required repository configuration, under *Settings > Secrets and variables >
Actions*:

| Kind | Name | Notes |
|---|---|---|
| Variable | the six `VITE_*` in §7 | Public once shipped; plain variables, not secrets |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | `ee9377757133515eab7ac27f59082e9c` |
| Secret | `CLOUDFLARE_API_TOKEN` | Create with the **Edit Cloudflare Workers** template |

Three parts of the workflow are load-bearing and should not be trimmed:

- **The preflight.** `frontend/.env` is gitignored, so a CI checkout has *none*
  of the `VITE_*` values. An unset repository variable expands to an empty
  string, which Vite bakes in happily. The preflight fails the run instead, and
  separately rejects a `VITE_API_BASE_URL` pointing at localhost.
- **The postflight.** The build succeeding proves the bundler ran, not that it
  was handed the right values — which is exactly how the §2 incident passed
  every check. It greps the built bundle for a development origin. It scans only
  `.js`/`.css`: sourcemaps embed their original sources, and socket.io's carry
  the comment ``// make sure we treat `localhost:80` and `localhost` equally``,
  so scanning `dist/assets` wholesale fails every build on a third-party
  comment.
- **`wrangler deploy`, not `wrangler versions upload`.** The latter stages a
  version without giving it traffic, which looks like a green deploy whose
  changes never appear. See §3.3.

The workflow file must exist **on the branch being pushed** — GitHub runs the
copy on that branch. Adding it to a feature branch does nothing for `main` until
it is merged.

`VITE_STRIPE_PUBLISABLE_KEY` is intentionally *not* required by the workflow.
It is declared in `frontend/.env` and listed in §7, but nothing under
`frontend/src` reads it, so requiring it would block every deploy on a dead
variable. Add it back when Stripe.js is actually wired up.

### 3.6 The mirror workflow is dead, and dangerous to revive

`.github/workflows/mirror-to-personal.yml` force-pushes every ref to
`ggps2002/Famylink`. It has never run once:

```yaml
if: github.repository == 'Famylink/Famylink'   # this repo is ggps2002/Famlink
```

`Famylink/Famylink` does not resolve, and the `SYNC_SSH_KEY` secret it needs
does not exist either. **Do not simply correct the guard.** The push is
`--force --prune`, and the two repos have diverged: `ggps2002/Famylink@main`
carries ~105 commits that are not in this repo, and 8 branches that exist only
there. Running it as written would delete all of it.

`ggps2002/Famylink` is what <https://famlink.care> builds from — it is pinned to
Vite 5 and last changed 2026-08-19. That site is **not** touched by §3.5 and
will keep serving its own build until its deploy is repointed deliberately.

---

## 4. Backend — Fly.io

### 4.1 One-time setup

```bash
brew install flyctl    # or: curl -L https://fly.io/install.sh | sh
flyctl auth login
flyctl auth whoami
```

### 4.2 Deploy

```bash
cd backend
npm test                                              # 889 tests; see §8 for the one known failure
flyctl status  --app backend-bitter-shape-3085
flyctl deploy  --app backend-bitter-shape-3085        # builds the Dockerfile remotely
flyctl logs    --app backend-bitter-shape-3085
```

Unlike the frontend, backend config is read at **runtime** from Fly secrets, so
a misconfigured value is fixed with `flyctl secrets set` and a restart rather
than a rebuild.

```bash
flyctl secrets list --app backend-bitter-shape-3085          # names + digests, never values
flyctl secrets set KEY=value --app backend-bitter-shape-3085 # triggers a rolling restart
```

### 4.3 `min_machines_running = 0`

`fly.toml` sets `auto_stop_machines = 'stop'` with `min_machines_running = 0`.
Machines stop when idle and start on the next HTTP request.

This is fine for the API and **not** fine for anything on a timer. The email
dispatcher and the cron jobs only run while a machine is up, so with no traffic
queued mail sits in Mongo undelivered. If the report is "the email never
arrived", check this before looking at the mail provider. Raising it to `1`
fixes it and costs a machine running continuously.

---

## 5. Database

Production is MongoDB Atlas; the URI is only ever a Fly secret. `backend/.env`
also holds it, which is why `src/config/index.js` refuses to use it outside
production unless `ALLOW_REMOTE_DB` is set — a developer running `npm run dev`
used to connect straight to the production cluster, so seed scripts and
half-finished migrations ran against real member data.

Local development uses the Docker instance:

```bash
cd backend
npm run db:up       # docker compose up -d --wait mongo
npm run db:shell    # mongosh into the famlink database
npm run db:reset    # destroys the volume and starts clean
```

### Moving data between clusters

`mongodump`/`mongorestore` are not installed on macOS by default, and
`brew install mongodb-database-tools` fails if the Xcode licence has not been
accepted. The `mongo:7` image already ships them, so use the container:

```bash
# dump the local database to a single gzipped archive
docker exec famylink-mongo mongodump --db=famlink --archive=/tmp/famlink.archive --gzip
docker cp famylink-mongo:/tmp/famlink.archive ./famlink.archive

# restore into a cluster (quote the URI; it contains characters the shell eats)
docker cp ./famlink.archive famylink-mongo:/tmp/restore.archive
docker exec famylink-mongo mongorestore --uri="mongodb+srv://..." \
  --archive=/tmp/restore.archive --gzip --nsFrom='famlink.*' --nsTo='famlink.*'
```

Always `mongodump` the destination first if it has data. Compare collection
counts on both sides before pointing anything at the new cluster, and leave the
old one untouched until you are sure — it is the only rollback.

---

## 6. Verifying a frontend deploy

The deploy succeeding proves the upload worked, not that the app works. These
are cheap and catch the failures that have actually happened:

```bash
U=https://<your-worker>.workers.dev

# 1. The API origin is NOT localhost. This is the §2 failure.
curl -sS "$U/" | grep -oE '/assets/[A-Za-z0-9_.-]+\.js' \
  | while read -r a; do curl -sS "$U$a" | grep -oE 'localhost:[0-9]+'; done
# any output at all means the bundle was built with a dev .env — redeploy, do not patch

# 2. Deep links return 200, not 307 or 404
for p in / /find-nanny-share /nanny-share/oakland-ca /nope; do
  echo "$(curl -sS -o /dev/null -w '%{http_code}' "$U$p")  $p"
done

# 3. Hashed assets are immutable; fonts are woff2
curl -sSI "$U/assets/<hashed>.js" | grep -i cache-control   # max-age=31536000, immutable
curl -sSI "$U/fonts/Livvic/Livvic-Regular.woff2" | grep -i content-type
```

Then open the site, sign in, and open a chat — `socket.io` is a dynamic import,
so the realtime path is not exercised by a page load alone.

---

## 7. Environment variables

**Frontend** (build time, baked into the bundle, all public once shipped):

```
VITE_API_BASE_URL              backend origin — the one that broke production
VITE_GOOGLE_CLIENT_ID          Google OAuth
VITE_GOOGLE_KEY                Google Maps / Places
VITE_STRIPE_PUBLISABLE_KEY     note the spelling; it is like this in the code
VITE_STRIPE_PLUS_PRICE_ID
VITE_GOOGLE_SCRIPT_URL
VITE_GOOGLE_SCRIPT_WAITLIST_URL
```

Nothing secret belongs here. Anything in the bundle is readable by anyone.

**Backend** (runtime, Fly secrets). `src/config/index.js` refuses to boot in
production without `MONGO_DB_URI`, `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.

Note that **`JWT_SECRET` and `REFRESH_TOKEN_SECRET` are not in `backend/.env`** —
they exist only as Fly secrets. A new environment cannot be configured from
`.env` alone; generate fresh ones:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use *different* values per environment. Sharing them lets a token minted by one
stack authenticate against another.

The full set is 31 secrets; `flyctl secrets list` is the source of truth.
`FRONTEND_URL` and `BACKEND_URL` must match the deployed hosts or CORS will
block the browser and email links will point at the wrong place.

---

## 8. Known issues

- **`backend/tests/architecture/imports.test.js` fails.** A false positive: the
  test's own regex matches the example specifiers inside its explanatory comment
  on line 21, and `"..."` looks like an unresolvable relative path. The fix is to
  strip comments before scanning, as the frontend's equivalent test does. The
  other 888 tests pass.
- **`frontend/.env` is a development file** and contains
  `VITE_API_BASE_URL="http://localhost:3000"` plus Stripe *test* keys. See §2.
- **`backend/.env` is mixed.** `MONGO_DB_URI` is the production Atlas cluster,
  but `FRONTEND_URL` is `http://localhost` and `STRIPE_SECRET_KEY` is
  `sk_test_…`. Copying it wholesale onto Fly would CORS-block the real frontend,
  point every email link at localhost, and replace live Stripe keys with test
  ones. Do not treat it as a production source.
- **`wrangler orgs`/Fly org split.** The Fly app is owned by the
  `gabriele-muratori` org, not by whoever is usually deploying. Check
  `flyctl apps list` before assuming a deploy lands in your own account.

---

## 9. Rollback

**Frontend.** Cloudflare keeps every uploaded version:

```bash
npx wrangler@4 deployments list
npx wrangler@4 rollback [version-id]
```

A worker that has been *deleted* takes its version history with it, so there is
nothing to roll back to. Deleting and recreating a Worker is not the same as
redeploying it.

**Backend.** `flyctl releases` only lists — there is no `revert` subcommand.
Roll back by redeploying the previous image:

```bash
flyctl releases --image --app backend-bitter-shape-3085   # find the previous image ref
flyctl deploy --image <image-ref> --app backend-bitter-shape-3085
```

A config-only mistake does not need this. `flyctl secrets set` restarts the
machines with the corrected value, which is faster than a rebuild.

**Database.** There is no automatic rollback. Atlas backups on the paid tiers,
otherwise a `mongodump` taken before the change is the only route back — which
is why §5 says to take one.
