# Stay operations, housekeeping and maintenance

Branch `feat/hms-stays-operations` builds on `feat/hms-rooms-reservations`. These are stacked branches; only the foundation was requested to be merged into main.

## Workflow

1. From **Reservations**, staff checks in a confirmed reservation whose stay dates include today. Record guest verification and one to five key labels. Do not store identity-document numbers/images in verification notes.
2. **Guest stays → Details & keys** records additional key issuance and return/loss. Every issued key must be accounted for before checkout.
3. Checkout records departure, changes the reservation to checked out and creates required cleaning. The room remains unavailable until cleaning is started and completed. Maintenance blocks take precedence.
4. **Housekeeping** lists rooms awaiting cleaning and tasks. Front desk/managers schedule and assign tasks to active housekeeping staff at the same hotel. Assigned cleaners/managers perform work with completion notes. Future tasks cannot start early; occupied/blocked rooms cannot be cleaned through this workflow.
5. **Maintenance** accepts staff reports and guest reports for an active owned stay. Managers assign staff, set priority and block rooms. Assigned repairers/managers start and resolve work; managers can reopen it. Every resolution/reopening requires notes.
6. **Affected bookings** shows front-desk staff bookings impacted by repairs. Reassign arrivals through Reservations; emergency blocks do not silently cancel existing reservations.

## Integrity and permissions

- All changes share the per-hotel transaction protocol. Stay, reservation, keys, room, tasks, audit and email changes commit together or roll back.
- Unique indexes prevent duplicate stays per reservation, multiple active stays per room, duplicate issued key labels per hotel, and multiple open cleaning tasks per room. Version checks reject stale edits and duplicate transitions.
- Check-in requires a confirmed booking within its dates, active room/type with enough capacity, vacancy, readiness, and no required cleaning or maintenance block. Late arrival is allowed before departure; early arrival requires a booking change.
- Overdue active stays block future availability until checkout. Actual occupancy is rechecked at arrival.
- A room can remain occupied while independently blocked for maintenance. Lost keys automatically create urgent blocking access-reset work orders.
- All blocking issues must be resolved. Vacant repaired rooms go to cleaning. Repairs during occupancy retain occupied status and checkout still requires cleaning. Reopening restores the block; repair resolution resets unfinished cleaning to pending.
- The older manual room-status endpoint cannot bypass managed cleaning or maintenance. Blocks cannot be removed just by unchecking a box; resolve the issue.
- Assigned workers only act on their own tasks in their hotel. Managers can perform work directly. Guests see their own stays/reports, not staff task lists or affected guests' private data.
- Completed records/history are retained. No hard-delete APIs are provided.

## Settlement in this branch

This phase records an **external room-only settlement**, not a card charge or tax invoice. Staff must confirm collection and provide method, amount/currency and receipt reference. The amount equals the stored quote plus overdue calendar nights at the stored nightly rate. Early departure retains the booked charge; no refunds/fees are computed. Dates use the existing UTC policy. Full itemized billing, taxes, discounts, services and payments follow in the financial module.

## API

All routes use `/api/hms`, existing authentication/CSRF protection, hotel scoping and standard pagination. Updates require the observed version.

| Route | Purpose |
| --- | --- |
| POST /reservations/:id/check-in | Verify arrival and issue keys; reservation version |
| GET /stays, GET /stays/:id | Staff hotel stays or guest-owned stays; detail includes keys/settlement |
| GET /stays/:id/history | Authorized stay audit history |
| POST /stays/:id/keys | Additional key; at most five outstanding |
| POST /stays/:id/keys/:keyId/close | Record return/loss and note |
| POST /stays/:id/check-out | Staff settlement and departure |
| GET /assignees | Minimal active worker directory for front desk |
| GET /housekeeping/queue | Rooms awaiting cleaning |
| GET/POST /housekeeping | Scoped task list / schedule task |
| PUT /housekeeping/:id | Assignment/schedule edit |
| POST /housekeeping/:id/action | Start/complete with notes |
| GET /housekeeping/:id/history | Authorized cleaning history |
| GET/POST /maintenance | Scoped reports / report issue |
| PUT /maintenance/:id | Manager assignment, priority and room block |
| POST /maintenance/:id/action | Start/resolve/reopen with notes |
| GET /maintenance/:id/history | Authorized repair history |
| GET /maintenance/:id/affected | Front-desk view of impacted bookings |

## Verification

`npm test`, `npm run lint`, `npm run build`. Operations tests use an isolated MongoDB replica set and cover arrival-to-ready workflow, races, key ownership/uniqueness, lost keys, multiple blockers, reopening, assignment validation, guest/hotel isolation, schedules, overdue charges and rollback on email failure. UI tests cover verification, keys, settlement, scheduling and guest/worker repair actions.

The stay-operations branch was validated with 107 backend and 46 frontend tests, lint and production build before being pushed. The financial branch adds to that coverage and supersedes the temporary room-only settlement flow.
