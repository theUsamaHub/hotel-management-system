# Rooms, guests and reservations

Branch: `feat/hms-rooms-reservations`, based on the foundation merged into `main`.

## Start and use

Run the existing setup from `HMS-PROGRESS.md`, then `npm run dev`. Sign in and open **Hotel operations** (staff) or **Book a stay** (guests) from the sidebar.

1. Admin creates a hotel and assigns a manager/receptionist using the foundation screens.
2. Admin or the assigned manager selects that hotel, adds room types with capacity/rate/currency, then adds rooms.
3. Guests create their own contact profile for that hotel. Receptionists/managers/admins can create walk-in profiles. A guest account has at most one self-service profile per hotel; staff-created walk-in profiles are not automatically linked to an account by email.
4. Search **Find rooms** with arrival/departure and guest count, choose a profile and reserve an available room.
5. The reservation starts **pending** and holds inventory. Authorized staff confirms it from **Reservations**.
6. **Modify / assign room** searches availability excluding that reservation and saves the new dates, guest count, notes or room assignment together. **Cancel booking** records the reason and releases the dates.
7. Use **History** to review changes. Room history records each physical status change and its reason.

MongoDB must support transactions (Atlas, a replica set, or a sharded cluster). A standalone development MongoDB is insufficient for inventory/reservation writes. No production seed, schema reset, or account bootstrap is required by this increment. Mongoose creates the new collections and indexes on application startup.

## Business rules in this increment

- Dates are strict `YYYY-MM-DD` calendar dates interpreted as UTC hotel business dates. Arrival is inclusive and departure exclusive. Adjacent reservations are allowed. Arrival can be today through 730 days ahead; stays are 1–365 nights. Hotel-specific time zones and check-in times belong to the settings/stay modules.
- Pending, confirmed and checked-in reservations block overlapping dates. Pending bookings do not expire automatically: staff must confirm or cancel them. Cancelled and checked-out bookings do not block dates.
- Guests see and edit only reservations linked to their account and only their own guest profiles. Staff access is restricted to their assigned hotel; admins have global access.
- Guests may modify/cancel pending or confirmed bookings through their arrival date, before check-in. Staff can additionally cancel past pending/confirmed bookings as no-shows. No cancellation fee is applied in this increment. This is an explicit interim policy pending configurable policies and billing.
- Physical state and date availability are separate. Maintenance and inactive rooms cannot be booked. A same-day arrival requires `available`; a future stay may reserve a currently cleaning or occupied room when its dates are free. Check-in must independently recheck readiness in Phase 3.
- Occupied rooms cannot be manually cleared by these APIs. Maintenance rooms must move to cleaning before available. Housekeeping can only complete cleaning; maintenance can only release repaired rooms for cleaning. Managers/admins can initiate cleaning or maintenance on unoccupied rooms.
- Active reservations must be reassigned/cancelled before deactivating or changing a room's number/type or blocking it for maintenance. Hotel/type deactivation and capacity reductions cannot invalidate outstanding bookings. Checked-in stays remain protected even after their scheduled departure.
- Monetary amounts are integer minor units in the API/database (e.g. `1250000` = PKR 12,500.00); forms display ordinary major units. Supported currencies all have two decimal places: PKR, USD, EUR, GBP, AED.
- Booking quote and contact details are snapshots. Changing a room type price or guest profile does not alter existing bookings. Date changes on the same room retain its original nightly rate; room reassignment uses the target room's current rate. Each old/new quote remains in audit history. Totals currently contain room charges only, without taxes, discounts or services.
- There are no hard-delete room/type/profile/reservation APIs. Inactivation/cancellation preserves operational history.

## Atomicity and concurrent requests

Inventory writes, guest-profile writes, hotel status changes, and booking mutations use MongoDB transactions. Writers increment an internal counter on the hotel document before checking inventory. This makes competing transactions conflict and retry with a fresh snapshot, preventing two independently inserted reservations from both passing an overlap check. The synchronization is shared across application processes, not an in-memory mutex.

Every reservation mutation includes its observed `version`. A stale write returns 409 instead of overwriting another staff member's changes. Failed reschedules leave the original booking untouched. Audit entries and encrypted email jobs commit in the same transaction as the booking. Email-queue insertion failure rolls the booking back; provider delivery failures are handled by the existing worker's retry policy after commit.

This uses a conservative per-hotel write serialization strategy. Throughput/load testing and finer-grained locking can be evaluated in the performance phase without weakening booking consistency.

