# Android Checkout fix and end-to-end validation

Source eb4a97961f05dc912eaae897a88bff05bb4e3f02; branch fix/android-checkout-e2e-v1.
Use systematic debugging, test-first correction, and a focused final independent review.

- [x] Preserve existing28-table test DB and Demo fingerprints; run161-test baseline and restore original138 rows.
- [x] Add privacy-safe checkout validation field/code diagnostics; reproduce actual rejected field through packaged React in Android WebView before fixing it. Hypothesis: Arabic phone numerals fail ASCII-only regex; HTML pattern may be invalid under Unicode-v.
- [x] Use a separately identified checkoutTest APK (conditional build type, .checkouttest suffix) with a task-local test CA limited to emulator host10.0.2.2. No CA/private key in ordinary debug/release APK; no device/system trust edits, no SSL verifier override, no HTTP/native bypass, no public tunnel or existing phone-service change. HTTPS directly terminates in a private loopback test server with existing native auth guards and no trusted proxy.
- [x] Add regression cases for the reproduced defect and safe Arabic field messages. Share the checkout contract/normalization only where needed; preserve server validation, prices, cart fingerprint, idempotency and transaction code. Validate persisted pending drafts and preserve ambiguous requests.
- [x] Add a minimal fulfillment status line to existing customer tracking; no layout redesign. Test complete browser and Android WebView journeys with fictional customer/address/product/order, explicit admin assignment, staff accept/prepare/ready, and customer visibility.
- [x] Test response loss/retry against actual backend and prove one order/reservation. Exercise certificate rejection, packaged network policy, and absence of credentials in diagnostics/assets. No physical phone currently attached; report that limit unless one becomes accessible.
- [x] Run full Vitest, both TypeScript checks, production/Debug/checkoutTest builds and emulator instrumentation. Preserve test fixtures before reset-based regressions, restore and verify all originals.
- [x] Document root cause, exact evidence, local TLS test setup, accounting separation/future reconciliation, test steps and APK paths. Review, commit locally, no main/merge/push/deployment.

No migrations, pricing changes, real sales/payments, medical activation, Captain app or stock-accounting redesign.

Final evidence: baseline161/28 files; full168/31 files zero failed/skipped; both TypeScript checks/build exit0; Debug/test builds successful; normal Package tests2 passed; final full native journey1 passed (45.523s), browser194 and emulator195 ready. Physical device not attached/tested.
Original138 rows and18 Demo fingerprints preserved. Full28-table/237-row UI snapshot restored after regression. Six distinct diagnostic orders retained; each assigned order has exactly one reservation/audit; no duplicate customer/key rows.
Review P1 cached foreign-order display: two RED/GREEN cases, owner/error guard and real same-document WebView account-switch404 verified. Test harness option/frame synchronization corrected without application bypasses.
