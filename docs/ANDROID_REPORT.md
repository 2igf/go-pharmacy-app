# GO Pharmacy Android implementation and verification

Delivery date: 2026-10-27 (Asia/Amman). Local debug candidate; no public deployment, remote push, merge or Play upload.

## Result and provenance

The existing MVP interface is packaged inside an Android application, with no external website URL. The source is the completed MVP commit `943498797d8adc11af7fde0fb9f681df1021857c`, not the old GitHub main. A separate clone is on `feat/android-capacitor-debug`; the original MVP checkout remains clean at its original commit. The final Android commit and APK hash are recorded in the delivery manifest outside the checkout.

An actual signed Debug APK was built successfully with the installed Windows/Android toolchain. Package `com.gopharmacy.beta`, label GO Pharmacy, version `1.0.0-beta.1` (code 1), minSdk 24 / Android 7.0, target/compile SDK 36. The APK is a development artifact and is not release-signed for distribution through Play.

**Connected phone login/orders are not currently available:** the existing demo backend is loopback-only HTTP at 127.0.0.1:3017. A device-reachable trusted HTTPS backend using this branch and `ANDROID_API_ENABLED=true` is required. The APK intentionally starts with an Arabic connection setup screen when that endpoint is absent. No hosted address or successful phone authentication is invented.

## Toolchain actually inspected and used

| Tool | Evidence/selection |
| --- | --- |
| Node | 24.22.1 |
| pnpm | Project-pinned 10.34.5 used via npx; PATH fallback was 11.25.0 and was not changed globally |
| Android Studio | Installed 2025.1.4 at Android Studio and 2026.2.1 at Android Studio1; newer IDE satisfies the Capacitor 8 IDE floor |
| Java | PATH Oracle Java21.0.11; selected JDK21.0.8 from the installed older Studio/jbr; newer Studio bundles JDK25, which is not selected for Gradle8.13 |
| Capacitor | core/android/cli pinned exactly to stable npm 8.5.3; 8.5.4 was nightly-only at verification and was not selected |
| Android SDK | The saved SDK directory was missing. User explicitly approved SDK agreement/download; official tools installed under task-local work/android/sdk |
| Command-line tools / ADB | Command-line tools22.0; platform-tools37.0.1 |
| Platform / Build Tools | Android36 revision2, Build Tools36.0.0 installed; AGP also installed its default Build Tools35.0.0, which it uses |
| AGP / Gradle | AGP8.13.0; existing complete cached Gradle8.13 selected after official compatibility check; wrapper pins published SHA-256 |
| Emulator | 37.2.12.0; `-accel-check` returned 0 and WHPX installed/usable |

Google command-line tools archive matched published SHA-256 `90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a`. No system-wide Java/SDK variables, Windows optional features or existing AVDs were changed. New Gradle8.14.3 downloads were slow/stalled; the supported installed8.13 distribution was used instead. Google documents Gradle8.13 as the minimum/default for AGP8.13.0. The actual wrapper/build verifies the selected combination, rather than inferring success from installed software.

## Important implementation changes

| Files | Responsibility |
| --- | --- |
| capacitor.config.ts; package.json; pnpm-lock.yaml | Local Vite asset packaging, stable dependency pins and Android commands |
| shared/native-api.ts | Canonical HTTPS-only server origin validation and same-server tRPC destination restriction |
| client/src/lib/api-fetch.ts; main.tsx | Explicit CapacitorHttp adapter, native cookie transport, bounded timeouts, no redirects, response cookie-header filtering; web fetch behavior retained |
| NativeConnectionGate.tsx | Arabic endpoint setup, current-server display and public origin persistence only |
| checkout-policy.ts; Checkout.tsx | Native pending checkout keys scoped to backend origin and user; preserve ambiguous requests when switching away/back |
| server/http-security.ts; .env.example | Explicit HTTPS-only native request opt-in; existing authentication/roles/ownership/JSON/CSRF rules retained |
| client/index.html; index.css | Arabic viewport and Capacitor system-bar safe-area support |
| scripts/prepare-android-assets.ts; build-android.ps1 | Restrictive packaged-content CSP and reproducible local SDK/JDK/app build |
| android/ | Native app, Gradle wrapper, manifest, green/white pill vector/adaptive/monochrome icon and splash theme, RTL, keyboard resize, cleartext/backup/transfer restrictions |
| server/native-*.test.ts; http-security.test.ts | URL/transport/origin/real-session/database and pending-checkout isolation regression checks |
| android/app/src/androidTest/.../PackagedAppTest.java | Installed-package identity, network/backup/RTL and bundled-assets/config checks; replaces incorrect generated example test |
| docs/ANDROID.md | Studio, rebuild, installation, backend and network instructions |

