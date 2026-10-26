# Stabilize invitation-only simulated commerce and secure Private Beta workflows

The existing pharmacy prototype exposed appointment rows publicly, omitted cart/notification ownership predicates, and created orders without atomic inventory handling. This change closes those active paths, adds portable invitation/password/session authentication, and connects the customer and administrator workflow to persistent simulated orders.

Checkout now computes exact server prices, validates the current basket/stock/prescription flags under locks, commits order/items/inventory/cart/notification together, and replays idempotent requests without duplicating orders. Invalid definitive submissions can be corrected; ambiguous failures retain their original key. Clinical services and legacy OAuth/external notification entry points are disabled in Beta. Product archival preserves history; cancellation restores stock once.

Includes additive migration/preflight, fictional seeding and explicit operator account/invitation tools, practical deployment/backup documentation, patched dependency lockfile, and connected Arabic RTL account/cart/checkout/tracking/admin screens.

Validation: 71 tests passed against real MySQL 8.4.13; application and test/script TypeScript checks passed; production build passed. Actual browser customer-to-admin-to-customer order/status flow verified. Concurrent stock/replay/rollback and cross-user negatives passed. Migration rejection on duplicate legacy carts preserved data; backup/restore matched the sample order. Dependency audit: zero critical/high; five documented lower-severity findings. Docker and hosted HTTPS were not run. Formal source scan has partial coverage and an original-snapshot warning; see implementation evidence.

This is fictional Private Beta simulation only: no real payment, dispensing, patient data, consultation or delivery. No public deployment or merge is included.
