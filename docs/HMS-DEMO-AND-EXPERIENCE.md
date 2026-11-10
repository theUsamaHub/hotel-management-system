# Guest experience and demonstration data

## Guest website

The coastal editorial redesign follows the supplied reference: scenic hero, warm backgrounds, serif headings, rounded edges and image-led sections. Both themes and mobile navigation remain supported. `/features` lists eleven existing guest capabilities with links from navigation, homepage and footer. The content explains pending confirmation, the per-hotel guest profile, staff-operated check-in/checkout, externally collected payments and hotel-specific services. It makes no promise of online charging or universally available amenities.

The two local images in `client/public/images` were made with the built-in image-generation tool. Briefs: a sunlit Mediterranean terrace above blue water with architecture on the right and clear headline space on the left; and an ivory guest suite with linen furnishings, cobalt accents and a sea-facing arch. They are labeled illustrative artwork, not actual hotel photographs. No remote image dependency is required.

## Safe demo seed

Run `npm run seed:demo` with the development database and `MAIL_MODE=file`. `npm run seed` now uses the same safe command. Existing users, hotels, reservations and categories are preserved. The fixed hotel code is `LS-DEMO`. The seed uses real domain operations, so pricing snapshots, version checks, invoices, work queues, notifications and audit events follow application rules.

Credentials are generated once into ignored `server/demo-access.json`. Open that file locally to sign in. Staff accounts belong only to the demo hotel; the demo administrator has the normal administrator permissions. Public registration remains guest-only. Do not deploy demo accounts to production.

The database `demo_seed_runs` collection records the run. A unique run ID prevents concurrent seeds. Completed reruns do nothing. If execution fails halfway, records already committed remain and the run is marked failed with its stage; reruns stop rather than overwrite or duplicate them. Inspect the failed stage and existing demo-only records before a deliberate repair. There is no automatic reset or deletion. No real email is sent in file mode.

## Walkthrough by role

- Admin: sign in, open Hotels & branches, choose LuxuryStay Demo House. Inspect all six actors in Activity log. Manage staff and global settings.
- Manager: Hotel operations contains three room types, nine rooms, policies, a service catalog, reports and feedback. Review assigned work and the active stay.
- Receptionist: Reservations has pending and confirmed bookings. Guest stays has an active stay and completed stay. Billing & invoices contains a deposit and an issued paid invoice. Verify/confirm bookings, receive guests and settle balances using the normal workflow.
- Guest (`demo.user`): the hotel guest profile already exists. My reservations shows four booking states. My stays has current and completed stays. Guest services includes a completed breakfast and a pending laundry request. My invoices shows the active bill and final invoice; My feedback contains an explicitly labeled demo review.
- Housekeeping: an assigned cleaning task is pending and completed work is in history. The account also completed a service request, visible in audit history.
- Maintenance: an assigned blocking inspection is in progress. Resolve with notes, then housekeeping must clean the vacant room before it is ready. An additional guest issue is open for management to assign.

Dates are relative to the first seed run, not refreshed on reruns. The completed example is a same-day departure; it demonstrates billing and feedback, not historical occupied room-nights. Future demand reports may legitimately show insufficient history. When dates become stale, make new bookings through the UI rather than rerunning the seed to rewrite history.

## Activity log

Admin-only `/admin/activity` shows timestamp, actor name, user ID, role at action, action, target ID and expandable selected details. Filters use actual recorded action names, role and literal name/user-ID/record-ID search. All roles' existing operational audit events are included; administrators see their own actions too.

New audit records snapshot actor ID, name and role. Those values survive account renames, role changes and deletion. Legacy records fall back to the current account name/role and keep the raw ID even if the account is deleted; historical identity cannot be reconstructed when it was never recorded. Authentication, account profile/security/session/avatar changes are now recorded alongside operational actions. Passwords, tokens and raw request bodies are not logged. This is a business-action audit trail, not a recording of every page view or failed anonymous request.
