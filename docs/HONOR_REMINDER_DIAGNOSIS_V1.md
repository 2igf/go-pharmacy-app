# HONOR reminder diagnosis and bounded Android repair

2026-10-30 — branch `fix/android-reminder-delivery-v1`, based on verified clean `d6a4eb9a3cd2746071224632a5fe34d7a91f1df8`. The delivery commit is the commit containing this report. No merge/push/deployment, account reset, database migration, phone permission change or phone app reset was performed.

## Conclusion and evidence boundaries

**A native scheduler defect is confirmed and repaired. The physical HONOR root cause remains unconfirmed.** The user reported granted notification permission, enabled OEM background/launch controls and repeated absence after a roughly three-minute future schedule. Only emulator-5580 was attached to ADB; the user confirmed being away from home. No HONOR Logcat, AlarmManager dump, installed-APK version, channel state, native cache or successful phone notification was observed.

The original APK used application-owned `GoReminders`, not `@capacitor/local-notifications`. That npm plugin is not installed. Capacitor core/Android/CLI remain exactly8.5.3. No plugin/Gradle/SDK/dependency upgrade was needed.

The actual independent phone V2 MySQL database was inspected **read-only**. One customer-owned active definition is saved with an all-week schedule and `Asia/Amman` timezone. Only IDs, times, recurrence flags and timestamps were selected; medication names, dosage, notes, passwords and tokens were excluded. UTC conversion of the saved definition is consistent. This proves server persistence, not native registration on HONOR. Detailed timing/expected deterministic native ID remains outside Git at `work/notification-diagnostics/server-timing.json`. The original database was not accessed.

## Confirmed code defect

1. `GoRemindersPlugin.handleOnResume()` calls `ReminderScheduler.restore()`. Previously restore always canceled the old pending alarm and calculated a strictly future occurrence. If Android had delayed an inexact alarm past its requested time, opening the app could discard that still-outstanding occurrence and advance it to tomorrow.
2. Fresh same-account React authentication/list queries reach `synchronize()`. Previously every synchronization canceled all pending intents and displayed notifications, rotated every protected intent nonce and rebuilt all times, even when definitions were identical. This could dismiss a delivered notification or invalidate an outstanding delivery during normal focus/resume.
3. Ordinary refetches are distinct from intentional logout, account/origin switch, editing, disabling or deletion; those must retain their existing cancellation and isolation behavior.

Three Android state regressions reproduced these defects against the original code: all three failed. The overdue fixture represents a valid scheduled local wall time, encrypted state and an actual registered PendingIntent while a lock excludes a receiver race. It is controlled lifecycle evidence, not a recording of the physical HONOR failure.

## Minimal runtime changes

- `ReminderScheduler.java`: reconcile entries individually. Preserve nonce, next occurrence, pending intents and posted notifications only when account, native ID and complete canonical definition match. Cancel changed/removed entries. Restore a missing pending intent, while ordinary resume leaves an existing outstanding inexact alarm intact. Native pending-ledger timezone provenance is additive and private; no database change.
- `ReminderReceiver.java`: protected boot/clock/timezone/package-replacement events explicitly recalculate future wall times. These events do not synthesize missed doses. A pre-fix cache without timezone provenance is reconciled once; use a fresh future occurrence after updating.
- `ReminderDiagnostics.java`: debug-only public Java helper for signed `--no-restart` instrumentation. It is not a Capacitor method or exported Android component. It reads scalar metadata, avoids AtomicFile backup recovery/missing-key creation during observation, fingerprints ciphertext, and can post/cancel one generic diagnostic notification under a separate tag on the existing channel. No real reminder is replaced or deleted. Debug Logcat events contain only fixed event names, numeric reminder IDs and epoch milliseconds.
- `android/app/build.gradle`: versionCode3 / versionName1.1.0-beta.3 for identifying the repaired APK. Package remains `com.gopharmacy.beta`.

No exact-alarm, battery-exemption, wake-lock, background-service or security-bypass permission was added. No backend, customer design, authentication, session, HTTPS origin, database schema or pricing changes.

## Timing, permission and channel findings

The production channel remains `go_manual_reminders_v2`, importanceDEFAULT, private lock-screen visibility. DEFAULT does not promise a heads-up banner; check the unlocked notification drawer. Global Android notification permission and channel enablement are separate conditions. Their physical HONOR values still need measurement.

