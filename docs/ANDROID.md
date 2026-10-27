# GO Pharmacy Android debug

This Android project starts from the completed MVP commit `943498797d8adc11af7fde0fb9f681df1021857c`, on branch `feat/android-capacitor-debug`. It packages the existing React/Vite interface into the APK with Capacitor 8.5.3. There is no remote `server.url`. The Express backend and MySQL database remain separate services.

## Open in Android Studio on this Windows machine

Open the **android folder**, not the repository root, using File > Open in:

`C:\Program Files\Android\Android Studio1\bin\studio64.exe`

Project folder:

`C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-android\android`

Use **JDK 21** at `C:\Program Files\Android\Android Studio\jbr` for this project's Gradle JDK (Settings > Build, Execution, Deployment > Build Tools > Gradle). The newer Studio's bundled JDK 25 is not the selected runtime for Gradle 8.13. Do not change the global Java installation. The wrapper pins the already installed Gradle 8.13 and its published SHA-256, with Android Gradle Plugin 8.13.0. Google documents Gradle 8.13 as that plugin's supported minimum/default. The Capacitor template defaults to 8.14.3; 8.13 was selected after inspecting the local cache and checking compatibility, to avoid a stalled extra distribution download. SDK compile/target 36 and minSdk 24 (Android 7.0+) follow the Capacitor 8 template.

The task-local SDK is:

`C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\work\android\sdk`

Set this in Project Structure > SDK Location if Studio does not pick up the generated, ignored `android/local.properties`. Neither this SDK nor private environment files belong in Git or the APK.

For a fresh Git clone or extracted source archive, install the pinned dependencies and run `npm run android:sync` before opening Studio. This regenerates the ignored Capacitor/Cordova bridge configuration and copies the web assets; those generated files are intentionally absent from Git.

## Rebuild

From the repository root, using the project-pinned pnpm:

```powershell
npx --yes pnpm@10.34.5 install --frozen-lockfile
npm run check
npm run test:types
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -SdkPath "C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\work\android\sdk" -JavaPath "C:\Program Files\Android\Android Studio\jbr"
```

The script builds the local web assets, adds a packaged-content CSP, synchronizes Capacitor, and runs the Gradle wrapper's `:app:assembleDebug`. It targets the application APK rather than separately assembling distributable AARs for vendor libraries. It changes environment variables only within that process. The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. A debug APK is development-signed; no production signing key or Play upload is configured.

Run database tests only with `TEST_DATABASE_URL` pointing to a guarded disposable `go_pharmacy_test` database as described in TESTING.md. Never run fixtures on the demonstration or production database.

## Install on a phone

1. Copy the delivered APK to your own Android phone running Android 7.0 or later.
2. Open it and allow installation from that specific file manager/browser if Android asks. Keep the permission limited to the installer you choose.
3. Launch **GO Pharmacy**. All orders remain simulated and must use fictional data.

Alternatively enable Developer options and USB debugging on your own test device, approve the computer on the phone, then use:

```powershell
& "C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\work\android\sdk\platform-tools\adb.exe" devices -l
& "C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\work\android\sdk\platform-tools\adb.exe" -s YOUR_DEVICE_SERIAL install -r "PATH_TO_GO_PHARMACY_DEBUG_APK"
```

If an existing application uses the same ID but a different signing key, Android will reject an update. Do not uninstall an app with valuable data to bypass that warning; resolve the package/signature choice first. This prototype ID is `com.gopharmacy.beta`.

## Will login and orders work on the phone immediately?

**Not against the current loopback-only HTTP backend.** The APK can display its packaged Arabic setup/interface without downloading a website, but authenticated catalog/order operations require a reachable backend. This delivery does not invent or publicly deploy such a server.

