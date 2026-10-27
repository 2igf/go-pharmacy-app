# GO Pharmacy — existing and missing functionality, V1

Inspected 2026-10-27. Historical evidence is local Git, not an older remote main:
original `d9a383e`, MVP `943498797d8adc11af7fde0fb9f681df1021857c`, Android
`889c7e40472e27a50f5c2c26b900b0dbe63ce41e`. The latter is this branch's base.
No `GOPHARM_MASTER_SPEC_AR.md` exists in the inspected local checkouts or its
available Git path history. No substitute Canva specification has been created.

## Functional inventory

| Area | Existing implementation | Current availability / missing work |
| --- | --- | --- |
| Customer catalog | Home, Products, ProductDetail, ProductModal; search, categories, stock/active status | Available web and bundled Android. Global beta catalog, not separate pharmacy inventory. No redesign in V1. |
| Personal commerce | Cart, quote, Checkout, own order list/detail, OrderTracking | Simulation only; atomic stock/order/cart/notification transaction, decimal totals, idempotency and state transitions retained. Android checkout validation is OPEN; see report. |
| Identity/account | Invitation registration/login/logout, profile, addresses, notifications | Existing opaque cookie session, scrypt, allowlist, expiry and ownership retained. No role selection/assignment endpoint. |
| Android | Capacitor 8.5.3, embedded React assets, native HTTPS transport, endpoint setup, RTL, splash/icon | Preserved. API/MySQL remain external to APK. iOS app/project and store release are not implemented. |
| Doctor directory | `Doctors.tsx`; doctors, time slots, reviews schema; doctors router | Source retained; UI route unavailable and API gated. This is not an operational Doctor Portal. |
| Appointments | `Appointments.tsx`; appointments table, create/cancel/list/byDoctor methods | Retained and gated for all roles. No approved provider/patient relationship model, safe practitioner scoping or completed consultation workflow. |
| Prescriptions/reminders | Prescriptions and reminder/log tables; `Reminders.tsx`; legacy handlers | Retained, gated. No safe dispensing/clinical authorization or production medical service. |
| Pharmacy Portal | `PharmacyDashboard.tsx` checks pharmacist in UI and reads `products.list` | Retained but unreachable through current route. Displays global catalog statistics; no pharmacy entity, membership, private inventory or pharmacy order allocation. Must not be restored as a secure portal. |
| Clinic Portal | `doctors.clinic`/clinicLocation descriptive fields | No dedicated Clinic Portal, clinic entity, clinic memberships, tenancy or workflows found in current tree / available named-page history. A string field is not a clinic boundary. |
| Delivery | `DeliveryDashboard.tsx` reads own `orders.list`; legacy UI permits user/admin | Retained but route unavailable. No driver role in persisted enum, assignment table, pickup/proof workflow or least-data delivery DTO. This is not GO Captain. |
| Administration | Current `BetaAdmin.tsx`: catalog create/update/archive and simulated order/status management | Available via /admin and /admin-panel with backend admin guard. Separate GO Admin client, user/role management, provider approvals, audit trail and reporting remain missing. |
| Older administration | `AdminDashboard.tsx`, `AdminPanel.tsx` | Retained, no longer mounted; old medical statistics/mutations are gated. Not equivalent to current safe BetaAdmin. |
| External integrations | Legacy maps/storage/notification/OAuth helpers remain in source | Not proof of active integrations. Legacy OAuth callback and owner notification API are disabled; no payment processing/real sale enabled. |

## What changed during MVP, before this task

The original App.tsx mounted doctors, appointments, reminders, pharmacy, delivery,
AdminDashboard and AdminPanel. MVP changed medical/provider/delivery routes to an
explicit unavailable page and replaced mounted administration with BetaAdmin. Old
pages were retained. Git diff `d9a383e..9434987 -- client/src/pages` shows additions
and modifications, **no page deletion**. Current customer pages were simplified
for a safe invitation-only simulation; Login and BetaAdmin were added. This V1
does not alter their visuals or replace historical design references.

MVP replaced upstream OAuth usage with invitation/password sessions, disabled the
old callback, blocked medical APIs and owner notification, replaced unsafe order
creation with the shared transaction service, added user-scoped notifications,
and changed product deletion to archive. Those security decisions remain intact.
Old medical lookup handlers include insufficient patient scoping and a placeholder
doctor deletion response; retaining code does not authorize activating it.

The existing schema includes users, credentials, sessions, products, cartItems,
orders/orderItems, userAddresses, doctors/timeSlots, appointments, prescriptions,
medicationReminders/logs, reviews and notifications. It lacks pharmacy/clinic
organizations, memberships, provider approval, explicit care relationships,
delivery assignments and a durable admin security audit log. No schema or data
migration was performed for V1.

## Runtime provenance

The separate `ops/android-cloudflare-test` branch contains the guarded temporary
Cloudflare API wrapper from later work. Its running checkout and private runtime
configuration were left in place. V1 starts from the requested Android reference;
it does not silently cherry-pick or replace that operational branch. Integrating
the reviewed operations wrapper with this foundation is a future explicit step.
The prior phone login/catalog confirmation concerns that operational server, not
a deployed foundation backend or a verified phone checkout.
