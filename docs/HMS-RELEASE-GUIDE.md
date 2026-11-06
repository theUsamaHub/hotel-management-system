# Hotel operations acceptance and release guide

## First use

1. Configure the ignored server/.env using server/.env.example. Use a replica set or Atlas; transactions require it.
2. Run npm ci, then npm run bootstrap:admin using your chosen local admin credentials. Never run the destructive demo seed against a real database.
3. Run npm run dev. Sign in as admin, create a hotel, add staff with hotel assignments, then add room types and rooms in Hotel operations.
4. Review global settings and hotel policies before accepting bookings. Prices use minor currency units; 10000 PKR means PKR 100.00. Tax uses basis points; 1000 means 10%.

## Daily workflow

- Guests create their guest profile, search dates and reserve. Reception confirms the reservation after reviewing it.
- Reception verifies the guest at arrival and records key labels. Only ready rooms can be checked in.
- Guests or reception request services. Authorized staff start and complete requests; completion adds the saved service price to the bill.
- Reception records external payments with unique receipt references. Managers authorize tax/discount adjustments.
- Return or account for every key, complete/cancel pending services, review the outstanding bill, then check out. The finalized invoice is printable and queued for email.
- Complete required cleaning before the room becomes ready again. Maintenance blocks require repair and cleaning.
- Guests can submit feedback after departure. Managers review period reports; administrators review audit history and monitoring.

## Automated acceptance

The server workflow.test.js acceptance test creates hotel inventory through authenticated APIs, books as a guest, confirms and checks in, completes a service, records a deposit, returns the key, settles the invoice, completes cleaning, verifies availability, submits feedback and reconciles reports. It also verifies guest notifications. Only authentication fixtures and task/key identifier lookups use direct database access.

Run npm test, npm run lint and npm run build at the repository root. Backend tests create isolated disposable MongoDB instances and do not use Atlas. If the MongoDB download is unavailable, set MONGOMS_SYSTEM_BINARY to your local mongod executable.

Existing suites cover cross-hotel access, roles, CSRF/session security, conflicting updates, concurrent booking/payment attempts, notification rollback, policy inheritance and immutable issued invoices. GitHub's Node compatibility workflow runs lint, coverage tests and builds for main pushes and pull requests.

## Manual release acceptance still required

- Follow the daily workflow in a browser using distinct admin, reception, guest, housekeeping and maintenance accounts against a disposable staging database.
- Verify print output, email provider delivery, keyboard navigation, mobile layouts and supported browsers.
- Test realistic concurrent users against staging; record latency percentiles, error rate and resource usage. Unit-test timing and process-local monitoring do not establish production capacity.
- Configure HTTPS, production cookies/CORS, secrets, provider credentials, persistent logs/alerts and backups. Perform a restore drill.
- Record a demonstration of the complete browser workflow and review it before public launch.

This increment supplies API acceptance coverage and an operating checklist. It does not claim browser automation, a demonstration recording, production load results, or a deployed production service.

## Merge procedure

Fetch origin, confirm a clean working tree, verify each earlier feature branch is an ancestor of the release branch, run required checks, push the release branch, then merge it into the current origin/main without rewriting history. Push main normally and verify its upstream has no difference. Preserve feature branches for traceability.
