# LuxuryStay HMS module tracker

## Foundation — merged into main

Implemented on `feat/hms-foundation`:

- Reused cookie authentication, password recovery, email verification, sessions and audit infrastructure.
- Added manager, receptionist, housekeeping and maintenance roles. Existing `admin` means system administrator and `user` means guest, preserving starter accounts.
- Hotel creation, editing, activation/deactivation, contact and location fields, unique codes, search and pagination.
- Staff creation, editing, activation/deactivation, contact and job details, hotel and role assignment. Passwords are hashed; access edits revoke sessions.
- Admin screens at `/admin/hotels` and `/admin/staff`.
- Assigned hotel view for staff at `/user/hotels`; managers can view their hotel's staff at `/user/staff`.
- Server-side access enforcement, active-hotel checks, strict input validation and audit events.
- Additive admin bootstrap, without running the starter's destructive demo seed.

Staff profiles are embedded in users. Hotel managers are users with role `manager` assigned to a hotel. Multiple managers per property are supported. Staff administration is initially reserved for system administrators; managers have read access to their own hotel and its staff. Guests cannot read the operational hotel/staff endpoints. Public hotel discovery will be part of booking work.

## Local setup

1. Run `npm ci` at the repository root.
2. Configure `server/.env` from `.env.example`. The supplied Atlas URI is stored only in the local ignored file. Never commit it.
3. Add `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (12–72 UTF-8 bytes) locally. Run `npm run bootstrap:admin`. Existing accounts are never overwritten or promoted. Remove the bootstrap variables after use.
4. Run `npm run dev`; open `http://localhost:5173` and sign in with that admin.
5. Add a hotel, then create staff and choose their hotel and role. Staff sign in at the same login page with their initial password and can change their password through account settings.

Local email uses the existing file preview mode. Real email delivery requires SMTP or Resend credentials; no provider credentials were supplied. Do not run `npm run seed` or `seed:destroy` against a real hotel database.

## API

All endpoints use the starter's session cookies and CSRF header. Lists accept `page`, `limit` (maximum 100), and `search`.

| Endpoint | Access | Result |
| --- | --- | --- |
| GET /api/hotels | Admin or staff | All properties for admins; active assigned property for staff |
| GET /api/hotels/:id | Admin or assigned staff | Hotel detail; inaccessible properties return 404 |
| POST /api/hotels | Admin | Create hotel |
| PUT /api/hotels/:id | Admin | Replace editable details and status |
| GET /api/staff | Admin or manager | All staff for admins; own active hotel's staff for managers |
| POST /api/staff | Admin | Create staff account with active hotel assignment |
| PUT /api/staff/:id | Admin | Update staff details, role, hotel and status; revoke sessions |

Hotel fields: `name`, `code`, `address`, `city`, `country`, `email`, `phone`, `isActive`.
Staff creation: `name`, `email`, `password`, `role`, `hotel`, `phone`, `jobTitle`, `isActive`.
Staff update: same editable fields excluding `email` and `password`, which retain the existing verified email/password account workflows.

## Core operations — feat/hms-rooms-reservations

- [x] Room types, capacities, prices and currencies.
- [x] Room creation/editing, activation, physical status and history.
- [x] Guest contact profiles and preferences, including guest self-service.
- [x] Date-based availability with capacity and readiness checks.
- [x] Guest and reception bookings, confirmation, modification, room reassignment and cancellation.
- [x] Transactional double-booking prevention, including concurrent requests.
- [x] Historical booking prices, mutation audit history and durable notification emails.
- [x] Basic staff/guest screens at `/admin/operations` and `/user/operations`.

See [setup, policies, permissions, API and verification](HMS-ROOMS-RESERVATIONS.md).

## Next module branches

Phase 3 is implemented on `feat/hms-stays-operations`: check-in/out, guest verification, key accounting, cleaning scheduling/assignment/completion, maintenance reports and repairs, room blocks and audit history. See [stay operations guide](HMS-STAYS-OPERATIONS.md). This branch records external room-only checkout settlement; full billing follows in Phase 4.

- Phase 2: implemented in the core operations branch above.
- Phase 3: implemented in the stay-operations branch above.
- Phase 4: guest services, charges, invoices, payments and feedback.
- Phase 5: policies, taxes, operational notifications and reporting.
- Phase 6: full workflow tests, security/performance checks, user documentation and demo.

Phases 4–6 remain outstanding. Keep each subsequent module on a feature branch. Existing category/media demos remain available until replaced by hotel workflows.

## Validation

Run `npm run lint`, `npm test`, and `npm run build`. Server tests use an isolated in-memory MongoDB, not the configured Atlas database. HMS tests cover cross-hotel isolation, forbidden guest access, input validation, inactive hotel assignments, password hashing, session revocation and audit events.

Validated for this increment: lint and production build passed; 75 backend and 34 frontend tests passed (the cross-site suite was rerun after fixing dotenv isolation). Atlas connectivity was verified with a read-only ping. No demo seed or admin bootstrap was run against Atlas. The first admin still needs your chosen credentials through the setup command above.

If the MongoDB test download is unavailable, set `MONGOMS_SYSTEM_BINARY` to a local `mongod` executable before running backend tests. Tests still launch a fresh isolated database rather than connecting to an existing MongoDB service.
