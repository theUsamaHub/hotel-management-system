# LuxuryStay — Hotel Management System

Hotel management built on the Forma MERN starter. Start with the [HMS module status and setup](docs/HMS-PROGRESS.md). The foundation provides hotels, staff and scoped permissions. [Core hotel operations](docs/HMS-ROOMS-RESERVATIONS.md) add room types, inventory, guest profiles, availability and reservations. The remaining modules are tracked in the progress document.

[Stay operations](docs/HMS-STAYS-OPERATIONS.md) add check-in/out, keys, cleaning tasks and maintenance. [Billing and guest services](docs/HMS-BILLING-SERVICES.md) add itemized accounts, payments, invoices, services and feedback. Open **Hotel operations** or **Book a stay** after signing in.

A complete React + Express + Node.js + MongoDB workspace with cookie-based JWT
authentication, admin/user access controls, category CRUD, user administration,
responsive dark mode, shared media uploads, and isolated automated tests.

**New to full-stack development? Start with the [Beginner setup and file guide](docs/BEGINNER-GUIDE.md).**
It explains every setting, JWT secret generation, frontend/backend setup, and what each source file does.

## Quick start

Requires **Node.js 20.1+ / 22.x / 24+**, **npm 9.6.4+**, Git, and a MongoDB database (Atlas or local). See [Node/npm compatibility](docs/NODE-VERSIONS.md).

```sh
git clone https://github.com/theUsamaHub/hotel-management-system.git
cd hotel-management-system
npm run install:all
```

1. Copy `server/.env.example` to `server/.env` and fill in the values below.
2. Optionally copy `client/.env.example` to `client/.env`; development defaults work without it.
3. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `server/.env`, then run `npm run bootstrap:admin`. This adds an admin without deleting existing data. The legacy `seed` command replaces users and categories; use it only with a disposable database.
4. Run `npm run dev` to start both applications.
5. Open **http://localhost:5173**. The API listens on **http://localhost:5000**.

Use `localhost` consistently: CORS and browser-origin checks use
`http://localhost:5173`. Vite proxies `/api` to Express during development.
Run workspace commands from the repository root as shown in this guide.

## Environment configuration

Keep actual values in the ignored `server/.env`; never place credentials in
`.env.example`, source code, or Git. The server validates configuration before starting.

| Variable | Purpose / development value |
| --- | --- |
| `PORT` | API port, `5000` |
| `NODE_ENV` | `development`, `test`, or `production` |
| `MONGO_URI` | Your MongoDB URI, including the intended database name |
| `JWT_ACCESS_SECRET` | Random secret of at least 32 characters |
| `JWT_REFRESH_SECRET` | A different random secret of at least 32 characters |
| `JWT_ACCESS_EXPIRES` | Access lifetime, `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh lifetime, `7d` |
| `CLIENT_URL` | Primary trusted browser origin, `http://localhost:5173` locally |
| `CLIENT_ORIGINS` | Optional comma-separated additional exact trusted origins |
| `COOKIE_SAME_SITE` | Optional `none`, `lax` or `strict`; default `none` in production, `lax` locally |
| `MEDIA_UPLOAD_DIR` | Optional absolute private upload folder; blank uses `server/uploads/` |
| `VITE_API_URL` | Client API path, `/api`; client-side values are public |

Generate each JWT secret independently with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

In Atlas, create a database user, allow your development machine in Network Access,
and copy the driver connection string. URL-encode special characters in its password.
Include a database name in the URI so seeding targets the intended database.
Restart the API after changing environment variables.

## Seed data and demo accounts

`npm run seed` **deletes every user and category in the configured database**, then
creates these accounts and ten categories owned by the admin. Use a dedicated
development database. `npm run seed:destroy` only clears users and categories.
Both commands refuse to run with `NODE_ENV=production`.

| Role | Email | Demo password | Dashboard |
| --- | --- | --- | --- |
| Admin | admin@example.com | Admin@123 | `/admin/dashboard` |
| User | user1@example.com | User@123 | `/user/dashboard` |
| User | user2@example.com | User@123 | `/user/dashboard` |

These credentials are public demo fixtures. Do not use them for production accounts.
The seed creates Electronics, Fashion, Books, Home, Sports, Toys, Beauty, Grocery,
Automotive, and Health. It prints account credentials after successful creation.

## Commands and tests

| Command from root | Purpose |
| --- | --- |
| `npm run install:all` | Install both workspaces and root tooling |
| `npm run dev` | Run Express and Vite together; Ctrl+C stops both |
| `npm run seed` / `npm run seed:destroy` | Reset demo data / clear data |
| `npm test` | Run backend and frontend test suites |
| `npm run test:coverage` | Run both coverage reports |
| `npm run lint` | Lint both applications |
| `npm run build` | Build the client into `client/dist` |
| `npm run start --workspace server` | Start the API without Nodemon |
| `npm run test:watch --workspace server` | Watch backend tests |
| `npm run test:watch --workspace client` | Watch frontend tests |

