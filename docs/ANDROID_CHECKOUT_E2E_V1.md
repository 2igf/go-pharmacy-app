# Android Checkout Fix & End-to-End Validation V1

Date:2026-10-28 (Asia/Amman). Source eb4a97961f05dc912eaae897a88bff05bb4e3f02,
branch fix/android-checkout-e2e-v1. Controlled fictional-data testing, no deployment.

## Reproduced cause

The actual packaged React Checkout ran on Android16/API36 emulator-5580, using
Android System WebView133.0.6943.137 and CapacitorHttp against direct local HTTPS.
It authenticated a fictional customer, created an Arabic fictional address through
the actual profile form, added fictional product19 and submitted Arabic phone digits.

The original UI accepted the input, but the backend returned400. Privacy-safe
diagnostics identified **contactPhone / invalid_format**, not addressId, contactName,
expectedTotal or cart fingerprint. No phone/name/address/request/token was logged.
Evidence: android-reproduce.txt/json, rejected-field.jsonl and checkout-before.png.
The expected-rejection reproduction test passed; it did not claim checkout success.

Two cooperating defects:
1. Server phone regex admitted ASCII0-9 only; Arabic-Indic٠..٩ and Persian۰..۹ were rejected.
2. HTML pattern `[+0-9 ()-]{6,30}` contains punctuation that must be escaped in
   Unicode-v character classes. The actual WebView considered the field valid because
   the malformed pattern was ignored, then the server rejected it with a generic message.

The old physical-device payload was not available. This report identifies the exact
field/cause reproduced on the supported Android test environment, not an inspection
of an unavailable phone request.

## Minimal correction

shared/checkout.ts extracts the existing strict Zod checkout contract. Only Arabic/
Persian numeral characters are converted to their ASCII equivalents; **existing ASCII
phone bytes, punctuation and spaces remain unchanged**, preserving prior request hashes.
All other fields, cash-only simulation acknowledgment, totals and fingerprints retain
their old validation. No price or transaction implementation was changed.

React uses the same schema before saving/submitting a request, and a valid Unicode-v
HTML pattern accepts the supported numeral sets. Arabic custom validity messages name
the phone/name/address field. Server Zod errors use an allowlisted Arabic field message
and validationFields; logs contain only an allowlisted field and Zod code.
Persisted pending requests are schema-validated, scoped by the existing origin/user key,
and keep their UUID. Invalid saved drafts are blocked with a history/review action;
ambiguous transport failures retain the valid request and key for explicit retry.

OrderTracking adds one fulfillment status/pharmacy line inside the existing customer
card. The independent reviewer found inherited retained-cache exposure on account
switch/refetch failure. A local owner/error guard now hides the article unless the
authenticated user matches order.userId and the query has no error. Server ownership
checks remain unchanged. Two RED/GREEN tests and actual same-document WebView login
switching verify that the old customer's item/address/status are hidden after404.

No Canva redesign, auth rewrite, API path change, migration or stock-accounting change.
The profile phone editor remains outside this checkout-specific normalization scope.

## Supported Android test environment

Ordinary Debug APK: com.gopharmacy.beta; existing system CA trust, cleartext disabled,
bundled assets, no server.url, no WebView debugging, no native cookie logging/backups.
No existing phone HTTPS process/configuration/database was modified.

A conditional **checkoutTest** build variant has suffix `.checkouttest` and is created
only with explicit `-PcheckoutTestCaDir=...`. Its manifest overlay trusts a generated,
short-lived test CA **only for10.0.2.2**, the emulator's host-loopback alias. The server
binds127.0.0.1:3443 and terminates TLS directly. Existing native origin/client/cookie/
membership guards run unchanged; TRUST_PROXY is empty. It uses go_pharmacy_test only.

There is no SSL verifier override, cleartext fallback, public tunnel or system/user CA
installation. A wrong-host certificate signed by the test CA on3444 is actually rejected.
The public CA resource is external to source control; private TLS keys/passwords stay
under ignored .local/checkout/tls. The normal Debug APK contains no test CA/network
configuration. The checkoutTest APK is for this emulator fixture, not phone distribution.

