# Threat Model

GO Pharmacy exposes an Express/tRPC same-origin React application. Assets are session credentials, user carts, addresses, order history, notifications and inventory. Attackers include unauthenticated web callers and ordinary authenticated customers. Server identity must authorize every private row and admin operation; authoritative prices and locked database transactions must protect checkout. Medical data and prescription workflows are excluded from Beta and must fail closed. External Manus OAuth/cloud helpers exist in baseline but portable Beta must not depend on them.

## Trust Boundaries

- Browser to Express/tRPC
- Session cookie to server user identity
- User ID to MySQL rows
- Customer to administrative procedures
- Checkout to concurrent inventory updates

## Assumptions

- Fictional test data only; no payment/dispensing integration authorized
- Current GitHub integration is read-only; no public deployment

---

## Saved Model Context

- Source: scan
- Scan: 70694699-bd37-407f-b67a-f5e3fc489a93
- Target: go-pharmacy
- Revision: d9a383e55882aa7fdfd29711976ef1e7005faa53
- Result status: completed
- Model origin: not recorded
- Model scope: not recorded
- Scan scope: .
- Scan scope description: GO Pharmacy stabilization: baseline main d9a383e55882aa7fdfd29711976ef1e7005faa53 plus targeted review and verification of this session's local working-tree repairs.
