# Android manual reminders V2

The Android shell contains an app-owned Capacitor plugin, `GoReminders`. It schedules local, user-created health reminders. It does not prescribe treatment, infer a dose from an order, mark a dose as taken, or reschedule a missed dose. Reminder definitions continue to belong to the authenticated server account; local scheduling is an optional device capability.

## Implementation choice and current platform references

The official [Capacitor local notifications documentation](https://capacitorjs.com/docs/apis/local-notifications) and its [current official documentation mirror](https://next.capacitorjs.com/docs/apis/local-notifications) were checked during implementation on 2026-10-29. The official plugin supports Android permissions and local notifications. This implementation instead uses a small application-owned native bridge because this product requires all of the following together: encrypted minimal definitions, account-specific cancellation of pending and delivered notifications, one future alarm per definition, protected clock/timezone/boot restoration, and validated account-specific notification opening. No new npm/Gradle dependency or existing toolchain version was needed.

[Android's alarm documentation](https://developer.android.com/develop/background-work/services/alarms) explains that inexact alarms can be delayed, alarm identity controls replacement/cancellation, and alarms must be restored after reboot. The bridge uses `AlarmManager.setAndAllowWhileIdle(RTC_WAKEUP, ...)`. It requests neither `SCHEDULE_EXACT_ALARM` nor `USE_EXACT_ALARM`. It has no foreground service, repeating worker, battery exemption, remote push service, or network call.

The existing minimum SDK is 24. Recurrence uses `GregorianCalendar`/`TimeZone` to support that minimum without a desugaring dependency. Device-zone wall-clock behavior is tested separately from the Android scheduling integration.

## JavaScript contract

```ts
type NativeReminder = {
  id: number;                     // positive 32-bit integer, unique in this account
  medicationName: string;          // 1..160 characters, no control characters
  times: string[];                 // 1..8 unique, strict HH:mm
  weekdays: number[];              // 1..7 unique, JavaScript 0=Sunday..6=Saturday
  startDate: string;               // valid YYYY-MM-DD, inclusive
  endDate?: string | null;         // inclusive, at or after startDate
  enabled: boolean;
  discreet: boolean;               // generic content when true
};
type NativeStatus = {
  permission: 'granted' | 'denied' | 'prompt';
  scheduled: number;               // current registered next occurrences, never >20
  accountKey?: string;
};

GoReminders.synchronize({ accountKey, reminders }): Promise<NativeStatus>;
GoReminders.status(): Promise<NativeStatus>;
GoReminders.requestPermission(): Promise<NativeStatus>;
GoReminders.clear(): Promise<void>;
GoReminders.consumeOpen(): Promise<{ reminderId?: number; accountKey?: string }>;
GoReminders.addListener('reminderOpened', ({reminderId, accountKey}) => {});
```

`accountKey` is the normalized HTTPS server **origin** followed by `|` and the positive user ID. It contains no bearer token, credentials, query, path, medication name, or email. Up to 20 definitions are accepted. Input is validated completely before the previous plan is changed. Unknown payload fields are discarded before persistence.

Only `requestPermission()` requests the Android 13+ notification permission. `synchronize()`, boot handling, resume, and status never display a permission prompt. Global/channel notification denial is reflected in status; definitions remain encrypted so a later explicit grant can restore future occurrences. On older Android versions notification settings still determine delivery.

The web integration must clear on confirmed logout, confirmed account change, or server-origin change. An unresolved initial authentication request does not justify silently transferring a cached schedule to another account. When offline, a previously authenticated account can keep its encrypted local definitions until a fresh authentication response establishes otherwise. The native cache cannot independently detect remote logout or account revocation without network connectivity.

## Recurrence and cancellation

Each definition has at most one future `PendingIntent`, independent of the number of its daily times. After receiving an alarm, the receiver advances and persists the next future occurrence before posting the notification. Duplicate old alarm deliveries cannot advance or notify the same occurrence twice. Notification IDs are deterministic positive 31-bit hashes of account and reminder ID; sorted allocation resolves collisions without relying on JavaScript integer coercion or list order.

All chosen HH:mm values follow the **current device timezone**, including after travel or manual timezone changes. The server definition's timezone is provenance; this native contract intentionally follows the current device clock. The UI must explain this. Start/end dates and weekdays are local dates. A nonexistent spring-DST wall time is skipped rather than shifted to a different dose time. A repeated autumn wall time uses its later offset once. No catch-up notification is generated for a missed occurrence when restoring after startup, reboot, or a clock/timezone change.

Editing, disabling, deleting, logout, or switching accounts cancels the affected old alarms, content pending intents, and delivered notifications. Same-account synchronization retains unchanged entries, protected intent identities, and already displayed notifications. Ordinary resume leaves a registered inexact occurrence intact, including one Android has not yet delivered after its requested time. It does not cancel that occurrence and advance it to tomorrow. Missing pending intents are restored; permission denial cancels delivery as before.

`BOOT_COMPLETED`, `TIME_SET`, `TIMEZONE_CHANGED`, and `MY_PACKAGE_REPLACED` explicitly recalculate future wall-clock occurrences. A changed stored timezone also forces recalculation. A pre-fix cache lacking timezone provenance is reconciled on first use; create a fresh future test occurrence after updating. No missed-dose catch-up is synthesized for these explicit clock/boot changes. The receiver remains non-exported and credential-encrypted restoration occurs after normal device unlock. A native status count records ledger entries; a live PendingIntent and Android AlarmManager evidence are separate observations, not a delivery guarantee.

Android can delay or suppress notifications because of inexact batching, Doze, battery policy, notification/channel settings, private space, or manufacturer restrictions. Force-stop prevents Android background delivery until the user opens the app again. Reopening restores future occurrences; it does not imply that missed reminders were delivered. A status count reports the native scheduled plan, not a clinical delivery guarantee.

## Privacy and notification opening

The Android Keystore holds an AES-256-GCM key. Authenticated ciphertext is written with `AtomicFile` into `Context.getNoBackupFilesDir()/reminders-v2.enc`. Android's public SharedPreferences API cannot choose the no-backup directory, so an atomic encrypted file is used instead of placing health definitions in ordinary SharedPreferences. The file contains only the account key, validated reminder definitions, native IDs, random internal intent tokens, next-occurrence timestamps, and at most one pending-open event. It contains no dose history, notes, diagnosis, order, session token, or backend credential. A separate ordinary preference holds only the non-sensitive permission-requested flag. Existing app backup protections remain enabled. Corrupt/unreadable ciphertext is discarded, and notifications fail closed.

The default notification text is generic Arabic. Showing a medication name requires `discreet: false`. Both variants use private lock-screen visibility and an explicitly generic public version. The status-bar small icon is Android's built-in reminder glyph; launcher icons and branding assets are not modified by this change.

The content intent targets `MainActivity` explicitly and is immutable. Its opaque random token, native ID, definition ID, action, URI, exact component, enabled state, and current cached account are validated before an open event is accepted. External extras are never trusted as an account identity. An obsolete notification cannot open a reminder in another cached account. A cold start stores one encrypted pending event for `consumeOpen()`, which consumes it once. When a live listener exists, the event is emitted and the pending copy is consumed. The web UI must still validate the current authenticated account and fetch the reminder under normal authorization; opening never records a dose action.

## Verification and runtime handoff

Unit tests cover multiple daily times, midnight boundaries, weekdays, inclusive dates, expiry, disabled definitions, malformed input, DST gaps and overlaps, device timezone changes, privacy text, account origin validation, and collision resolution. Android instrumentation checks real Keystore ciphertext, native pending-intent cancellation, account switching, stale/forged taps, single-consumption opens, public/private notification content, and Android's DST behavior.

From the Android directory, with this project's existing JDK 21 and Android SDK configured:

```powershell
./gradlew.bat testDebugUnitTest compileDebugAndroidTestJavaWithJavac --console=plain
```

The compile command does not install or run the Android instrumentation suite. The dedicated emulator owner must build/install the app and test APKs and run `com.gopharmacy.beta.ReminderSchedulerTest` with notification permission both allowed and denied. Tests replace/clear the app's reminder cache and must not run against a personal device containing real reminders.

`ReminderDeliveryTest` is explicitly opt-in with instrumentation argument `runReminderDelivery=true`. It schedules the next actual wall-clock minute using the production bridge scheduler and observes AlarmManager -> receiver -> system notification delivery for up to 180 seconds. It also checks generic content and replay rejection. Failure to observe delivery in that bounded window must be reported as a device observation failure/inconclusive timing result, because this feature promises no exact-delivery deadline. This test does not prove delivery after app closure, reboot, force-stop, or on a physical phone; those require separate device scenarios.

`ReminderLifecycleTest` supplies an opt-in fixture for those separate emulator scenarios. Use `runReminderLifecycle=true` and `reminderFixtureAction=prepare` to persist one real alarm; `reminderFixtureDelayMinutes` accepts 1..10 (default 2), and `reminderFixtureAccount` can use the dedicated test account's origin/user ID. Preparation prints the actual scheduled timestamp and native ID. End that instrumentation invocation, close the app normally or reboot/unlock the dedicated emulator externally, wait for a visible notification, then run the same fixture with `reminderFixtureAction=inspect`. Inspect reads the actual system notification and persisted next occurrence; it never calls `fire()` to manufacture delivery. Finally run `reminderFixtureAction=clear`. These explicit fixtures replace the current local reminder plan. A force-stop is an intentional blocking scenario and must not be represented as normal app closure.

Example instrumentation selection (after installing matching app/test APKs on the dedicated emulator):

```text
adb -s emulator-5580 shell am instrument -w -e class com.gopharmacy.beta.ReminderSchedulerTest com.gopharmacy.beta.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5580 shell am instrument -w -e class com.gopharmacy.beta.ReminderDeliveryTest -e runReminderDelivery true com.gopharmacy.beta.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5580 shell am instrument -w -e class com.gopharmacy.beta.ReminderLifecycleTest -e runReminderLifecycle true -e reminderFixtureAction prepare com.gopharmacy.beta.test/androidx.test.runner.AndroidJUnitRunner
```

No native delivery, reboot, runtime permission-dialog, physical-phone, production-backend, or end-to-end clinical claim follows from JVM tests or Java compilation alone.
