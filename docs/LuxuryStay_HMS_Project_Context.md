# LuxuryStay Hospitality — MERN Hotel Management System

**Document:** Full Project Context<br>
**Version:** 1.0<br>
**Stack:** MongoDB, Express.js, React.js, Node.js<br>
**Scope:** Functional requirements and module planning only; UI/UX design excluded.

## 1. Project Overview

LuxuryStay Hospitality is a hotel chain operating across multiple locations. The Hotel Management System (HMS) will centralize hotel operations, improve guest services, and support management decisions through reporting and analytics.

The system covers user and staff management, guest profiles, room inventory, reservations, check-in/check-out, billing and invoicing, housekeeping, maintenance, guest services, feedback, administration, notifications, and analytics.

**Source:** User-provided *MERN-Hotel_Management_System.docx*, particularly functional requirements on pages 4–5 and non-functional requirements on pages 6–7.

## 2. Existing Starter Kit

The team reports that a starter kit is already available and includes:

- User sign-up / registration
- User login
- Email functionality

The starter kit is estimated to represent approximately 40% of work already done, but that percentage is not verified against the complete HMS scope. Reuse and validate these implementations before adding hotel-specific features.

## 3. Proposed Roles

| Role | Responsibility |
|---|---|
| System Admin | Global system configuration, hotel administration, permissions |
| Hotel Manager | Hotel operations, staff, reports |
| Receptionist | Reservations, room assignment, check-in/check-out |
| Housekeeping Staff | Cleaning tasks and room status |
| Maintenance Staff | Maintenance requests and repairs |
| Guest | Online reservations, services, feedback |

Roles are proposed from the responsibilities in the brief; the team will finalize permission details.

## 4. Functional Modules

### Module 01 — User Management and Access Control

**Purpose:** Manage accounts, roles, staff, and guests.

**Features:**
- Reuse existing registration, login, and email features.
- Create, update, activate, and deactivate staff accounts.
- Assign user roles and enforce permissions.
- Maintain staff profiles and hotel assignments.
- Maintain guest contact information and preferences.
- Allow authorized profile updates.

**Collections:** `users`, `roles`, `staff_profiles`, `guest_profiles`

### Module 02 — Hotel and Branch Management

**Purpose:** Support LuxuryStay's multiple hotel locations.

**Features:**
- Register and update hotel properties.
- Activate or deactivate hotels.
- Assign hotel managers and staff.
- Maintain hotel contact and location information.
- Restrict operational data access by hotel.

**Collections:** `hotels`

*Supporting module proposed to implement the multi-hotel scenario; not separately enumerated in the source brief.*

### Module 03 — Room Management

**Purpose:** Manage room inventory, types, rates, and conditions.

**Features:**
- Add, edit, and deactivate rooms.
- Maintain room types and prices.
- Track room availability by date.
- Track physical room status: available, occupied, cleaning, maintenance.
- Associate rooms with a hotel.
- Update room status and maintain operational history.
- Block assignment of rooms under maintenance.

**Collections:** `rooms`, `room_types`, `room_status_logs`

### Module 04 — Reservation and Booking Management

**Purpose:** Allow online and staff-created reservations.

**Features:**
- Search available rooms by dates.
- Create guest and staff reservations.
- Confirm reservations and send confirmation emails.
- View, modify, and cancel bookings according to policy.
- Assign rooms to reservations.
- Track booking status.
- Prevent overlapping active reservations for the same room and date range.

**Proposed lifecycle:** Pending → Confirmed → Checked In → Checked Out; Cancelled is an alternative terminal state.

**Collections:** `reservations`

### Module 05 — Check-In and Check-Out

**Purpose:** Manage guest arrival and departure.

**Features:**
- Retrieve confirmed bookings and verify guest details.
- Assign an appropriate room.
- Record guest check-in and room key issuance.
- Mark the room occupied.
- Retrieve active stays at check-out.
- Finalize charges and billing.
- Record guest departure and key return.
- Release rooms for cleaning.

**Collections:** `stays`, `key_issuance_logs`

### Module 06 — Billing and Invoicing

**Purpose:** Calculate accommodation and service charges.

**Features:**
- Calculate room charges from rates and stay duration.
- Add food, laundry, and other service charges.
- Apply configured taxes and authorized discounts.
- Generate itemized bills and invoices.
- Record payments and outstanding balances.
- Print or email invoices.
- Retain billing history.

