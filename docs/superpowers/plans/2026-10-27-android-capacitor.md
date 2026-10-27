# GO Pharmacy Android implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an installable debug APK from MVP commit 943498797d8adc11af7fde0fb9f681df1021857c, preserving its simulated commerce and access controls.

**Architecture:** Package the existing Vite React assets with Capacitor 8.5.3, app ID `com.gopharmacy.beta`, name GO Pharmacy. Keep Express/MySQL external. Native API calls use explicit HTTPS-only origin configuration and CapacitorHttp with native cookie storage; the server opts into a narrow native-client request boundary. Browser same-origin protections remain in place. No remote `server.url`, cleartext HTTP, certificate bypass, client secrets or native bearer-token persistence.

**Tech Stack:** Existing React/TypeScript/Vite/Express/tRPC/MySQL; pinned Capacitor core/android/cli 8.5.3; Android Studio 2026.2.1 installed; Java 21 from the older installed Studio. SDK path absent at initial inspection; ADB available separately; no attached device.

**Spec:** User Android request on 2026-10-27 in this chat; implementation decisions below are engineering choices within that scope.

## Global constraints

- Original MVP checkout and main remain untouched. Work in a separate clone on feat/android-capacitor-debug.
- Preserve existing database and all 71 tests. Integration tests only use the guarded disposable test database.
- HTTPS must have a trusted certificate and be reachable by the phone. No pretend hosting. Default APK shows an Arabic connection setup screen when no endpoint is configured.
- API origin is public configuration, never a credential. Retain HttpOnly/Secure/Lax server cookies; no localStorage session tokens.
- No Play upload, public deployment, real medication sales, payment or patient data.

## Review focus

- Missing/invalid/loopback API origin fails closed with actionable UI.
- Native mutation permission is explicit, requires HTTPS and exact native-origin/header combination; an unrelated browser origin must remain denied.
- Cookies stay native/HttpOnly, redirects cannot silently send credentials to a second server.
- Packaged assets must boot without an external web page and fit Arabic RTL/system-bar insets.
- APK absence, emulator absence or unavailable HTTPS must be reported distinctly from successful web checks.

## Task 1: Secure native transport and configuration

Files: shared/native-api.ts; client/src/lib/api-fetch.ts; client/src/components/NativeConnectionGate.tsx; client/src/main.tsx; server/http-security.ts; server/native-api.test.ts; server/http-security.test.ts.

- [x] Write failing URL-policy and HTTP boundary tests, including native disabled, insecure native requests, hostile origins, and preserved browser checks.
- [x] Implement HTTPS-only endpoint validation, explicit CapacitorHttp fetch adapter, Arabic connection setup and opt-in secure native request boundary.
- [x] Run focused tests and application/test TypeScript checks.

## Task 2: Native project and first APK

Files: capacitor.config.ts; package.json; pnpm-lock.yaml; android/; client/index.html; client/src/index.css; scripts/build-android.ps1.

- [ ] Pin compatible stable Capacitor dependencies and generate Android native project with packaged dist/public assets.
- [ ] Set name/package, RTL, green/white vector icon and splash matching existing pill/green identity; disable cleartext and backups; account for system bars.
- [ ] Discover/reuse installed SDK or document/install required official components where authorized. Use bundled Java 21 and project Gradle wrapper without global setting changes.
- [ ] Build assembleDebug, inspect package/signature/assets/permissions and copy APK to outputs.

## Task 3: Regression, device validation and delivery

Files: docs/ANDROID.md; docs/ANDROID_REPORT.md; docs/evidence/android/; README.md.

- [ ] Run full tests on actual guarded test MySQL, both type checks, web production build and Android build/lint checks available.
- [ ] Use an available emulator without deleting/replacing existing AVD data. Verify boot, Arabic setup, validation/navigation, screenshots and logs. Claim no physical-device or live HTTPS auth flow without execution.
- [ ] Review final security/diff, fix material issues, commit feature branch and deliver APK hashes, installation/Studio instructions and network requirements.

## Progress ledger

2026-10-27: Source commit and clean state verified. Separate clone/branch created. Node 24.22.1, PATH pnpm 11.25.0 (project pins 10.34.5), Studio 2025.1.4/JDK21 and Studio2026.2.1/JDK25 found. Saved SDK path is absent. Standalone ADB found; no device attached. Stable npm dist-tag is 8.5.3; 8.5.4 is nightly only and was rejected for this build. No source secrets printed.

Task 1 complete: URL and HTTP boundary tests failed before implementation. Cookie-response filtering regression failed before correction; four transport tests passed afterward. Existing web path retained. 88 tests passed across 16 files with actual guarded MySQL; a further native-header HTTP/session/MySQL integration test passed independently. Both TypeScript commands passed. Native bridge logging disabled after discovering the vendor cookie manager logs Set-Cookie values at info level. This does not claim phone HTTPS end-to-end testing.

Task 2 ruling: User approved the Android SDK agreement/download after the configured SDK path was confirmed missing. Official command-line tools SHA-256 matched Google's published 90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a. API36, Build Tools36 and platform-tools installed into task-local work/android/sdk. Emulator/image downloading. New Gradle8.14.3 downloads stalled/slow; existing complete Gradle8.13 found, and Google's AGP8.13 compatibility table explicitly supports Gradle8.13. Selected that installed distribution and pinned its official checksum. No SDK/AGP/Capacitor API version lowered, no SSL or auth bypass.
