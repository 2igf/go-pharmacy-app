# Reproduce and verify Android Checkout locally

Project: C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-foundation
Branch: fix/android-checkout-e2e-v1. Only fictional data and authorized test DB.

## Delivered artifacts

- Normal installable Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Isolated emulator fixture APK: `android/app/build/outputs/apk/checkoutTest/app-checkoutTest.apk`.
- Its instrumentation APK: `android/app/build/outputs/apk/androidTest/checkoutTest/app-checkoutTest-androidTest.apk`.
- Normal package tests: `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`.

Use the **normal Debug APK** for a manual phone update with the existing signing key.
Do not uninstall/clear existing application data just to install an update. The special
checkoutTest APK/CA is only for the local emulator fixture; do not distribute it as the
phone application. The phone needs its existing reachable, trusted HTTPS API origin.
No real-phone test or current hosted-service upgrade is implied.

## Prepared local manual workflow

1. Open http://localhost:3022/login. The web runtime uses go_pharmacy_test. Existing
   private fictional accounts/passwords are in `.local/partners/browser-users.json`;
   do not print/share passwords. Browser customer is ownerB29 (personal customer role
   alongside its unrelated pharmacy membership), native customer32, admin27, staffA30.
2. As customer, add a fictional address at /profile. Add product19 (`DEMO اختبار Android
   Checkout`, medical supplies, simulated price0.10) from its existing product page.
3. Open cart, then Checkout. Select the owned address; enter a fictional name and Arabic
   or Persian phone digits. Confirm simulation acknowledgment. Letters in the phone
   field must produce an Arabic error naming رقم الاختبار. Correct input creates a
   single SIM- order; note its numeric ID and do not repeatedly start new requests.
4. As admin, open /admin/fulfillment. Explicitly enroll that ID with a reason, then select
   an eligible pharmacy (fixture95), enter reason, review/confirm assignment.
5. As staffA, open /partners/pharmacy/orders?org=95 and the exact ID. Accept, prepare and
   ready require separate reasons/reviews. Inventory is reserved at assignment only.
6. Return as the original customer to /order/ID. The existing order.status is processing
   and the new Arabic fulfillment line says جاهز للتوصيل التجريبي with the pharmacy name.
   A different account must receive ownership rejection without cached item/address data.

Prepared examples: browser194 and native195 are ready. Diagnostic orders192/193 are
distinct unassigned simulations retained from harness attempts. No historical order was
automatically enrolled. Check evidence/preservation-final.json for actual retained state.

## Rebuild ordinary APK / Android Studio

Open the project's `android` directory in Android Studio. Use installed API36 SDK and
JDK21; do not casually update Gradle/AGP/dependencies. Existing build script:

```powershell
./scripts/build-android.ps1 -SdkPath 'C:/Users/Issax/Documents/Codex/2026-10-26/files-pasted-by-the-user-go/work/android/sdk' -JavaPath 'C:/Program Files/Java/jdk-21.0.11'
```

The normal Debug APK has no test CA, external website URL, certificate override, native
cookie logging or cleartext permission. Its bundled React assets match the tested
checkoutTest assets; that variant changes the app ID and narrowly scoped test trust.

## Emulator fixture reproduction

The workspace has private, short-lived TLS fixtures and scripts under `.local/checkout`.
They are excluded from Git/Docker and are not production hosting/provisioning tools.
They use normal existing passwords and session APIs; no identity or TLS bypass exists.

1. Start the task AVD GO_Pharmacy_Beta_API36 on emulator-5580. It is Android16/API36.
   Existing AVD metadata in the user's .android directory points to the task-local data.
   Do not wipe AVD data or clear the original com.gopharmacy.beta package.
2. Generate a local test CA and valid server certificate with IP SAN10.0.2.2, and a
   separate wrong-host certificate for the negative test. Keep keys/passwords private.
   The prepared `tls.mjs` generated a7-day CA/5-day server certificate. Regenerate after
   expiry; never disable validation. Only the public certificate resource directory
   `.local/checkout/tls/android/raw` is passed to the explicit test build variant.
3. Start private `start-tls.mjs`: direct HTTPS on host127.0.0.1:3443, wrong-host3444,
   ANDROID_API_ENABLED=true, APP_ORIGIN=https://10.0.2.2:3443, TRUST_PROXY empty,
   SIMULATED_FULFILLMENT_ENABLED=true and the test DB only. No Windows/system CA change.
4. Build from android with JDK21:

```powershell
./gradlew.bat --no-daemon -PcheckoutTestCaDir=../.local/checkout/tls/android :app:assembleCheckoutTest :app:assembleCheckoutTestAndroidTest
```

5. Private fixture JSON goes only into the isolated target app's private files via ADB.
   It contains apiOrigin, organizationId, productId/productName and fictional customer/
   admin/staff login details. Credentials are not bundled, passed in command-line test
   arguments or printed. The private `android-test.mjs journey` installs both test APKs,
   clears **only the separately created checkouttest package**, loads the fixture, arms
   a one-shot response-loss marker before the test, and runs CheckoutJourneyTest.
6. The fixture server drops one successful orders.create response after real commit;
   the UI retries the same saved key. The test then completes all admin/staff/customer
   steps and a same-document cache/ownership regression. Report contains booleans/IDs
   only; screenshots contain fictional data. No tokens are exported from the native app.
7. Run ordinary Debug PackagedAppTest separately. It checks network/backup/RTL/assets,
   logging policy and absence of the test CA. CheckoutJourneyTest is fixture-only and
   intentionally skips if someone runs it against the ordinary package.

Stop only these private test runtimes when finished, using recorded PID and command-line
checks. Never stop/reconfigure the3018 phone HTTPS backend, tunnel,3017 app or MySQL.
The local HTTPS origin is not a new phone hosting address.

## Vitest, types and build

Use project-pinned pnpm10.34.5 /Node24 for `test`, `check`, `test:types` and `build`.
Existing integration tests reset their guarded dedicated DB. Stop its writers and take
a verified full private backup/restore snapshot first, or use a fresh authorized test
database. Never use the Demo URL. Prepared baseline and final verification preserved
all original rows and restored the complete browser/native fixture state after testing.
