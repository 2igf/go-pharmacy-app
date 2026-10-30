# GO Pharmacy Customer Experience V2 — implementation and verified limits

Date: 2026-10-30. Branch: `feat/go-pharmacy-customer-experience-v2`.
Verified base: `1b8a82eb50d08911dbd2ee3fd2758d9d95cb786a`, containing the previous checkout, multi-app, tenancy, Partners, fulfillment and Capacitor work. The delivery commit is the commit containing this report; obtain its exact hash with `git log -1 --format=%H` on this branch. Nothing was merged, pushed, published or deployed. This is a controlled simulated-testing release, not commercial pharmacy readiness.

## Implemented customer features

### Account access

Public registration no longer requires an invitation. The server persists only platform `user` (customer), rejects supplied privilege/identity/verification fields and checks credentials plus legacy users before registration. Legacy invitation records and optional old-client invitation input remain compatible. Public admission does not grant organization membership, professional approval or administrator access. Email state is explicitly **unverified**, not falsely verified.

Shared Arabic/English validation supports Jordan/international phone formats and Arabic/Persian digits. Existing scrypt password hashing and opaque sessions remain. Additional bounded identity/IP limits use the existing trusted-proxy boundary. Missing account and incorrect credentials intentionally share an error to prevent enumeration; connectivity, unavailable server, expired session and validation have separate safe feedback.

Recovery uses a random 256-bit token, SHA-256 storage, 15-minute expiry, single-use credential-row transactions and revocation of account sessions and other recovery tokens. Concurrent login/reset cannot issue a stale-password session. Fixed-origin links use a consumed/removed fragment; the Android bundled UI also accepts the code manually. No arbitrary redirect or deep-link intent was enabled.

**No real email provider was configured and no real recovery email was sent.** The real Resend provider interface needs `RESEND_API_KEY`, verified `CUSTOMER_RESET_EMAIL_FROM` and trusted HTTPS `RESET_WEB_ORIGIN`. An encrypted, non-public development mail sink is restricted to fictional `example.test` recipients. Its protocol and native form can be tested independently; this does not recover the user's Gmail account. See [customer access configuration](customer-access-v2.md).

Native cancellation errors cannot prevent server logout/cache cleanup. Login/signup clear a previous native account before mutation. A completed password reset reports its committed outcome even if subsequent local cleanup fails. Origin changes fail closed until local cancellation succeeds. A browser-reproduced previous-profile draft leak after Logout/Back was fixed with authenticated rendering, owner-bound drafts and history-restoration query invalidation; actual browser account-switch retesting passed.

### Canva, banners and original logo

All four earlier references plus the five additional supplied images were inspected and retained with source hashes. Customer six-item navigation remains: الرئيسية، البحث، العربة، اسأل طبيب، منبه الدواء، الملف الشخصي. The new doctors/clinics preview uses the supplied crops and truthful unavailable actions; no names, fees, ratings or bookings are presented as verified live medical services.

The carousel supports RTL swipe, approximately five-second advancement, manual indicators, destinations, interaction reset and reduced motion. Only **one distinct approved promotional artwork** is available (Dozova); production configuration does not duplicate it to imply multiple offers. Multi-slide autoplay/swipe behavior has automated fixture coverage, while the actual configured UI shows one actionable artwork. Additional approved banner artwork is still needed to demonstrate a live multi-offer carousel.

The uploaded `1000073150.jpg` (1280×1280) is the direct launcher source. Resampling and restrained sharpening preserve the green / white rounded square / black GO / handwritten pharmacy composition. Five launcher, round and adaptive-foreground densities, adaptive XML/background, portrait/landscape splash assets and splash branding were generated. Package, app name and signing identity remain unchanged. The actual emulator app drawer shows both ordinary and isolated test packages with this logo; two icons are QA variants, not duplicate installations of one package. See [source/asset manifest](design/canva-v2/asset-manifest.json), [source comparison](evidence/v2/launcher-source-comparison.png) and [actual Android launcher](evidence/v2/v2-native-launcher-icon.png).

