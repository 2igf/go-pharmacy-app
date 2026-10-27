# Foundation V1 — implementation and compatibility report

Verified 2026-10-27 on the user's Windows machine. Work is in a separate clone
`outputs/go-pharmacy-foundation`, branch `feat/multi-app-foundation-v1`, based
exactly on Android `889c7e40472e27a50f5c2c26b900b0dbe63ce41e`, whose history
contains MVP `943498797d8adc11af7fde0fb9f681df1021857c`. Main was not modified,
merged, pushed or used as the implementation base. No application was deployed.

## Changes

| Files | Change |
| --- | --- |
| `server/routers.ts` | Composition root retaining all 52 existing procedure paths and AppRouter export; adds platform capabilities. |
| `server/domains/catalog.ts` | Existing product reads/admin mutations extracted unchanged. |
| `server/domains/shopping.ts` | Existing cart and personal order procedures extracted unchanged, shared transaction service retained. |
| `server/domains/account.ts` | Existing address and notification procedures extracted unchanged; relocated dynamic DB imports. |
| `server/domains/administration.ts` | Existing beta admin orders/status procedures extracted unchanged. |
| `server/domains/medical.ts` | Existing doctors/appointments/reminders/prescriptions retained behind existing shutdown. |
| `shared/applications.ts` | Typed vocabulary for four apps, seven intended roles, shared services, capability contract V1. |
| `server/access-policy.ts` | Server-only mapping of existing persisted roles and fail-closed service policy. |
| `server/_core/trpc.ts` | Supported-role guard on personal procedures and centralized administrative service check. |
| `server/platform.ts` | Authenticated informational `platform.capabilities` query; no grant/role mutation. |
| `server/legacy-api-manifest.json` | Snapshot of all 52 original API names. |
| `server/platform-boundaries.test.ts` | 20 focused policy/API/medical-gate tests, including all medical operations across seven actor labels. |
| `server/provider-personal.integration.test.ts` | Two real MySQL cases for doctor/pharmacist personal ownership. |
| `server/native-auth.integration.test.ts` | Existing native session test extended with capabilities, role/app header spoof denial, logout denial. |
| `docs/MULTI_APP_FOUNDATION_V1.md` | Architecture, contracts, current/future role matrix and activation gates. |
| `docs/MULTI_APP_INVENTORY_V1.md` | Current/historical/absent features and operational-branch provenance. |
| `docs/MULTI_APP_VERIFICATION_V1.md` | This report and Android acceptance limits. |
| `docs/ARCHITECTURE.md`, `docs/KNOWN_LIMITATIONS.md` | Links to current foundation and explicit unresolved Android checkout issue. |
| `docs/superpowers/plans/2026-10-27-multi-app-foundation.md` | Plan and execution ledger. |
| `docs/evidence/foundation/*` | Actual command output, extraction hashes, API/data/Android evidence and web search screenshot; see modified-files.txt for exact list. |

No client UI, Capacitor configuration/native source, schema/migration,
commerce transaction, authentication implementation, HTTP/proxy security,
package.json or dependency lockfile was changed. Generated Capacitor Gradle files
were restored after sync, so build-machine line endings are not source changes.

## Executed verification

| Verification | Observed result |
| --- | --- |
| Existing suite before domain extraction | 91 passed / 18 files. |
| New policy RED | Missing policy import failed; after policy implementation, the absent platform route caused a real failing assertion (17 passed / 1 failed). |
| Policy GREEN | 18 passed initially, then API manifest and every-medical-operation coverage expanded it to 20. |
| Full final suite, actual guarded MySQL test DB | **113 passed, 0 failed, 0 skipped / 20 files**, including existing atomic checkout/stock/session/ownership tests. |
| `pnpm check` | Exit 0, TypeScript application/server/shared code. |
| `pnpm test:types` | Exit 0, test/native config/operator script types. |
| `pnpm build` | Exit 0, production React and bundled backend; nonfatal >500 kB chunk advisory remains. |
| Extraction comparison | All 10 extracted router objects have equal normalized handler ASTs at reference/current; independently token-verified by reviewer. |
| Compatibility manifest | All 52 old procedure names remain; only platform.capabilities added. Input/handler/response bodies unchanged. |
| Actual local HTTP smoke of new backend | HTML 200, React root present, compiled asset 200, catalog 200 with four fictional products, anonymous capabilities 401. |
| Actual browser smoke of new React build | Arabic RTL product catalog displayed; searching غسول reduced results to the matching fictional product. Screenshot saved. No order submitted. |
| Native HTTP + real MySQL session test | Existing registration/session/logout flow still passes; capability role is customer; forged admin/app headers 403; logged-out discovery 401. This is a local HTTP fixture simulating a trusted TLS proxy, not a new external HTTPS deployment. |
| Provider personal ownership | Actual doctor/pharmacist DB roles cannot read/delete another user's address, read another user's order or use admin/medical operations; personal cart isolated. |
| Schema/data safety | No migration run; test fixture cleanup guarded to named disposable test DB. Read-only hashes of demo users/orders/items/products matched before and after smoke/browser verification (3 users, 2 simulated orders, 2 order items, 4 products). This snapshot covers those four tables and that interval. |
| Existing operations preservation | Original Ops checkout clean at 62a77ff; old app/API/MySQL retain loopback listeners on 3017/3018/33317; temporary public tunnel health returned 200. Foundation was not deployed through it. |
| Independent bounded code review | No concrete important finding in extraction/policy/contracts/tests; reviewer did not claim to rerun tests or perform a full repository audit. |