The review found a cross-server pending-checkout scope defect (numeric IDs can repeat between databases). A regression test failed before correction, then passed. Independent follow-up inspection confirmed read/write/reset/success cleanup all use the origin-scoped key. It also found no other concrete blocker in the reviewed native transport and configuration paths; this is a focused static review, not an exhaustive security certification.

## Security boundaries

No database URL, invitation secret, password or API key is included in the APK. Only a public HTTPS origin may be configured. The same server-side salted passwords, opaque hashed sessions, expiry/logout, role and user ownership checks are retained. The native transport declares `https://localhost` as its bundled UI origin and `X-Go-Pharmacy-Client: android`; these do not establish identity. The server requires explicit opt-in and actual HTTPS or a correctly configured explicitly trusted TLS proxy. No CORS permission is added, cookies stay HttpOnly/Secure/Lax, and no localStorage session token is introduced.

Capacitor's native bridge is privileged; only the bundled trusted scripts should run. Remote navigation is not enabled. Native logging is disabled even in Debug because the installed vendor cookie helper otherwise logs cookie values. The adapter removes Set-Cookie from the Response given to React/tRPC. Cleartext/mixed traffic, WebView debugging and backups are disabled. Explicit Android12+ data extraction rules exclude all cloud/transfer domains as well. No certificate-error override, self-signed trust exception, authentication bypass or runtime secret is added.

## Verification actually performed

| Check | Result |
| --- | --- |
| URL/native HTTP boundary RED | Missing policy and native request path failed as expected before implementation |
| Native response-header RED/GREEN | Cookie header regression failed first, then four transport tests passed |
| Origin-scoped pending checkout RED/GREEN | Two failures before implementation; two passes after correction |
| `npm test` with guarded actual MySQL | **91 passed, 0 failed, 0 skipped; 18 files** |
| `npm run check` | Exit0 |
| `npm run test:types` | Exit0, including operator scripts and capacitor.config.ts |
| `npm run build` | Exit0; React production bundle and Express server bundle |
| `npm run android:sync` | Exit0; local assets plus CSP copied into Android project |
| build-android.ps1 / wrapper `:app:assembleDebug` | Exit0; actual APK produced, including latest origin-scoped checkout UI |
| wrapper `:app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest` | Exit0; lint **0 errors, 15 warnings** and test APK assembled |
| `apksigner verify --verbose --print-certs` | Valid Android Debug signer, APK Signature Scheme v2 |
| `aapt2 dump badging` | Correct ID/name/version/min24/target36; INTERNET plus AndroidX internal signature receiver permission |
| APK ZIP/config/private fixture checks | Bundled assets present; no remote server.url/cleartext/mixed content; logging none; no exact private fixture secret found |
| Read-only demonstration DB after tests | Order1 still8.50/confirmed and order2 still4.25/pending, both simulated |
| Dependency audit | Exit1; **0 critical, 0 high, 3 moderate, 3 low** occurrences |

The first Android lint run exposed an unescaped Windows SDK path in the generated ignored local.properties. The path writer was corrected rather than disabling the check. The same review added explicit Android12+ backup/transfer exclusions and monochrome adaptive icons. Final native verification was rerun successfully. The remaining lint warnings concern newer versions and unused/inherited template resources, including template splash image density; they were not suppressed or misrepresented as zero warnings. Production web build retains a nonfatal bundle-size advisory.

The extra moderate dependency occurrence relative to the MVP lockfile is `@capacitor/cli > xcode > uuid`, an iOS project helper not packaged into the Android runtime. Other occurrences are the already documented Drizzle tooling esbuild, unused Mermaid/Streamdown uuid/KaTeX and inactive S3 Smithy path. No broad major-version override was used merely to force an audit exit0. See the saved Android audit and previous MVP dependency review for exact paths.

## Emulator and physical-device status

Pending: official Android36 Google APIs x86_64 image download and dedicated isolated AVD smoke/instrumentation validation. Update this section only after execution. No physical phone has been tested. No externally hosted HTTPS native registration/login/checkout flow has been tested.

## Delivery and next action

Use the APK, source checkout, report and SHA-256 manifest under outputs. Follow ANDROID.md to open the android folder in the installed newer Studio and select JDK21. Provide a reachable trusted HTTPS backend and enable the documented native boundary before inviting phone participants. No database migration is added for Android; keep existing MySQL private and retain the existing backup/migration procedures. Orders remain fictional simulations only.