References: [Android emulator networking](https://developer.android.com/studio/run/emulator-networking-address)
and [Android network security configuration](https://developer.android.com/privacy-and-security/security-config).

## Executed end-to-end journeys

**Final Android instrumentation:** CheckoutJourneyTest, one complete scenario, passed
in45.523s. Actual bundled WebView DOM interactions, actual Capacitor bridge, actual TLS,
password login/session cookies, real backend and MySQL. No mock identity/transport or
remote website navigation. It verifies:

- Invalid phone input produces an Arabic field-specific message; Arabic digits submit.
- A test-only response is dropped after the real checkout commits. Same-key retry
  recovers the order after the cart has cleared.
- Customer creates order195; admin explicitly enrolls and assigns95; staff accepts,
  prepares and marks ready; customer sees ready status and pharmacy identity.
- Same-document switch to another account preserves the cache for the regression check:
  the real backend rejects ownership and the UI does not show cached private details.
- Wrong-host TLS certificate is rejected. Native screenshots include the rendered ready
  customer view and pharmacy history. Screenshots wait for a committed visual frame.

**Browser:** independent fictional customer29 created an address/cart and order194 with
Persian numerals. Admin27 explicitly enrolled/assigned95, staff30 accepted/prepared/ready,
and customer29 saw the new fulfillment line. Six recorded observations are in browser-
checks.json; these are actual manual browser automation observations, not six independent
Vitest/E2E test cases. Native customer32 and browser customer29 used separate carts.

Earlier native diagnostic attempts are retained honestly: the first setup had an empty
fixture transfer, one cold-boot System UI ANR obscured capture, a manually started rerun
missed its response-loss marker, and a selector acted before async options loaded.
Fixture transfer/fault arming and selector/frame synchronization were corrected in the
test harness, not by weakening application checks. Final full scenario passed with a
normal rendered customer screenshot. Diagnostic-created fictional pending orders192/193
were retained; they are distinct requests, not duplicate replays, and were not auto-assigned.

Physical device: none attached in ADB; **not tested on a physical phone**. API36/WebView133
is the verified environment, not a claim of every Android version/device.

## Regression and artifact evidence

Baseline161 passed /28 files. The new four contract cases, one real authenticated HTTP/
MySQL scenario and two cache-visibility cases are added to the full suite. Final results
are recorded in tests.txt, typescript.txt, test-typescript.txt, build.txt and the native
logs; do not infer pass counts from this description when rerunning.

Final executed results: **168 passed /31 files, zero failed/skipped**; application and
test TypeScript checks exit0; production build exit0; normal Debug and isolated test
APK builds successful; ordinary PackagedAppTest **2 passed**. The final complete
CheckoutJourneyTest **1 passed**, with all reported milestones true. Normal APK signature
verification passed and all eight packaged JS/CSS assets match the production build.
Archive inspection and installed-package tests confirm no test CA/network config in
the normal Debug APK. Physical-device testing remains unexecuted.

New HTTP regression verifies normalized Arabic/ASCII replay equivalence, one persisted
order/stock decrement, changed-payload conflict, field-specific Arabic error and absence
of rejected values in responses/diagnostics. Existing fulfillment concurrency, tenant
isolation, cancellation, auth, price and medical shutdown cases remain in the suite.

Full test fixture resets are guarded to go_pharmacy_test. Pre-task28 tables/138 rows
were backed up privately and restored after baseline. Before final regression, all28
tables/237 rows including browser/native work were backed up again for verified restore.
No original customer/product/order is deleted; original row and Demo fingerprint checks
are recorded in preservation-final.json. No migration or DDL change was required.

Final read-only proof preserved all138 original rows and all18 Demo table fingerprints.
New product19 has central stock14 after six distinct test orders; pharmacy95 available
stock6 after four assignments. Each assigned order has one reservation and one assignment
audit event; duplicate customer/idempotency-key count is zero. These distinct ledgers
were verified separately, not treated as a reconciled physical total.

Important code: shared/checkout.ts, server/domains/shopping.ts, server/_core/trpc.ts,
client/src/pages/Checkout.tsx, OrderTracking.tsx and client/src/lib/checkout-policy.ts.
Android build/test fixture files and three new Vitest files cover the change.
Full list: evidence/checkout/modified-files.txt.

## Scope of acceptance and remaining limits

The reproduced checkout failure is fixed and the complete simulated journey is verified
on the supported emulator stack. Physical-phone acceptance remains unverified. Ordinary
APK sends canonical ASCII digits and remains compatible with the existing checkout API,
but the older phone HTTPS backend was not upgraded/migrated for pharmacy fulfillment.
Do not infer that its current deployment exposes this branch's fulfillment APIs/status.

No real sale, payment, medication dispensing, medical activation, driver workflow, public
deployment, main change, branch merge or Android publication occurred. No dependency,
SDK/Gradle version or global trust/environment configuration was changed. Existing build
size/clearCookie/Gradle advisories remain. No fresh dependency audit was performed.

Accounting separation and reconciliation requirements:
[SIMULATED_INVENTORY_RECONCILIATION.md](SIMULATED_INVENTORY_RECONCILIATION.md).
Step-by-step procedure and APK paths:
[ANDROID_CHECKOUT_TESTING.md](ANDROID_CHECKOUT_TESTING.md).