## Permissions

| Operation | Admin | Assigned manager | Receptionist | Housekeeping / maintenance | Guest |
| --- | --- | --- | --- | --- | --- |
| Add/edit room types and rooms | Yes | Yes | No | No | No |
| Read room inventory/history | Yes | Yes | Yes | Yes | No |
| Change physical status | Yes | Yes | No | Restricted transitions above | No |
| Manage guest profiles | Yes | Yes | Yes | No | Own linked profiles |
| Search/create/modify/cancel reservations | Yes | Yes | Yes | No | Own linked reservations |
| Confirm reservations | Yes | Yes | Yes | No | No |
| View booking history | Yes | Yes | Yes | No | Own linked reservations |

Inactive hotels remain discoverable to admins/assigned staff for historical reservations, and to guests who already have a profile there. New operational writes require an active hotel; cancellation and historical reservation/profile reads remain available.

## API

All routes below start with `/api/hms` and require the existing session cookies. Writes use `X-CSRF-Protection: 1`. Lists support `page`, `limit` (1–100) and literal `search`. Operational list endpoints also require `hotel`.

| Route | Purpose |
| --- | --- |
| GET /hotels | Scoped property catalog, including accessible history |
| GET /room-types | Hotel room types; guests see active types only |
| POST /room-types | Create: hotel, name, description, capacity, rate, currency, isActive |
| PUT /room-types/:id | Replace editable fields excluding hotel |
| GET /rooms | Inventory with populated room type |
| POST /rooms | Create: hotel, roomType, number, floor, isActive |
| PUT /rooms/:id | Replace editable fields excluding hotel/status |
| PATCH /rooms/:id/status | Change physical state: status, reason |
| GET /rooms/:id/history | Paginated physical state history |
| GET /guests | Scoped profiles, searchable by name/email/phone |
| POST /guests | Create: hotel, name, email, phone, preferences; ownership is assigned server-side |
| PUT /guests/:id | Update contact/preferences; hotel/ownership cannot be reassigned |
| GET /availability | hotel, checkIn, checkOut, occupants; optional roomType and authorized excludeReservation |
| GET /reservations | Scoped list; optional status/from/to arrival filters |
| GET /reservations/:id | Scoped details including stored price and contact snapshots |
| POST /reservations | hotel, guest, room, checkIn, checkOut, occupants, notes |
| PUT /reservations/:id | room, checkIn, checkOut, occupants, notes, version |
| POST /reservations/:id/confirm | version; staff only |
| POST /reservations/:id/cancel | version, optional reason |
| GET /reservations/:id/history | Authorized audit history of creation and changes |

Validation errors return 400; inaccessible records 404; missing role permission 403; conflicts/overlaps/stale versions 409. Hotel, room and guest identifiers are validated, and cross-hotel references are rejected. Client-supplied prices, ownership and booking status are rejected.

## Email

Creation, confirmation, modification and cancellation enqueue notifications through the existing encrypted outbox. Local `MAIL_MODE=file` produces previews under `server/mail-outbox`; SMTP/Resend must be configured for actual inbox delivery. Confirmation is a staff action and is distinct from receiving a pending booking.

## Verification and next scope

`npm run lint`, `npm test`, `npm run build`. Hotel and HMS integration suites start an isolated one-member MongoDB replica set; other starter suites retain their existing isolated test setup. Set `MONGOMS_SYSTEM_BINARY` to a local `mongod` executable when automatic binary download is unavailable.

Integration tests include concurrent creates/reschedules, overlap/adjacency, cross-hotel/guest access, stale versions, quote preservation, invalid dates and capacity, maintenance/readiness, protected deactivation, guest ownership, email rollback, and room history. UI tests cover pricing conversion, guest reservation creation, profile requirements, rescheduling, explicit cancellation and housekeeping permissions.

Validated for this increment: 91 backend tests and 40 frontend tests passed in the full regression run. Lint and the production build passed. Startup verifies replica-set support and awaits collection/index initialization before accepting requests. A smoke test against the configured Atlas database completed startup and returned HTTP 200 from `/api/health`; no demo records were inserted.

Next is Phase 3: actual check-in/check-out, key issuance, housekeeping task scheduling/assignment and maintenance work orders. The present room status transitions support that work but do not represent a completed stay-management module. Billing, payments, services, feedback, configurable policies and reporting remain later phases.
