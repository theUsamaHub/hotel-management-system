# Admin analytics dashboard

Open **Admin → Overview** (`/admin/dashboard`). This replaces the starter category dashboard with actual hotel analytics. It requires an administrator session; managers and other roles continue to use their existing scoped hotel reports.

## Controls and visualizations

- All properties or a specific hotel, including historical data from inactive properties.
- Last 7, 30 or 90 UTC calendar days, including today so far, compared with the immediately preceding equal-length calendar period.
- PKR, USD, EUR, GBP or AED for financial metrics. Currencies are never combined; operational counts remain across all currencies.
- Refresh button and generated-at time. Filter changes display a loading state instead of presenting old values under a new scope.
- Payment, booking and invoice line charts with a dashed previous-period series, keyboard-focusable points, exact-value readouts and expandable data tables.
- Reservation-status donut and current room-status bars, each with numerical counts and percentages.
- Eight summary cards, four front-desk counts, three work-queue counts and the next six confirmed arrivals.
- Light/dark themes and responsive layouts. Tables scroll within their cards on small screens.

## Definitions

**Payments recorded:** external receipts grouped by their creation timestamp and selected currency. They include deposits and settlement receipts and are not online charges, profit, or recognized revenue.

**Issued invoice total:** final invoices grouped by issue timestamp and selected currency, including tax and after discounts. Drafts are excluded. Invoice totals and payments describe different events and must never be added together.

**New reservations:** records created in the period, including ones subsequently cancelled. The status donut shows the current status of those same records. This is not a count of scheduled arrivals or a historical status snapshot.

**Growth:** `(current - previous) / previous * 100`. When the previous value is zero, percentage growth is unavailable. The screen shows “No previous activity” or “No activity in either period.” Today is incomplete while the previous calendar period is complete; users must consider that difference. Zero-filled dates mean no recorded activity, not proof that imported history is complete.

**Current occupancy:** occupied physical rooms divided by active rooms whose room types and hotels are also active. No rooms means N/A. The room chart uses mutually exclusive physical statuses; the separate maintenance-block count can overlap an occupied or other-status room. Physical readiness is not date-specific reservation availability.

**Properties and staff:** selected property counts and active staff accounts with manager/receptionist/housekeeping/maintenance roles. Administrators and guest accounts are excluded from the staff count.

**Guest rating:** average and count of feedback created in the selected period. No reviews means no rating, not zero stars.

**Today’s desk:** confirmed bookings scheduled to arrive today; checked-in bookings due to depart today; checked-in bookings with an earlier departure date; and pending bookings across all dates. All dates are UTC. Cancelled bookings are not counted as due arrivals.

**Open work:** unfinished housekeeping, open/in-progress maintenance and pending/in-progress services, regardless of reporting period. These are current queues, not historical workload totals.

**Next arrivals:** up to six confirmed bookings arriving today or later, ordered by date then ID. The list includes guest name, booking reference, property, room and dates, and is available only to admins.

## API and validation

`GET /api/admin/dashboard?days=30&currency=PKR&hotel=<optional-id>` is authenticated and admin-only. Query validation accepts only the supported periods/currencies and a valid hotel ID; unknown hotels return 404. Reads run sequentially inside one MongoDB snapshot transaction, so cards and graphs share a consistent snapshot. Daily aggregates are zero-filled and summed to produce the period cards; money remains integer minor units until presentation, which explicitly uses two decimal places.

Backend tests check permissions for every non-admin role, hotel isolation, currency isolation, exact period boundaries, future-record exclusion, draft-invoice exclusion, zero baselines, declining periods, booking statuses, inactive room types and empty inventory. UI tests check currency units, growth labels, filter requests, empty states and exact-value chart tables. Browser checks use the existing demo data at desktop/mobile widths in both themes.

No artificial historical bookings or payments were added to make the graphs look busy. A recently seeded hotel will legitimately show a small number of spikes and no prior-period growth until it accumulates history.