The phone must reach an actual HTTPS origin with a certificate Android trusts. `localhost` and `127.0.0.1` are the phone itself. `10.0.2.2` is an emulator-only host alias, not a production endpoint; cleartext HTTP remains blocked. A LAN server can be used only with a hostname and trusted HTTPS certificate that the device can resolve and reach. No self-signed-certificate acceptance, trust-all code, SSL-error override, cleartext exception, or tunnel/public exposure is included.

On the external backend, use this Android branch's server code (the original MVP backend does not include the native boundary), keep the existing database/secrets server-side, and configure:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://YOUR_REAL_BETA_HOST
ANDROID_API_ENABLED=true
# Set only to the actual proxy source IP/CIDR if TLS terminates there.
TRUST_PROXY=YOUR_ACTUAL_PROXY_IP_OR_CIDR
```

Retain real `DATABASE_URL`, private invitation secret, allowed participant emails and normal account credentials **only on that server**. Apply the existing deployment, migration and backup instructions; this Android change adds no migration. The reverse proxy must preserve the native request Origin/header and set the trusted forwarded protocol correctly. Do not set `TRUST_PROXY=true` merely to make a test pass or expose MySQL to phones.

In the APK's Arabic connection screen, enter the final HTTPS **origin only**, with no path, credentials, query or fragment. This nonsecret address is saved locally; passwords and session tokens are not saved in localStorage. An operator may instead build with `VITE_ANDROID_API_ORIGIN` as public configuration. Do not put a key, token or database URL in any VITE variable.

## Authentication and network boundary

- Web requests keep the original relative API URL, same-origin JSON checks and HttpOnly/Secure/Lax cookie policy.
- Android requests use CapacitorHttp's native HTTP/cookie manager and the same server sessions, password checks, invitation rules, role checks and ownership constraints. They declare the bundled origin `https://localhost` and `X-Go-Pharmacy-Client: android`; the backend requires explicit opt-in and actual/trusted-proxy HTTPS. That header identifies the transport, not a user or trusted role.
- CORS is not opened, no cookie is changed to SameSite=None, and no bearer credential is persisted in JavaScript. Set-Cookie is removed from the adapter's Response exposed to application code. The native bridge is a privileged part of the app; only bundled trusted scripts may run.
- Requests are confined to the configured origin's `/api/trpc/` routes, redirects are disabled, and mixed/cleartext traffic is disabled. Native bridge logging is off to avoid Capacitor's cookie log messages.
- The packaged-content CSP, default navigation policy, no remote server URL, disabled WebView debugging and disabled Android backups reduce accidental exposure. This is still a debug build, not a hardened production signing/release claim.
- An ambiguous network timeout must not create a new checkout key. Existing checkout recovery/idempotency logic remains in place.

## Visual identity and scope

The app retains the Arabic RTL React screens, existing green `#00c57d` and pill motif, with vector launcher/adaptive icons and an Android splash theme. System-bar insets are handled with Capacitor 8 safe-area CSS variables. No medical services, actual medication sale, payment, live delivery, patient records, Google login or Play integration is enabled.

## Emulator used for verification

The delivered APK was installed and inspected on the dedicated `GO_Pharmacy_Beta_API36` Pixel5 AVD running Android16/API36 (Google APIs x86_64 revision7). It is registered separately; its data is under this task's `work/android/avd`, and existing AVDs were not replaced. The installed-artifact instrumentation run returned OK(2 tests); actual Arabic setup and HTTP rejection were also inspected and captured. This does not establish physical-phone or live HTTPS login/order coverage.

The device profile generated by the SDK tools initially contained Arabic-digit memory sizes. Only this AVD's config was corrected to ASCII values (3072MB RAM, heap256MB) and four virtual cores; no Windows virtualization/security setting was changed. If this profile is recreated on an Arabic-locale system, inspect malformed-memory warnings before diagnosing an app failure. The APK itself does not need this emulator-specific correction.

Primary references: [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0), [CapacitorHttp](https://capacitorjs.com/docs/apis/http), [configuration](https://capacitorjs.com/docs/config), [AGP 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes), [Android SDK terms and tools](https://developer.android.com/studio).
