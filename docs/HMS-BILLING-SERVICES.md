# Billing, guest services and feedback

Branch `feat/hms-billing-guest-services` is stacked on `feat/hms-stays-operations`. The new code replaces that branch's temporary room-only checkout settlement with an itemized account, recorded payments and a final invoice. Earlier completed stays without an invoice remain visible as legacy settlements; they are not silently rewritten.

## Staff and guest workflow

1. **Guest services**: managers/admins maintain a hotel's catalog with description, unit price, currency and activation. Guests or front-desk staff request services for active stays. The service currency must match the stay currency.
2. Front-desk staff assign requests to active staff at the same hotel. Assigned workers or front-desk staff start and complete services. Completion creates one billable charge; retries or simultaneous completions cannot duplicate it. Prices are saved at request time. Guests can cancel pending requests; staff can cancel pending/in-progress requests with a reason.
3. **Billing & invoices**: select a stay to see its room charge, overdue nights, completed services, other charges, discount, tax, payments and balance. Front desk records other charges and externally collected payments. Managers/admins authorize tax/discount adjustments and void erroneous charges with a reason.
4. In **Guest stays**, account for all keys and start checkout. Complete/cancel outstanding service requests first. The checkout amount is the remaining balance after recorded payments, not the original room subtotal. If the balance is zero, no duplicate payment is created.
5. Checkout atomically records any remaining payment, freezes the final invoice, records departure, generates cleaning and queues the invoice email. Printable draft bills are available before checkout. Final invoices can be printed or resent to the saved guest email afterward.
6. **My feedback**: a guest reviews their completed owned stay once with a 1–5 rating and comment. Managers/admins review hotel-scoped feedback, filter by rating/text and see the average for the matching records. Other hotel staff cannot read feedback through these APIs.

## Financial rules

- Money is stored in integer minor units; form inputs use ordinary currency units. Supported currencies are PKR/USD/EUR/GBP/AED. No currency conversion occurs.
- Room charges retain the booking price snapshot. Overdue calendar nights add that stored nightly rate; early departures retain the booked charge under the interim cancellation/stay policy.
- Tax is configured per stay as basis points (100 basis points = 1%). It applies to the entire subtotal after the monetary discount. Rounding is half-up to one minor unit, calculated with integer arithmetic. Default tax is zero; the app does not infer a hotel's tax obligations.
- Discounts require a reason and cannot exceed the subtotal. Adjustments/voids cannot reduce the account below money already recorded. Refunds, credit notes, post-checkout corrections, multiple tax categories and global pricing/tax policies are not implemented in this increment.
- Payments record external cash/card-terminal/bank-transfer collection. No online charge is processed. A case-insensitive unique receipt reference within each hotel and stay version checks prevent duplicate recording. Payments are immutable; there are no payment edit/delete endpoints.
- A service charge is created only when a request moves from in-progress to completed, using its saved quantity/price. Catalogue edits or deactivation do not reprice existing requests. Voiding a charge retains its record and audit reason.
- Accounts support up to 1,000 additional charge records. Amount inputs and totals are bounded and validated as safe integers.
- A draft bill remains live until checkout so late services and overdue nights cannot leave a stale final invoice. Final invoice lines, property/contact details, rates, currency, discounts, taxes and totals are snapshots and cannot be edited. Only email-delivery metadata may change afterward.
- Checkout requires all service requests to be terminal, all keys accounted for and the balance fully settled. Its payment, invoice, email, stay and room changes run in one MongoDB transaction.
- Invoices are printable HTML with a dedicated print layout and plain-text itemized email. No PDF attachment or tax-authority filing integration is included. `MAIL_MODE=file` previews email locally; SMTP/Resend is required for actual delivery. Resends are limited to once per minute and cannot choose a different recipient.

## Permissions and isolation

Admins access all hotels; assigned managers/receptionists access their hotel. Only admins/managers edit the service catalog, authorize adjustments or void charges. Guests see their own account and requests and can submit their own post-stay feedback. Assigned housekeeping/maintenance workers can process assigned services but cannot read billing endpoints. Assignment validates role, active status and hotel.

All writes enforce these rules on the server and participate in the shared per-hotel transaction protocol. Request/account versions prevent lost updates. Service-to-charge linking and receipt uniqueness are database-indexed constraints. Audit history retains billing adjustments, payments, service transitions and invoice issuance.

## API

All paths start `/api/hms`. Existing authentication, CSRF headers, pagination and hotel scope apply. Lists accept page/limit/search. Monetary inputs are minor units. Mutations carry the observed stay or request `version` unless creating a record.

| Route | Purpose |
| --- | --- |
| GET/POST /services, PUT /services/:id | Catalog list/create/edit; create includes hotel |
| GET /service-assignees | Minimal active hotel worker directory |
| GET/POST /service-requests | Scoped list/create; creation takes stay/service/quantity/notes |
| PUT /service-requests/:id/assignment | Staff assignment |
| POST /service-requests/:id/action | start/complete/cancel with notes |
| GET /service-requests/:id/history | Authorized request history |
| GET /stays/:id/bill | Itemized bill, payment history and account version |
| PUT /stays/:id/bill | Manager taxBps/discount/discountReason |
| POST /stays/:id/charges | Staff description/quantity/unitAmount |
| POST /stays/:id/charges/:chargeId/void | Manager void reason |
| POST /stays/:id/payments | Staff amount/method/unique reference |
| POST /stays/:id/invoice/email | Queue issued invoice to saved recipient; empty body |
| GET /stays/:id/billing-history | Authorized financial audit history |
| GET/POST /feedback | Scoped rating/comment list; guest submission takes stay/rating/comment |

## Verification and next work

Run `npm test`, `npm run lint`, and `npm run build`. Backend tests cover concurrent service completion and payment recording, price snapshots, exact totals and rounding, deposits, zero-balance departure, protected adjustments, invoice immutability, pending-service checkout guards, account isolation, invoice email rollback/throttling and feedback ownership. UI tests cover money conversion, tax percentages, read-only guest invoices, print/email controls, service requests, reviews and checkout after deposits.

Next: configurable hotel policies and global taxes, in-app notifications, operational reports/analytics, then broader performance/accessibility/end-to-end validation and user/demo documentation. Those phases are not claimed complete by this branch.

Validation for this increment: 120 backend tests passed across the full regression run and final targeted finance run; all 53 frontend tests passed. Lint and production build passed. Frontend test workers are limited to two to avoid CPU-starvation timeouts without raising the test timeout. Atlas collection/index initialization and `/api/health` were verified without inserting demo records. Local credentials remain ignored by Git.