**Collections:** `invoices`, `payments`, `billing_charges`

*The brief does not mandate an online payment gateway.*

### Module 07 — Housekeeping

**Purpose:** Coordinate room cleaning.

**Features:**
- List rooms requiring cleaning.
- Create, schedule, and assign cleaning tasks.
- Track pending, in-progress, and completed work.
- Update room cleanliness status.
- Report discovered maintenance issues.
- Retain cleaning history.

**Collections:** `housekeeping_tasks`

### Module 08 — Maintenance

**Purpose:** Track hotel repair requests.

**Features:**
- Accept issues reported by guests or staff.
- Create and assign maintenance requests.
- Set priorities and track status.
- Restrict affected rooms when necessary.
- Record resolution details and reopen unresolved issues.
- Return rooms to service after required checks.

**Collections:** `maintenance_requests`

### Module 09 — Guest Services

**Purpose:** Manage additional guest requests.

**Service examples:** Room service, food and beverages, laundry, wake-up calls, transportation.

**Features:**
- Maintain available services.
- Create requests from guests or staff.
- Assign and track requests.
- Record completed services.
- Add billable services to guest charges.

**Collections:** `services`, `service_requests`

### Module 10 — Guest Feedback

**Purpose:** Collect feedback and ratings.

**Features:**
- Accept guest ratings and comments.
- Associate feedback with a hotel or stay.
- Allow managers to review and filter feedback.
- Include feedback trends in reporting.

**Collections:** `guest_feedback`

### Module 11 — Reporting and Analytics

**Purpose:** Provide operational insights.

**Features:**
- Report reservations, room availability, occupancy, and revenue.
- Analyze guest feedback.
- Filter reports by hotel and period.
- Analyze historical demand.
- Support forecasting and pricing optimization.

**Collections:** `report_snapshots` *(optional; reports can be computed from operational collections)*

### Module 12 — System Administration and Settings

**Purpose:** Configure hotel rules and policies.

**Features:**
- Configure room pricing rules.
- Maintain check-in, check-out, and cancellation policies.
- Configure applicable taxes.
- Maintain global and hotel-specific settings.
- Restrict changes to authorized administrators.

**Collections:** `system_settings`, `hotel_policies`, `tax_rules`

### Module 13 — Notifications and Email

**Purpose:** Communicate important operational events.

**Features:**
- Reuse existing email functionality.
- Send reservation confirmations and cancellation notices.
- Email guest invoices.
- Notify staff about bookings, cleaning, and maintenance.
- Provide in-app notifications and read status.

**Collections:** `notifications`

### Module 14 — Security, Monitoring, and Audit

**Purpose:** Secure hotel data and record critical actions.

**Features:**
- Enforce role-based authorization in backend APIs.
- Restrict staff access by assigned hotel.
- Validate API input and protect guest data.
- Maintain secure authentication and session handling.
- Log important administrative changes and system events.
- Monitor errors and application performance.

**Collections:** `audit_logs`

*Audit logging is a proposed supporting implementation for the brief's security and monitoring requirements.*

## 5. Proposed MongoDB Collection Names

**Names only.** The development team will independently design fields, references, embedding, validation, and indexes.

### Users and Hotels
1. `users`
2. `roles`
3. `staff_profiles`
4. `guest_profiles`
5. `hotels`

### Rooms and Reservations
6. `rooms`
7. `room_types`
8. `room_status_logs`
9. `reservations`
10. `stays`
11. `key_issuance_logs`

### Billing
12. `invoices`
13. `payments`
14. `billing_charges`

### Housekeeping and Maintenance
15. `housekeeping_tasks`
16. `maintenance_requests`

### Guest Services and Feedback
17. `services`
18. `service_requests`
19. `guest_feedback`

### Settings and Administration
20. `system_settings`
21. `hotel_policies`
22. `tax_rules`
23. `notifications`
24. `audit_logs`

### Optional Analytics
25. `report_snapshots`

**Total:** 24 proposed core collections + 1 optional collection. The final database may use fewer collections if the team embeds appropriate data.

## 6. End-to-End Guest Workflow

1. Guest registers or logs in.
2. Guest searches room availability for selected dates.
3. Guest creates a reservation.
4. Reservation is confirmed and a confirmation email is sent.
5. Receptionist verifies reservation at arrival and completes check-in.
6. Room is marked occupied and key issuance is recorded.
7. Guest requests additional services during the stay.
8. Service charges are added to the guest bill where applicable.
9. Receptionist completes billing and check-out.
10. Room is sent for cleaning.
11. Housekeeping completes cleaning and updates room readiness.
12. Room becomes available for the next eligible booking.