**Visual fidelity is measured, not pixel-perfect.** [18 comparison boards](evidence/v2/comparisons/README.md) cover Login/Home/Discovery/Doctors/Cart at 360, 393 and 430px and all earlier references. The original Canva font/vector exports are absent; type weight, metrics and antialiasing differ. Live fictional catalog content has fewer/different product images than Canva; no prices, stock or medical claims were fabricated. Safety notes add vertical space, the knowledge link changes Discovery's lower scroll position and Cart data differs from the three sample reference lines. The original JPG logo/crops retain compression softness. Original Canva font files and image/vector exports are the useful next visual assets.

### Manual medication reminders

Authenticated customer-owned definitions persist on MySQL independently of the local installation. List/add/detail/edit, multiple daily times, weekdays, start/end, optional user-entered dosage/notes, pause/resume, confirmed deletion and explicit Taken/Skipped history are operational. Definitions are limited to 20 enabled/100 total; writes use owner predicates, row locks, versions and request IDs. Events are labeled user-reported, never medically verified ingestion. No dose/schedule recommendation or missed-dose rescheduling exists.

An app-owned Capacitor `GoReminders` bridge uses Android inexact alarms, one future alarm per definition and encrypted minimal no-backup storage under the Android Keystore. No new dependency or exact-alarm/battery-exemption permission was added. Non-exported receivers restore future schedules for boot/time/timezone/package events. Stable account-scoped IDs, validated immutable notification intents and cancellation prevent stale account schedules/opens. Discreet generic notification text is default; dosage/notes/session secrets are not stored in the native schedule.

| Scenario | Actual behavior and verification limit |
| --- | --- |
| Permission denied | Definitions remain on server/encrypted device cache; no permitted notification schedule is claimed. UI offers an explicit permission request. Native denied/granted paths and actual permission dialog were exercised. |
| Background / normal process closure | Real AlarmManager→receiver→notification observed, including after `am kill` with process absent. Inexact delivery exceeded an early observation window; later system notification and next recurrence were verified. |
| Reboot | Actual emulator reboot/unlock restored the future plan and delivered a generic notification. Android deferred BOOT handling beyond the initial 20-second poll; later positive inspection is separately recorded. No exact boot-restoration deadline is promised. |
| Force-stop | Android blocks background delivery until the user opens the app again. Future occurrences then resynchronize; no catch-up/taken event. This OS limitation is documented; no positive force-stopped-delivery claim is made. |
| Battery/Doze/OEM restrictions | May delay or suppress delivery. No uninterrupted or second-perfect guarantee; no privileged workaround. |
| Logout/account/origin switch | Cancel pending and delivered notifications and encrypted plan; fresh authorized queries recreate only the current account's plan. Offline native state cannot independently detect a remote revocation immediately. |
| Timezone/clock | Times follow the current device's wall clock; definitions retain timezone provenance. Actual emulator timezone and clock changes rescheduled one future alarm and were restored. DST gaps skip; overlaps choose the later offset once. |
| Reinstall | Native cache is removed. Retained server definitions resynchronize after sign-in/permission grant. No physical reinstall test or physical-phone guarantee is asserted. |

See [native contract and operating limits](android-reminders-v2.md) and [actual system notification](evidence/v2/v2-native-notification-drawer.png). Medication instructions remain those of the prescribing clinician or pharmacist.

### Medication knowledge foundation

Normalized source/batch/drug/name/ingredient/registration/label/fact/version structures are separate from marketplace products, official pricing and individual pharmacy stock. Unknown fields remain null. Public read-only search/detail show source identifiers, country scope, provenance and update dates. Administrative imports are bounded, permission-referenced, validated, deduplicated, idempotent and audited; rollback cannot overwrite a later version. Structured clinical/regulatory content remains draft; no publication/approval endpoint was invented.

