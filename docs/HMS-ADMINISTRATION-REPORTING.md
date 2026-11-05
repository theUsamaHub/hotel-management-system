# Administration, notifications and reporting

Branch: `feat/hms-policies-notifications-reports`, based on the billing/guest-services branch and containing all earlier modules.

## Using the modules

Open **Hotel operations** (or **Book a stay** for guests) and select a hotel. New tabs:

- **Hotel policies**: everyone can read the applicable policy. Admins and that hotel's managers can edit it or restore global inheritance.
- **Global settings**: system admins set defaults for hotels without an override.
- **Notifications**: your own hotel inbox, unread filter, mark-read action and shortcuts to the relevant module. Refreshes every 30 seconds while open.
- **Reports**: admins and assigned managers choose a hotel and UTC reporting period. The end date is exclusive; the maximum period is 366 days.
- **Monitoring**: system admins inspect request volume, server errors, responses over two seconds, average/maximum latency, uptime and process memory. Refreshes every 30 seconds while open.

## Policy rules

Policies contain advance-booking limit (0–730 days), maximum stay (1–365 nights), same-day booking permission, self-service change/cancellation cutoff (0–365 days before arrival), tax (0–10000 basis points), check-in/checkout UTC hours (0–23), and weekend-arrival rate multiplier (1000–30000 basis points).

100 basis points = 1%. A weekend multiplier of 12500 charges 125% of the base nightly room-type price for reservations arriving on Saturday/Sunday. That rate applies to every night in the reservation. Rates round to the nearest minor currency unit. Availability search displays the adjusted rate. Existing same-room reservations retain their booked rate when dates change; room reassignment uses the new room's current base rate and the saved arrival-pricing rule.

Global defaults preserve the original behavior: same-day arrivals allowed, 730-day advance limit, 365-night maximum, same-day changes/cancellation before check-in, zero tax, check-in/checkout hour 00:00 UTC, and no weekend adjustment. Managers may create a complete hotel override. **Use global defaults** restores inheritance without resetting the edit version or erasing audit history. Admins can change global defaults; managers cannot.

New reservations snapshot the effective policy. Later global/hotel changes do not rewrite reservations or invoices. Old reservations without a policy retain the original defaults. Guest changes as well as cancellation stop after the saved cutoff, preventing reschedule-then-cancel bypasses; reception can approve exceptions. Check-in honors the saved arrival-hour restriction on the arrival date. An overdue night is charged for each **full 24 hours** elapsed after the scheduled checkout date/hour; early departure does not refund room nights. The checkout account still must be settled and all keys/service requests resolved.

Tax defaults come from the reservation snapshot. Existing manager-authorized bill configuration can override tax and discounts, including explicit zero tax. Tax is calculated after discount with integer half-up rounding; financial and invoice history remain immutable after checkout.

Policy writes use transactions, per-hotel serialization, optimistic versions and before/after audit events. Conflicting saves return 409; reopen the editor to load the current version. Global settings use versioned atomic updates and a unique singleton key. Policy edits and resets appear in the existing administrator Activity log.

## Notifications

Reservation creation, changes, confirmation and cancellation notify the booking owner and active admin/desk staff. Required cleaning, manual cleaning task creation and assignment notify active admin/desk/housekeeping staff. Maintenance creation, assignment and booking-block changes notify active admin/desk/maintenance staff. Notifications contain operational references rather than guest contact information.

Each recipient has independent read state. APIs restrict reads and read changes to that recipient and the staff member's currently assigned hotel. Notification inserts share the originating transaction: a failed notification write rolls back its business operation. No prior notifications are backfilled. Notifications are operational inbox items, not assignment ownership; existing task permissions still control who may act.

Existing encrypted durable email jobs continue to handle reservations, arrival/departure and invoices. Local file-preview delivery remains configured; actual SMTP/Resend delivery requires provider credentials. In-app delivery does not depend on email delivery.

## Report definitions

- Reservation counts and daily demand use scheduled arrival dates and **current** status; cancelled arrivals are shown separately. They are not historical status snapshots.
- Payments use the date the receipt was recorded. Issued invoices use issue date and expose subtotal, discount, tax and total. Draft invoices are excluded. Payment totals and invoice totals are separate and are never added together. Currencies are grouped independently.
- Actual occupied room-nights use stay check-in/check-out dates: arrival inclusive, departure exclusive, in UTC. A room is counted once per date. Active stays count through the current date; today's count is provisional. Same-day stays contribute zero completed room-nights.
- Current occupancy uses current active rooms with active room types and the occupied physical status. This is explicitly a current snapshot, regardless of the reporting range. Historical percentage occupancy is not reconstructed because room inventory/status history does not contain complete historical capacity snapshots.
- Availability is the number of currently active, eligible rooms free for the **entire** selected future/current period, including overdue-stay and maintenance exclusions. For a past start date it is unavailable. It is operational inventory availability, not a promise that every selected date satisfies booking policy.
- Feedback totals/averages and daily trends use review creation dates. No reviews produces an unavailable average rather than a misleading zero rating.
- Seven-day demand estimates use the preceding 28 UTC days' same-weekday mean occupied rooms, capped by current capacity. At least one recorded stay must predate the historical window; otherwise estimates/pricing suggestions are unavailable. Missing recorded nights count as zero, so incomplete imports affect estimates. This is a transparent baseline, not a trained predictive model.
- Pricing guidance suggests 110% of base at estimated occupancy >=80%, 95% at <=30%, otherwise 100%. Suggestions never alter prices; managers must review them. This heuristic does not account for events, competitors, seasonality or profit margins.

Report queries run within a consistent database transaction and include no guest contact details. Relevant hotel/date indexes support aggregation. Large datasets and production concurrency still need the Phase 6 load tests.

## API additions

All endpoints below are under `/api/hms`, require authentication, and retain existing CSRF protection for writes.

| Endpoint | Access |
| --- | --- |
| GET /policies?hotel=ID | Authenticated; staff restricted to assigned hotel |
| PUT /policies | Admin / assigned manager; full fields plus hotel and version |
| POST /policies/reset | Admin / assigned manager; hotel and version |
| GET /settings, PUT /settings | System admin; PUT full policy fields and version |
| GET /notifications?hotel=ID&unread=true&page=1&limit=10 | Own inbox only |
| POST /notifications/:id/read | Own notification; empty body; idempotent |
| GET /reports?hotel=ID&from=YYYY-MM-DD&to=YYYY-MM-DD | Admin / assigned manager |
| GET /monitoring | System admin only |

Monitoring counters are per process, reset on restart and are not distributed/persistent metrics or an uptime guarantee. Responses carry a generated `X-Request-Id`. Production server errors produce a structured log with request ID, method and status, omitting request bodies, full URLs and exception text. Existing request timing logs and audit records remain in place. A production log collector, alerting and backup monitoring are deployment work.

## Verification and remaining finalization

Management tests cover policy enforcement, preserved taxes/prices, cancellation bypass prevention, role/hotel isolation, conflicting saves, notification privacy/rollback, currency/date filters, global inheritance, arrival/checkout hours, occupied-night boundaries and monitoring access. UI tests cover policy version retention, guest read-only access, notification read/filter actions and report periods/empty states.

Run `npm test`, `npm run lint`, and `npm run build` from the repository root. Backend tests start isolated MongoDB instances, never the supplied Atlas database. See `HMS-PROGRESS.md` for the latest results.

Phase 6 still includes a browser-based end-to-end pass, production-scale security/performance checks, accessibility/cross-browser verification, deployment/backup/alerting configuration, complete user/developer guides and the demonstration video. These are not claimed complete by this increment.