Scheduling remains `AlarmManager.setAndAllowWhileIdle(RTC_WAKEUP,...)`. Android12+ documents delivery within an hour of the requested time **unless** battery-saving restrictions apply; Doze/OEM restrictions can delay it further. Therefore three minutes without a notification alone does not distinguish an OS batching delay from failure. No exact scheduling is silently claimed. See [Android alarm guidance](https://developer.android.com/develop/background-work/services/alarms). The [Capacitor local-notifications API](https://capacitorjs.com/docs/apis/local-notifications) describes a different plugin; its methods/version must not be attributed to this custom bridge.

Native IDs remain positive31-bit SHA256-derived values of API origin/user/reminder, with deterministic collision handling. Unchanged synchronization now preserves the protected nonce. Device wall-clock times remain authoritative for local scheduling; saved server timezone is provenance. Existing weekday/date/DST behavior and end-date delivery guard remain.

The displayed scheduled count is a local ledger count. `pendingIntentExists=true` is stronger identity evidence but still not a public API query of AlarmManager's actual queue. Compare it with the targeted system alarm dump. Server persistence, local ledger, live pending intent, system alarm, receiver arrival and a visible notification are separate gates.

## Verification executed

| Verification | Result |
| --- | --- |
| Old-code native regressions |3/3 failed with the expected cancellation/advance assertions|
| Repaired native regression and existing scheduler suite |15/15 passed, final2.291s, disposable emulator-only application ID|
| Recurrence JVM tests |11 tests,0failures/errors|
| Client synchronization/lifecycle/schema/privacy-filter Vitest |19/19 passed in4files,2.64s; no database fixtures/reset|
| Production and test/script TypeScript |Both `tsc --noEmit` configurations passed|
| Production web build |Passed, isolated output directory; existing served files untouched|
| Ordinary Android Debug/test build |Passed, Java21/Gradle8.13/SDK36; toolchain unchanged|
| Immediate generic notification |Actual NotificationManager record observed in emulator;20.055s initial probe|
| Actual timed notification |Real AlarmManager→receiver→notification observed;75.995s, recurrence advanced and replay did not duplicate it|
| No-restart probe with populated local plan |Passed,20.125s; PID5715unchanged and encrypted plan fingerprint unchanged, pending entry retained|
| Ordinary installed package tests plus metadata probe |3/3 passed with `--no-restart`,0.072s, PID5921unchanged|
| In-place emulator update |`install -r` succeeded; WebView and shared-preferences archive hashes identical before/after|
| APK compatibility |Same package/certificate as prior V2, all51prior bundled asset files byte-identical, no remote server URL/test CA/cleartext/mixed-content override|

Emulator evidence does not establish HONOR delivery. No physical controlled post, scheduled delivery, permission/channel inspection or targeted Logcat collection was executed. The new generic probe also returns `visualPhoneDeliveryConfirmed=false`; Android retaining a test notification is not a human visual confirmation.

The original full284-test database suite was not rerun for this native-only repair. Focused tests above were executed without resetting any database. An independent read-only review found no blocking issue; its minute-boundary fixture stability note was fixed and the native suite rerun. Existing non-failing Vite large-chunk/Zod annotation and Gradle flatDir/deprecation warnings remain.

## Safe diagnostic tooling

`scripts/collect-reminder-diagnostics.ts` requires an explicit ADB path and serial. It does not start/stop/clear/install the app, clear Logcat or alter permissions. It reads package/clock/alarm metadata, keeps only fixed structured `GoReminders` log events, whitelists an existing safe native probe file and writes under `.local/honor-notification-evidence`. No raw dumps, medication text, account keys, credentials or tokens are persisted. Four parser tests cover package isolation, log filtering, metadata whitelisting and bounds.

`ReminderPhoneProbeTest` is opt-in. **Never run the whole Android instrumentation suite on a personal phone:** older fixtures intentionally replace local plans. Normal instrumentation can force-stop its target; Android's [ActivityManager implementation](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android16-release/services/core/java/com/android/server/am/ActivityManagerService.java) has separate restart/no-restart paths. Only the named probe with `--no-restart` is used for a real plan. It compares ciphertext fingerprints. This path was actually verified on API36; if HONOR rejects the flag, stop and retain the read-only OS snapshot, without removing the flag or disabling hidden-API/security protections.

Run the immediate probe in a quiet interval. A real reminder firing concurrently can legitimately update the plan fingerprint; correlate scalar receiver events before attributing that observation to the probe. No snapshot is written back over a user's current plan.

## One physical-phone acceptance procedure

Perform this when the user returns with the authorized USB-debugging phone. Use the real serial returned by `adb devices -l`, never the first device automatically.

1. **Capture the old state first**, before updating or reopening unnecessarily. Do not force-stop, clear app data, log out, change clock/zone, or run an instrumentation suite. From the repository terminal:

```powershell
node --import tsx scripts/collect-reminder-diagnostics.ts --serial HONOR_SERIAL --adb "C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\work\android\sdk\platform-tools\adb.exe"
```

2. Check physical model/API, installed version, timezone/clock and actual AlarmManager entry against the server's metadata. Zero parsed entries is not proof of absence if an OEM dump format is unsupported. Record channel state in Android settings without changing it. This is the original-failure evidence gate.
3. Update with the **ordinary** version3`app-debug.apk` using `adb -s HONOR_SERIAL install -r ...`. Do not uninstall/clear data. If signatures do not match, stop. The previous delivered V2 certificate matches the new artifact; the actual phone certificate was unavailable here. Keep the current saved backend URL and account. The separate `.reminderdiagnostic` APK is emulator-only and must not be installed as the customer update.
4. Open the customer app normally and confirm the existing account/URL. Install matching `app-debug-androidTest.apk` solely for the named probe, then record the current process PID. With the phone unlocked and notification drawer accessible, execute:

```powershell
adb -s HONOR_SERIAL shell am instrument --no-restart -w -r -e class com.gopharmacy.beta.ReminderPhoneProbeTest -e runReminderProbe true -e reminderProbeNoRestart true -e reminderProbePhase post com.gopharmacy.beta.test/androidx.test.runner.AndroidJUnitRunner
```

Observe the generic diagnostic card in the drawer during the20-second window; the test removes only that card. Check channel importance/global permission and `encryptedCustomerPlanUnchanged=true`. Verify PID before/after is identical. This distinguishes posting/channel failure from recurrence/AlarmManager problems. Do not treat a missing heads-up banner alone as no notification.
5. In the normal UI create **one generic discreet test reminder**, with no real medication/dose, about6minutes ahead, today's start and all weekdays. Keep existing reminders unchanged. Refresh the read-only probe with the same command but `reminderProbePhase status`; run the collector again. Check that the expected reminder ID/native ID is present, its epoch corresponds to the phone's local wall time, and its PendingIntent **and actual system alarm** are present.
6. Press Home and use the phone normally without force-stop/logout. Record actual receipt time and inspect the drawer. The inexact implementation has no three-minute or second-perfect delivery promise. If not delivered, preserve snapshots and scalar logs; inspect `pending_retained`, `alarm_cancelled`, `alarm_received`, `notification_posted`, channel state and OEM batching rather than resetting anything. Opening the app again should retain an unchanged overdue pending occurrence after this repair.
7. Acceptance requires the user's actual visible immediate **and scheduled** phone notifications, preserved definitions, no duplicate test delivery and a consistent alarm/receiver trace. Until that happens the physical-phone gate stays open. The user may remove only the generic test reminder through the normal UI afterward.

## Artifacts and changed files

Ordinary APK: `C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-foundation\android\app\build\outputs\apk\debug\app-debug.apk`.

Matching signed test package: `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`. Its probe is diagnostic tooling, not the customer app.

Source changes: `android/app/build.gradle`; `ReminderScheduler.java`; `ReminderReceiver.java`; new `ReminderDiagnostics.java`; new `ReminderResumeRegressionTest.java`; new `ReminderPhoneProbeTest.java`; new `scripts/collect-reminder-diagnostics.ts`; new `server/reminder-diagnostics.test.ts`; updated `docs/android-reminders-v2.md`; this report and the execution plan. Sanitized emulator/build evidence is under `docs/evidence/notification-diagnostics`. No personally identifying server reminder snapshot is committed.

Remaining gate: capture the original HONOR state, then perform the single physical acceptance procedure. The code defect is fixed; absence/delay on that particular phone still has unmeasured posting/channel/native-registration/OS-dispatch possibilities.