The limited actual RxNorm import contains **161 acetaminophen (IN)** and **202433 Tylenol (BN)**, with sourced ingredient relationships. **Two international vocabulary records, zero verified Jordan registrations/prices.** Knowledge presence does not imply Jordan approval, prescription permission, stock or saleability. No automated Arabic medical translation was published. Public form/manufacturer/strength/label/image facts remain unknown unless sourced and allowed by review policy.

| Source | Findings and V2 integration |
| --- | --- |
| [RxNorm APIs](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html), [terms](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html) | Non-proprietary endpoints only, fixed HTTPS allowlist, no redirects, bounded response/timeouts, serialized requests below 20/s, 12-hour cache and required NLM attribution. Real two-record import executed; proprietary data excluded. |
| [JFDA official open-data metadata](https://opendata.gov.jo/api/3/action/package_show?id=drug-prices-838-2021) | Metadata API exists. Dataset is labeled 2021/Drug2020 with resource metadata updated 2025-07-16; current pricing/registration status is not established by that date. License metadata points incorrectly to Instagram; usable terms were not retrievable from the official license page during inspection. Automation pending current authoritative data and permission/license confirmation; authorized CSV/JSON draft import is implemented. |
| [DailyMed API](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm), [about](https://dailymed.nlm.nih.gov/dailymed/about-dailymed.cfm) | US structured label source investigated. Label presence does not guarantee FDA approval or Jordan applicability. No bulk import/automatic clinical publication or third-party media reuse. |
| [openFDA labels](https://open.fda.gov/apis/drug/label/), [terms](https://open.fda.gov/terms/) | US label metadata investigated, generally CC0 subject to third-party material. No current Jordan mapping or clinical decision claim; not imported in V2. |

See [source architecture/import policy](../server/medication-knowledge/README.md), [real import evidence](evidence/v2/knowledge-live.json) and [future Health Profile design only](future-health-profile.md). No unused health-history tables were created.

## Additive APIs and routes

- `auth.accountStatus`, `auth.requestPasswordReset`, `auth.resetPassword`; existing `auth.register` now supports public customers while retaining the legacy optional invite contract.
- `manualReminders.list/detail/create/update/remove/history/record` derive ownership from the session, never a caller-supplied customer role/ID.
- `medicationKnowledge.search/detail` are read-only public; `previewStructured/importStructured/importRxNorm/batches/rollback` require the persisted authorized administrative role.
- Customer routes: existing Login/Home/Products/Cart/Profile/Order tracking remain; `/forgot-password`, `/reset-password`, `/login?mode=reset`, `/doctors`, `/reminders`, `/reminders/new`, `/reminders/:id`, `/reminders/:id/edit`, `/medicines`, `/medicines/:id` are connected to the corresponding features. No seventh bottom-navigation item was introduced.
- Existing tenancy, inventory, fulfillment, customer order and administrative APIs retain their boundaries. Drivers/partners do not acquire customer reminder or recovery access.

## Database and recovery

| Migration | Additive change |
| --- | --- |
| `0006_customer_access.sql` | 2 account-admission/recovery tables |
| `0007_customer_reminders.sql` | 2 owner-owned definition/event tables |
| `0008_medication_knowledge.sql` | 9 normalized knowledge/provenance tables and fixed source registry |
| `0009_knowledge_facts.sql` | 1 nullable sourced-facts table; supported label-section enum extension |

Applied first to disposable `go_pharmacy_test_v2` (42 tables, migration journal 10 entries). Full destructive-fixture tests use **separate** `go_pharmacy_test_v2regression`; the staging browser/native evidence data is preserved. Original `go_pharmacy_test` (28 tables/314 rows) and `go_pharmacy_demo` (18 tables/33 rows) match all initial table/row fingerprints in [the final read-only preservation audit](evidence/v2/data-preservation-final.json). No source Demo migration was authorized or applied.

Before a different staging/real-data target: stop writes, create encrypted full backup including journal, verify restore into a separate database, review all four migrations and run preflight with exact `MIGRATION_EXPECTED_DATABASE`. Existing-data targets also require explicit `MIGRATION_DATA_APPROVAL` and `MIGRATION_BACKUP_VERIFIED` equal to that target. These acknowledgements are not permission to migrate the user's Demo database. Obtain authorization first. MySQL DDL is not transactional: partial/untracked table groups now stop preflight. On failure, retain evidence, stop writes and restore the verified backup into a new database for inspection; never drop customer/order tables or edit migration history to force success.

Central catalog reservation and pharmacy inventory remain distinct existing ledgers. Simulated checkout reserves central catalog stock; explicit fulfillment enrollment/assignment and pharmacy acceptance use the pharmacy reservation workflow. V2 does not reconcile them automatically. Future reconciliation needs a separately approved mapping/source-of-truth policy, transactional reservation/release events, refunds/cancellation semantics and migration/backfill reconciliation. Historical orders were not automatically assigned.

## Executed verification

| Check | Recorded result |
| --- | --- |
| Original baseline Vitest | 173 tests / 32 files passed on isolated clone |
| Final full Vitest | **284 / 284 passed, 44 files, 130.19 seconds**, dedicated regression MySQL. Covers public-role escalation, reset expiry/replay/concurrency, ownership, imports/rollback, inventory/fulfillment and client lifecycle regressions. [Log](evidence/v2/final-verified-full-regression.txt) |
| TypeScript | Production and test/script configurations passed `tsc --noEmit` and `tsc --noEmit -p tsconfig.tests.json`. |
| Web/server build | Vite production and esbuild succeeded in isolated output directories. Existing phone/old static directories were not overwritten. |
| Android assets / CSP / sync / build | Production bundled Android assets, Capacitor sync, ordinary Debug APK and isolated HTTPS checkout-test variant succeeded. Ordinary APK contains no test CA, remote-site `server.url`, mixed content or cleartext permission. |
| JVM recurrence | 11 tests, 0 failures/errors. |
| Android native scheduler | 9 instrumentation tests passed, including account cancellation, invalid inputs/replay and delayed-after-end-date delivery regression. |
| Actual timed delivery | 1 integration test passed (32.808 seconds), actual alarm receiver and system notification; separate normal-close/reboot/timezone/clock observations retained. |
| Native customer forms | 2 tests passed (26.722 seconds): no-invite signup/customer boundary, existing login/truthful recovery response, reminder CRUD/permission/pause/edit/delete-cancel/confirmation. Recovery completion has a separately recorded final UI test. |
| Native recovery completion | 1 test passed (7.472 seconds): actual reset form, recovered-password login and token replay rejection, using encrypted fictional development delivery. [Report](evidence/v2/v2-recovery-ui-report.json). No real email sent. |
| Installed ordinary package | 2 instrumentation checks passed: actual installed package/RTL/backup/TLS policy and bundled React/CSP/no remote navigation. [Log](evidence/v2/android-packaged-app.txt). |
| Native simulated fulfillment | 1 test passed (51.271 seconds), order **388**, Arabic checkout validation, response-loss retry recovery, pharmacy ready/customer visibility and foreign cached order hidden. [Report](evidence/v2/checkout-report.json) |
| Browser E2E | Actual UI journey order **387**, explicit admin enrollment/assignment→staff accept/prepare/ready→customer status; 360/393/430 layouts, six navigation items, reminder history, knowledge provenance, admin/Partners denial and post-logout privacy retest. [Report](evidence/v2/browser/browser-report.md) |
| Visual evidence | 18 side-by-side boards, all nine supplied raster references, source/crop/hash manifest and actual Android screenshots. Differences documented; no pixel-perfect claim. |
| APK integrity/signing | 46 bundled assets match build bytes; all five launcher densities match packaged pixels; private fixture/DB configuration absent. Certificate equals previous emulator-installed Debug APK. [Integrity](evidence/v2/apk-integrity.json), [signing](evidence/v2/apk-signature.json). |

Initial red tests, incomplete observation windows and automation failures are retained alongside final evidence. The missing JO/JOD reference seed in the initial regression database was repaired there, without weakening tests or resetting staging. A concurrent instrumentation capture conflict was rerun sequentially; the final launcher and actual generic notification PNGs were visually inspected. SystemUI did not expose notification body text through accessibility, so that probe is reported false independently; actual NotificationManager content and the screenshot establish the visible result. Unsupported Gradle test-variant invocation was corrected by explicitly supplying the isolated CA property, without changing the ordinary package's trust policy.

Build warnings remain: existing Express `clearCookie(maxAge)` deprecation, Vite large main chunk and Zod comment annotations, and Gradle flatDir/deprecation warnings. They did not fail executed builds/tests. No dependency/framework/toolchain upgrade was introduced merely to silence warnings.

## APK, local testing and safe phone update

Ordinary installable Debug APK:

`C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-foundation\android\app\build\outputs\apk\debug\app-debug.apk`

Package `com.gopharmacy.beta`, versionCode `2`, versionName `1.1.0-beta.2`, name `GO Pharmacy`. Final bytes/hash are in `apk-integrity.json`. **Do not install the `.checkouttest` package or instrumentation APK as the phone update.**

1. Keep the existing app installed; do not uninstall or clear data. Copy/open ordinary `app-debug.apk`, or use `adb install -r <absolute APK path>` after authorizing that physical device.
2. The emulator's previous/new certificate SHA-256 matched and `install -r` worked. The physical phone's installed certificate was not read; if Android reports signature incompatibility, stop and inspect the installed signing certificate rather than uninstalling and losing local settings. No phone-controlled test is claimed.
3. Open Android Studio at the repository's `android` directory; use installed SDK API36/JDK21 and Gradle wrapper 8.13. Existing `local.properties` points at the task SDK. Normal `android:sync`/Debug scripts use project-pinned pnpm10.34.5. To preserve a concurrently served checkout, use the documented isolated build output instead of overwriting its web directory.
4. Local QA web is `http://localhost:3023`, isolated V2 staging database. Emulator QA API is `https://10.0.2.2:3445`, available only through the separate test-trust variant; it is **not** a phone address or a public staging service. No SSL override exists in the ordinary APK.
5. For a phone, prepare a **separate authorized HTTPS V2 staging backend** and separate migrated staging database. Configure `APP_ORIGIN` to its actual trusted origin, `ANDROID_API_ENABLED=true`, and `TRUST_PROXY` only for the real reverse-proxy IP/CIDR. Expose only Express HTTP service behind valid TLS; keep MySQL loopback/private and serve only built public assets. Never expose `.local`, project files, mail sink or database port.
6. Configure real email and fixed reset origin on that separate server; test with fictional accounts. Enter its actual HTTPS origin in the app connection settings. No new public URL was fabricated or deployed here. The existing phone tunnel/configuration was not redirected or modified; its current availability was not independently retested after the resumed host session.

Recommended manual controlled journey: create a fictional public customer without an invitation → request/reset password through configured real mail or the isolated development sink → sign in → add a manually entered reminder, explicitly grant permission and observe background notification → use fictional supply/address with Arabic digits at checkout → explicitly enroll/assign from Admin → accept/prepare/ready in the authorized pharmacy portal → inspect customer status → retry the same checkout key and verify the same order/reservation. Do not perform real medication sales or payments.

## Remaining gates

- Real email credentials/verified sender and an authorized separate phone-reachable HTTPS V2 staging environment are external configuration gates. Existing phone service and original databases were not upgraded.
- No physical phone, real-email delivery, commercial dispensing, payment, real stock or clinical adherence acceptance.
- Exact Canva font/vector/high-resolution exports and a second approved promotional artwork are missing. Visual differences remain; the new preview does not activate consultations.
- JFDA current official dataset and usable license/permission confirmation are required before Jordan automation/publication. The KB is a scalable limited foundation, not a comprehensive worldwide drug directory.
- Rate limits, delivery queue and source cache are bounded single-process implementations; durable/shared services are required before scaling. No distributed production-readiness claim.
- All exact changed files are recorded in [V2_CHANGED_FILES.md](V2_CHANGED_FILES.md). Final local commit and clean Git state are delivered separately; `main` remains untouched.