Commands used the existing Node24 environment and project-pinned pnpm10.34.5.
No dependency versions were changed. This is not a new dependency audit; inherited
dependency findings remain documented in the earlier Android/MVP evidence.

## Android compatibility

Although only backend/runtime policy and shared discovery vocabulary changed,
Android was rebuilt to verify the repository remains buildable. Final asset sync
and native build ran after the initial production build, and the web production
build was restored afterward. No parallel writes were used for the final synced
native asset set. Both products were verified independently.

- Existing SDK under task-local `work/android/sdk`, API36, build-tools35 and
  Android Studio's bundled JDK21; Gradle wrapper8.13 and Capacitor8.5.3 unchanged.
- `android:sync` succeeded, with embedded local React assets and packaged CSP.
- `:app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest` succeeded.
- Android lint: **0 errors, 14 warnings**, not suppressed; inherited resource/tool
  recommendations. Saved lint-summary.json lists actual IDs.
- Newly built app and test APK installed successfully on the dedicated
  Android16/API36 emulator-5580. AndroidJUnitRunner returned **OK (2 tests)**.
  This run was headless; it did not repeat the prior visual/emulator checkout or
  physical-phone tests. Installed-artifact checks cover package/label/RTL,
  cleartext/backup protection and embedded assets/native config.
- APK signature verification succeeded (v2, one debug signer). Package remains
  `com.gopharmacy.beta`, GO Pharmacy, version1.0.0-beta.1, min24/target36.
- Existing phone APK needs no update to call unchanged endpoints after a reviewed
  backend rollout. Current phone still uses the separate Ops backend; this task
  did not validate the new backend on the user's physical phone.

New APK (old deliverable retained):

`C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\GO-Pharmacy-Multi-App-Foundation-V1-debug.apk`

SHA-256: `ff89bca8963b16f2156cf5735c4d1aeb9aeec63ef8da5c0a9116203585e2411a`.

Native build output is also available under this clone's
`android/app/build/outputs/apk/debug/app-debug.apk`. Open the clone's `android`
folder in Android Studio. Use the same installed SDK and JDK21; do not point it
at the newer Studio1 JDK25. Existing Android setup instructions remain in
ANDROID.md. This remains a Debug beta build, not a signed store release.

## Explicit unresolved issues / scope limits

1. **Android checkout validation — OPEN, unresolved.** The user identified this
   known issue. This task did not receive an exact failing payload/device trace,
   reproduce its original phone trigger, change Checkout/validation, or verify a
   physical-phone checkout. Passing transaction/API tests and native packaging
   tests do not close it. Earlier checkout recovery/origin-scoping fixes address
   different conditions and must not be taken as proof that this issue is fixed.
   Next diagnosis should capture the validation message and field formats using
   fictional input in a dedicated test flow; do not log passwords/session tokens
   or send a real medication order.
2. Captain/Partners and future super-admin/clinic/driver role provisioning remain
   inactive. Current security evidence proves rejection, not future tenant
   implementation. No private pharmacy inventory API exists to certify yet.
3. Medical legacy handlers are retained, not safe to activate. Unscoped patient
   lookups and placeholder operations require implementation and tests first.
4. The historical master spec was not available. No claim of complete historical
   spec parity or new Canva conformance is made.
5. Existing Express clearCookie maxAge deprecation appears in tests; logout
   revocation still passes. No unrelated auth cleanup was included.
6. No real payment, medication dispensing, delivery, physical-phone acceptance,
   iOS build, Google Play release, main merge or deployment occurred.

## Recommended next implementation

Design and test an additive organization/membership/provider-approval model with
resource ownership, then implement one pharmacy-scoped inventory workflow with
two-organization isolation tests. Preserve the global beta catalog and existing
data until a reviewed allocation plan exists. Diagnose the separate Android
checkout validation issue before accepting mobile checkout for a wider beta.
