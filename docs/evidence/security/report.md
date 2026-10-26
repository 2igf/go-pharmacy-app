# Security Review: go-pharmacy

## Scope

GO Pharmacy stabilization: baseline main d9a383e55882aa7fdfd29711976ef1e7005faa53 plus targeted review and verification of this session's local working-tree repairs.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_cdcef04eef1f509314540f16922789b4dfff477e7eb2af6db08d5880ab91cc41
- Revision: d9a383e55882aa7fdfd29711976ef1e7005faa53
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Scan context: No surviving confirmed exploitable issue in the reviewed active Beta paths. Findings repaired during this implementation are described in the implementation report; empty findings here does not mean the untouched baseline is secure. Broad repository coverage is partial.

Limitations and exclusions:
- The scan began at the baseline Git revision; stabilization files were reviewed in the local working tree before commit.
- Generic UI/support coverage is partial.
- Docker and actual hosted HTTPS were not executed.
- Excluded node_modules/\*\*: Dependency source not exhaustively reviewed; registry advisory audit performed separately.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | partial |
| Validation mode | source review plus local MySQL and browser verification |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

GO Pharmacy exposes an Express/tRPC same-origin React application. Assets are session credentials, user carts, addresses, order history, notifications and inventory. Attackers include unauthenticated web callers and ordinary authenticated customers. Server identity must authorize every private row and admin operation; authoritative prices and locked database transactions must protect checkout. Medical data and prescription workflows are excluded from Beta and must fail closed. External Manus OAuth/cloud helpers exist in baseline but portable Beta must not depend on them.

### Trust Boundaries

- Browser to Express/tRPC
- Session cookie to server user identity
- User ID to MySQL rows
- Customer to administrative procedures
- Checkout to concurrent inventory updates

### Assumptions

- Fictional test data only; no payment/dispensing integration authorized
- Current GitHub integration is read-only; no public deployment

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Generic UI/support source outside traced workflows | Broad audit coverage | Needs follow-up | Not every generic UI component, unused showcase/dashboard source, test implementation and dependency internal was fully security-audited. This is a targeted sensitive-path review with partial repository coverage, not exhaustive certification. |
| Hosted HTTPS and Docker runtime | Deployment | Needs follow-up | Local compiled server/MySQL/browser verified. Docker unavailable and public deployment prohibited; actual TLS reverse-proxy integration and hosted backup operations remain unexecuted. |
| Portable authentication and invitation boundary | Authentication | No issue found | Reviewed server/auth.ts, context, cookies, trpc and startup. Replaced active legacy OAuth/JWT route with hashed opaque revocable sessions, scrypt and email-bound HMAC invitations. Registration role is fixed to user. Source and real-MySQL credential/session/expiry tests verified; placeholder invitation secret rejected. |
| Cart, orders, addresses and notification ownership | Authorization | No issue found | Baseline had public appointment reads, JS && cart predicate and ID-only notification mutations. Clinical APIs now fail closed; cart SQL and notification writes include acting user; cross-user negative tests verified against actual MySQL. |
| Inventory, checkout idempotency and cancellation | Business logic | No issue found | Reviewed commerce.ts and commerce-rules.ts. User/product locks, integer cents, current prescription/expiry validation, expected basket fingerprint, unique user/key and atomic order/items/stock/cart/notification transaction. Real concurrent checkout, duplicate replay, adapter fault rollback and repeated cancellation tests passed. |
| HTTP request and browser boundary | CSRF and exposure | No issue found | Reviewed app.ts/http-security.ts/static/vite/systemRouter. Exact-origin JSON writes, batch/auth limits, security headers, redacted logs, body cap, loopback default and Vite host checks. Legacy OAuth callback and outbound notifyOwner are disabled. Actual Express HTTP negative tests passed. |
| Medical and prescription services | Sensitive health data | No issue found | All doctor, appointment, prescription and reminder procedures use fail-closed medicalProcedure before legacy handlers. Restricted products blocked in cart and locked checkout. No real patient information, payment or dispensing integration exercised. |
| Checkout recovery and key preservation | Client/server consistency | No issue found | Independent review identified a definitive-rejection recovery trap. Reproduced whitespace-name rejection in actual browser, added reset for BAD_REQUEST/NOT_FOUND/FORBIDDEN/CONFLICT while preserving keys after ambiguous failures; browser verified correction followed by successful order. |
| Migration and local operator tooling | Persistent data integrity | No issue found | Reviewed schema, additive migration, preflight and seed/admin/invite scripts. Actual fresh migrations applied. A duplicate legacy cart fixture exposed Windows lowercase table-name handling; corrected and verified preflight exit1 retaining both rows. Actual dump/restore retained the fictional 8.50 JD confirmed order. |
| Inactive provider helpers | External services | Not applicable | Baseline auditor traced storage, LLM, maps, image, voice and data helpers; no active customer route invokes these. Legacy source is retained. No cloud keys or live provider calls used. |

## Open Questions And Follow Up

- Verify deployment through the actual HTTPS reverse proxy before admitting testers.
- Complete a broader source security review of unused UI/support code before expanding Beta scope.
- Generic UI/support and unused pages were not all fully source-audited.
  - Follow-up prompt: Review deferred unit unreviewed-support-code and close its stated proof gap. Paths: client/src/components/ui, client/src/pages/ComponentShowcase.tsx, client/src/pages/AdminPanel.tsx.
- No Docker runtime or authorized hosted HTTPS deployment was available for runtime verification.
  - Follow-up prompt: Review deferred unit hosted-deployment-runtime and close its stated proof gap. Paths: Dockerfile, compose.yaml.