Backend tests use Jest, Supertest, and `mongodb-memory-server`. The test environment
overrides `MONGO_URI` before importing the app and only connects to a disposable
MongoDB instance. It never uses Atlas or an existing database service. On Windows,
tests reuse an installed `mongod` binary automatically. Otherwise, the first run
downloads one; allow time and network access. Set `MONGOMS_SYSTEM_BINARY` to use a
compatible executable explicitly. Each suite uses a fresh temporary data directory.

Frontend tests use Vitest, React Testing Library, jsdom, and MSW. They cover login
validation and redirects for both roles, route guards, category forms/tables, and
refresh concurrency. HTTP requests are mocked. Coverage reports are written under
each workspace's ignored `coverage/` directory. Tests cover behavior rather than
claiming exhaustive coverage of every presentation component.

Both workspaces include ESLint and Prettier configuration. Format files with
`npx prettier --write <path>` from the appropriate workspace.

## API reference

All routes are under `/api`. Authentication uses `accessToken` and `refreshToken`
httpOnly cookies; send credentials with requests. Errors use
`{ "success": false, "message": "...", "errors": [{ "field": "...", "message": "..." }] }`;
`errors` is included for input-validation errors. Successful responses include
`success` and the payload described below; most operations also include `message`.

| Method | Endpoint | Access | Body / result |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health message |
| POST | `/auth/register` | Public | `{name,email,password}`; returns `user` |
| POST | `/auth/login` | Public | `{email,password}`; returns `user` |
| POST | `/auth/refresh` | Refresh cookie | Rotates cookies; returns `user` |
| POST | `/auth/logout` | Public | Revokes matching refresh token and clears cookies |
| GET | `/auth/me` | Authenticated | Current `user` |
| GET | `/categories` | Authenticated | `categories`, `pagination` |
| POST | `/categories` | Admin | `{name,description?,image?,isActive?}`; returns `category` |
| PUT | `/categories/:id` | Admin | One or more editable category fields; returns `category` |
| DELETE | `/categories/:id` | Admin | Deletes category |
| GET | `/users` | Admin | `users`, `pagination` |
| PATCH | `/users/:id/role` | Admin | `{role:"admin"\|"user"}` |
| PATCH | `/users/:id/active` | Admin | `{isActive:boolean}` |
| DELETE | `/users/:id` | Admin | Deletes user |
| GET | `/media` | Authenticated | `media`, `pagination`; page/limit/search/kind filters |
| POST | `/media` | Admin | Multipart `file` up to 25 MiB; returns `media` |
| GET | `/media/:id/file` | Authenticated | Private binary file; images/video support ranges, documents download |
| DELETE | `/media/:id` | Admin | Deletes stored file and media metadata |

Category lists accept `page` (default 1), `limit` (default 10, maximum 100),
`search` (literal case-insensitive name search), `sort` (`name`, `-name`,
`createdAt`, `-createdAt`; default `-createdAt`), and `isActive` (`true` or `false`).
User lists accept `page`, `limit`, and a name/email `search`. Pagination is
`{page,limit,total,pages}`. An empty result has `total:0` and `pages:0`.

Registration always creates a user; extra fields such as `role` are rejected.
Administrators can promote another user but cannot change their own access or
delete themselves. Category slugs update when names change. Passwords and refresh
token hashes are never serialized in API responses.

## Project structure

```text
package.json                 npm workspaces and combined commands
server/
  src/app.js                 Express middleware and routing; no listen side effect
  src/server.js              Environment validation, DB connection, HTTP startup/shutdown
  src/config/                Environment and MongoDB configuration
  src/models/                User, Category, and Media schemas
  src/controllers/           Authentication, users, categories, and media operations
  src/storage/               Private local storage adapter and provider selection
  uploads/                   Local file bytes (generated and Git-ignored)
  src/routes/                Endpoint wiring and access policies
  src/middleware/            Authentication, authorization, validation, and errors
  src/validators/            Zod input schemas
  src/utils/                 Tokens, errors, async wrapper, and literal search escaping
  src/seed/                  Seed runner and demo fixtures
  tests/                     Isolated API integration tests and smoke checks
client/
  src/api/                   Axios, refresh interceptor, API clients, and QueryClient
  src/context/               Current session and login/register/logout actions
  src/hooks/                 Auth and category query/mutation hooks
  src/routes/                Lazy routing and role guards
  src/layouts/               Public, admin, and user layouts
  src/components/            Forms, tables, dialogs, navigation, and motion components
  src/pages/                 Public, admin, and user pages
  src/utils/                 Role-based dashboard paths
  src/tests/                 Vitest, RTL, and MSW tests
  src/styles.css             Tailwind import, theme tokens, and responsive styling
```

Public pages: `/`, `/login`, `/register`, `/unauthorized`. Admin pages live under
`/admin`; user pages under `/user`. Unknown routes show a 404 page. A logged-in
visitor to login or register is redirected to their role's dashboard.

## Add a new resource

For example, to add projects:

1. Create `server/src/models/Project.js` with a Mongoose schema, ownership fields,
   timestamps, and required indexes. Keep secrets excluded from selection/serialization.