Maintenance, administration, feedback, and reporting operate alongside this workflow.

## 7. Development Phases

### Phase 1 — Foundation
- [ ] Inspect and validate starter kit.
- [ ] Reuse existing authentication and email.
- [ ] Implement role-based authorization.
- [ ] Implement hotel and staff management.

### Phase 2 — Core Hotel Operations
- [ ] Implement room types and inventory.
- [ ] Implement room availability and status.
- [ ] Implement guest profiles.
- [ ] Implement reservations.

### Phase 3 — Guest Stay Operations
- [ ] Implement check-in/check-out.
- [ ] Implement room assignment and key records.
- [ ] Implement housekeeping.
- [ ] Implement maintenance.

### Phase 4 — Financial and Guest Services
- [ ] Implement guest service requests.
- [ ] Implement billing and charges.
- [ ] Implement payment records and invoices.
- [ ] Implement feedback.

### Phase 5 — Administration and Reporting
- [ ] Implement policies, settings, and tax configuration.
- [ ] Implement notifications and email triggers.
- [ ] Implement reports and analytics.
- [ ] Implement audit logs and monitoring.

### Phase 6 — Finalization
- [ ] Complete integration and end-to-end tests.
- [ ] Perform security and performance testing.
- [ ] Fix defects.
- [ ] Complete user and developer documentation.
- [ ] Record a working application demonstration video.

## 8. Proposed Core Business Rules

1. Staff may only access hotels and operations authorized for their role.
2. The same room must not have overlapping active reservations.
3. Maintenance-blocked rooms cannot be assigned.
4. Physical room condition and date-based booking availability are distinct.
5. Cancelled reservations cannot be checked in.
6. Check-out must resolve billing according to hotel policy.
7. Existing booking prices and historical invoices must remain traceable after pricing changes.
8. Checked-out rooms must complete required cleaning before being marked ready.
9. Backend APIs must enforce authorization independently of frontend navigation.
10. Completed reservations, payments, and invoices must remain auditable.

These are implementation proposals; the source brief does not specify all edge cases.

## 9. Non-Functional Requirements

The project brief specifies:

- **Response time:** Target 1–2 seconds for most interactions.
- **Concurrency:** Support hundreds of concurrent users.
- **Scalability:** Support growth and horizontal scaling.
- **Security:** Secure authentication, authorization, and sensitive data protection in storage and transit.
- **Privacy:** User consent and applicable data privacy compliance, including GDPR where relevant.
- **Reliability:** Target minimum 99% uptime and automated backups.
- **Compatibility:** Chrome, Firefox, Safari, Edge, and mobile devices.
- **Accessibility:** Follow accessibility standards such as WCAG.
- **Monitoring:** Log errors, performance, and user activity.
- **Testing:** Unit, integration, end-to-end, and security testing.
- **Documentation:** User guide, developer documentation, and application demo video.

These are project targets, not confirmed properties of the current implementation.

## 10. Scope Boundaries

### Included
- All functional areas in the provided eProject brief.
- Multi-hotel management as supporting infrastructure.
- Audit logging as supporting infrastructure.
- Reuse of existing login, registration, and email features.

### Not Currently Included
- UI/UX design, theme, colors, or layout decisions.
- Detailed database schema or field definitions.
- Final API endpoint contracts.
- Online payment gateway integration.
- Third-party booking platforms.
- Loyalty programs, restaurant POS, AI chatbots, or mobile applications.

## 11. Team-Owned Technical Decisions

The team will define:
- MongoDB schemas and data relationships.
- Whether related data should be embedded or referenced.
- Indexes and database validation.
- API routes and request/response contracts.
- Project folder structure and code conventions.
- Detailed permission matrix.
- Deployment configuration and testing strategy.

## 12. Completion Definition

The project is functionally complete when all required modules work together, access controls are enforced, reservations and room states remain consistent, guest stays and billing can be processed end-to-end, staff workflows operate correctly, reports are available, and the required tests, documentation, and demonstration are delivered.

---

*This document organizes the supplied LuxuryStay eProject requirements into an implementation plan. Proposed collections, supporting modules, business rules, and development phases are planning decisions, not literal database specifications from the source document.*
