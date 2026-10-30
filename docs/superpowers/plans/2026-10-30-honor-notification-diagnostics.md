# HONOR notification diagnosis and bounded repair

Baseline: clean `d6a4eb9`; branch `fix/android-reminder-delivery-v1`.

1. Inspect installed packages/scheduler, read sanitized reminder timing only from independent phone V2 DB, inventory authorized ADB devices. Original DB, customer app/account/data and existing HTTPS runtime remain untouched.
2. Separate confirmed observations: physical HONOR permission/settings/failure are user reports; phone currently unavailable because user is away. Emulator observations are not phone acceptance. Native ledger/AlarmManager/channel/Logcat on HONOR remain unverified.
3. Reproduce the identified resume/same-account synchronization cancellation paths before changing runtime code. Use a disposable emulator-only application id. Never run existing cache-replacing instrumentation fixtures on a customer's phone.
4. Only after failing native regressions, preserve unchanged pending occurrences/intent identity and delivered notifications; retain explicit cancellation for edits/removal/permission revocation/account changes. Boot/clock/timezone reconciliation must retain the no-missed-dose-catch-up policy.
5. Execute focused native/JVM/client regressions, actual immediate then timed emulator notification, types/builds, and package/certificate compatibility. Rebuild ordinary Debug only if native fix is implemented. Provide a privacy-safe physical acceptance procedure and unresolved device evidence gates. No exact-alarm/battery exemption/foreground service or SSL bypass.

Key files: ReminderScheduler.java, ReminderReceiver.java, native regression tests and diagnostic report. No backend schema/migration, authentication or customer design changes.

Execution: original3/3native tests failed, repaired15/15native+11JVM+19focusedVitest passed; both TypeScript configurations and isolated production web build passed. Actual immediate then75.995-second scheduled delivery passed in emulator. Signed no-restart probe preserved PID and encrypted populated-plan hash. Ordinary package3test checks passed without PID change. Normal Debug version3built; previous V2 signing certificate matches and51bundled asset files are unchanged. In-place emulator update retained WebView/preferences bytes. Independent read-only review found no blocker; minute-boundary fixture note fixed and15native tests rerun. Physical HONOR remains unavailable/user away; its root cause and successful delivery remain explicitly unverified, with a single USB acceptance procedure in HONOR_REMINDER_DIAGNOSIS_V1.md.