2. Define strict Zod schemas for bodies, route parameters, and list queries in
   `server/src/validators/project.js`. Allowlist sort keys and bound pagination.
3. Add controllers using `asyncHandler` and `ApiError`. Escape literal search text
   with `escapeRegex`; return the same response and pagination conventions as categories.
4. Add a router with `protect` and, where needed, `authorize('admin')`; validate all
   input and mount it under `/projects` in `server/src/routes/index.js`.
5. Add Jest/Supertest integration tests for successful CRUD, invalid input, missing
   records, unauthenticated requests, and wrong-role access. Use the existing test DB.
6. Create a client API module using the shared `api` instance and React Query hooks
   keyed by `['projects', params]`. Invalidate that prefix after successful mutations.
7. Add pages with loading/error/empty states, validated forms, and mutation feedback.
   Register lazy routes under the appropriate role guard and update the sidebar.
8. Add RTL/MSW tests for forms, route behavior, and user actions; run both suites,
   lint, and build before merging the feature branch into `develop` with `--no-ff`.

Client guards improve navigation but never replace server authorization. Use the
existing category feature as a complete reference from model through UI.

## Deployment and operational notes

Follow the [complete deployment guide](docs/DEPLOYMENT-GUIDE.md) for step-by-step instructions for this combined repository and the independent client/server folders.

- Build with `npm run build`; serve `client/dist` through a static host or reverse
  proxy with a fallback to `index.html` for client routes. The Express API does not
  serve the frontend build. Route `/api` to the API process on the same public origin.
- Run the API with `NODE_ENV=production`, a production database, strong independent
  JWT secrets, and `CLIENT_URL` set to the exact HTTPS frontend origin. Production
  cookies default to `Secure`, `HttpOnly`, and `SameSite=None`; HTTPS is required.
  Exact trusted origins and a custom CSRF header protect writes. See the
  [cross-site authentication fix](docs/CROSS-SITE-AUTH.md) for setup and the
  remaining third-party-cookie browser limitation.
- Registration and login issue short-lived access tokens and rotating refresh tokens.
  Only the refresh-token hash is stored. Each account has one current refresh session;
  signing in again replaces it. Logout revokes the matching refresh session and clears
  browser cookies. A copied access token remains usable until its short expiry unless
  the account is disabled/deleted; protection reloads the current user on every request.
- Helmet, credentialed CORS, input limits, Mongo sanitization, strict validation, and
  browser-origin checks protect requests. Authentication routes are rate-limited.
  The included limiter uses memory for a single API process. For multiple instances,
  configure a shared store and a narrowly scoped trusted-proxy setting for your deployment.
- Keep database backups and credentials outside the repository. Never run demo seed
  against production. Review and update dependencies regularly with `npm audit`.
- The server connects before listening and shuts down HTTP and MongoDB on termination.
  `/api/health` reports HTTP service liveness; it is not a database readiness probe.

## Media uploads

Admins can upload images, videos and documents through **Media library**. All
signed-in users can preview/download shared files, including on their dashboards.
Files are stored in the ignored `server/uploads/` folder; metadata is stored in
MongoDB. The limit is one file up to 25 MiB per upload. See the
[media guide](docs/media-storage.md) for formats, API examples, deployment notes,
the storage adapter contract, and how to replace local storage with Cloudflare R2.

## Troubleshooting

### Dependency audit at v1.0.0

`npm audit --omit=dev` reports zero vulnerabilities. The full audit reports
22 development-tooling findings (19 moderate, 3 high), primarily through
Nodemon/Chokidar and Jest/Istanbul. npm's proposed automatic fixes downgrade major
tool versions; these were not applied. A compatible `shell-quote` override removes
the critical findings. Recheck advisories when updating the development toolchain.

- **Invalid environment:** check every named variable; secrets must differ and have
  at least 32 characters. Values are deliberately omitted from diagnostics.
- **Database connection failed:** check Atlas credentials, network allowlist, database
  name, and DNS/connectivity. Seeding errors also omit connection values.
- **Origin not allowed:** open `http://localhost:5173`, or deliberately update
  `CLIENT_URL` to match the browser origin and restart the API.
- **Port occupied:** stop the existing process or change API `PORT` and the Vite proxy
  together. Vite uses `strictPort` so it cannot silently change the allowed origin.
- **First backend test run is slow:** MongoDB's binary download can be large. Use an
  installed binary via `MONGOMS_SYSTEM_BINARY` or let the download finish and cache.
- **Test runner cannot open localhost sockets or temporary files:** run tests in an
  environment that permits local processes and loopback connections.

## Account recovery, settings, and activity history

The kit now includes forgot/reset password, email verification, password changes,
profile editing and photos, independent device sessions, and admin activity logs.
See [ACCOUNT-FEATURES.md](docs/ACCOUNT-FEATURES.md) for local email previews,
SMTP/HTTPS email setup, API routes, and upgrade instructions.

Production now requires a configured mail provider. Existing users must sign in
again after upgrading to the new session model; no database reseeding is needed.
