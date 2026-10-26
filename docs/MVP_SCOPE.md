# MVP scope

## Operational scope

Public catalog and product details; search/category filters over up to 100 displayed catalog entries; invited account registration and local sign-in; persistent private cart; server quotation; simulated order creation, history, tracking; account name/phone and fictional address management; administrator product creation/edit/archive, absolute stock counts, order review/status changes; private notifications.

The current schema represents JD amounts with two decimal places. This is the defined simulation precision, not a claim of commercial JOD accounting compliance. Shipping, tax and discounts are zero in Beta. PaymentMethod uses the legacy `cash` database enum internally but every new order is marked `isSimulated=true`, never charged or dispensed. Historical orders default to false and cannot be advanced by Beta administration.

## Disabled

Doctors, consultations, appointments, prescriptions, medication reminders, pharmacy fulfillment and delivery dashboards. Existing source and historical medical tables are preserved for later engineering. All associated tRPC procedures fail before their handlers; old routes show an unavailable notice. Prescription-required products are never orderable, even if the flag changes after cart addition. Legacy OAuth callback is unregistered; old SDK helpers are inactive.

## Roles

`user`: own account, addresses, cart, notifications and orders. `admin`: product/inventory and all order operations. Legacy `pharmacist`/`doctor` role values retain customer permissions only; separate clinical/professional capabilities are not implemented. Product categories remain the existing fixed enum, selectable in administration; no new category taxonomy service.

## Private Beta

5–15 invited fictional-data testers, one application process, durable MySQL, HTTPS, operator-controlled credentials/invitations. No medical guidance, real patient data, real payment capture, sales, fulfillment or operational traction claims.
