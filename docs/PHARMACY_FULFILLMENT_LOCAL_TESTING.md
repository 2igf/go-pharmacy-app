# Controlled local fulfillment testing

Workspace: C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-foundation
Branch: feat/pharmacy-order-fulfillment-v1; source d6196e21691edefb25bb5ea158197f4af474ad45.

- Admin: http://localhost:3022/admin/fulfillment
- Pharmacy: http://localhost:3022/partners/pharmacy/orders?org=95
- Existing customer: http://localhost:3022/order/187
- Login/account switch: http://localhost:3022/login

The private .local/fulfillment/start.mjs launches the production-built web assets/backend
in NODE_ENV=test on loopback3022 against go_pharmacy_test. Flag enabled in this process only.
Use `node .local/fulfillment/start.mjs` from the project after checking the recorded PID/
command line in server-state.json; do not run a second instance. Rebuild with the pinned
pnpm build script before restarting after source changes. No public HTTPS endpoint was
added. This HTTP origin is a local web test, never a substitute for phone HTTPS.

Existing fictional test accounts/passwords are privately stored in
.local/partners/browser-users.json (not committed). Admin27 governs assignment;
staffA30 operates org95, ownerB29 operates96, viewer31 is read-only, customer32 owns the
new orders and suspendedMember34 has no operational access. Do not use real accounts.
The private launcher/credential files are prepared workspace artifacts, not included in
a fresh clone and not production provisioning instructions.

Browser fixtures: new fictional non-medication product18, quantity20 in pharmacy95 and5
in96 before actions. Four new customer simulation orders186..189, quantity2 each. Actual
browser acceptance left187 ready/version4 and186 rejected/version2, both assigned only95.
95 available stock18/version4;96 remains5/version1. Orders188/189 are un-enrolled and can
be used for a fresh manual test. No historical order was automatically enrolled.

Manual path:
1. Login as admin, select188, enter an enrollment reason, review/confirm. It becomes
   assignment_pending. Choose an eligible pharmacy, give reason, review/confirm reservation.
2. Login as the matching staff/owner, open the assigned order. Accept, prepare and ready
   each require a reason and reviewed version. Audit history shows the actual account/time.
3. With a second order, reject from assigned; reserved units return. No reassignment in V1.
   Admin cancellation uses the existing admin order interface; managed confirmation or
   premature shipment is rejected by the backend. Rejection alone leaves order.pending
   until that explicit cancellation, preserving the separate central simulation ledger.
4. Check ownerB/foreignorg, viewer, customer and suspendedMember. They must not receive
   unauthorized private order data/actions. Customer orders APIs expose the safe summary,
   while the unchanged customer screen renders existing order.status.
5. If a network response is ambiguous, retry the exact retained request. After navigation/
   reload, refresh state before reviewing a new operation. Never turn off protections to
   force a transition. Stock-return overflow deliberately requires reconciliation.

Automated verification uses Node24, pinned pnpm10.34.5, existing `test`, `check`,
`test:types`, `build` scripts, and an authorized test database migrated through0005.
**Existing integration fixtures reset the dedicated test DB.** Stop writers and preserve
the entire populated test DB with a verified backup/restore process first, or use a fresh
authorized disposable DB. Do not run raw tests against Demo or unpreserved browser fixtures.
This task backed up/restored test rows and counters twice and preserved browser state.

Android was rebuilt locally using installed SDK/API36, Capacitor8.5.3 and Gradle8.13.
No phone/emulator test or APK publication occurred. **Checkout validation remains OPEN.**
