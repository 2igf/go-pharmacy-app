# V2 evidence index

Final implementation report: [CUSTOMER_EXPERIENCE_V2_REPORT.md](../../CUSTOMER_EXPERIENCE_V2_REPORT.md).

- `final-verified-full-regression.txt`: final284/284,44files,130.19s, actual dedicated MySQL regression database.
- `final-types.json`: production and test/script TypeScript commands, both exit0.
- `build-*.txt`: production web/server, Android bundle/CSP/sync and ordinary/test Debug build outputs.
- `migration-preflight-final.txt`, `data-preservation-final.json`: intact additive migration state on V2 and unchanged original test/Demo table fingerprints.
- `android-reminder-native.txt`: final9/9actual scheduler tests. JVM result:11/11 in Android build XML. `android-reminder-delivery.txt`: actual timed AlarmManager delivery/replay test.
- `android-normally-closed-*`, `android-reboot-*`, `android-timezone-clock.json`: actual separate lifecycle observations, including early negative windows and later positive observations. Inexact timing is not a guarantee.
- `android-v2-ui.txt` and `v2-*-ui-report.json`: actual bundled WebView forms/reminders. The earlier public-auth report's `passwordResetUiExecuted=false` is truthful for that initial two-test run; **the separately executed final** `android-recovery-ui.txt` / `v2-recovery-ui-report.json` proves actual reset completion, recovered login and single-use rejection in7.472s using fictional encrypted development delivery.
- `android-journey-ui.txt`, `checkout-report.json`: actual WebView order388, retry after committed response loss, explicit assignment/fulfillment and private cache isolation. Browser report separately proves UI order387.
- `android-packaged-app.txt`, `apk-integrity.json`, `apk-signature.json`: installed ordinary package constraints,46bundled asset matches,5icon density matches, no private config/test CA and same prior emulator signing certificate.
- `android-reminder-visual.txt`, `v2-native-*.png`: final sequential real system notification/app drawer capture; root visually confirmed generic Arabic notification and original logo. The false SystemUI accessibility text probe is not a delivery failure; actual NotificationManager content and visible PNG were inspected. Two logo entries are ordinary and isolated test packages.
- `browser/`: actual CUA UI screenshots/report, source JPEGs and lossless format conversions; independent successful post-fix Profile privacy retest.
- `comparisons/`:18unaltered-actual/reference boards covering all9user-supplied references. Font/raster/data/safety-label differences remain, not pixel-perfect completion.
- `canva-*.png`, `v2-reminders-*.png`, `v2-recovery-complete.png`: actual Android display captures,1080×2340. Android system bars and the existing connection banner occupy additional height compared with Canva. Root also directly inspected Android Home/Cart/Reminder form and recovery success. Browser comparison panels at360/393/430are the controlled equivalent-width visual evidence; native display images must not be mislabeled as those browser viewports.
- `knowledge-live.json`, `jordan-metadata.json`: actual fixed-host RxNorm import2international/0Jordan records and official Jordan dataset metadata investigation.
- `private-value-audit.json`, `image-integrity.json`: no matching actual private fixture/DB/reset values in candidate changes,84valid PNGs.

Red regression tests, initial migration-fixture omissions and bounded observation/capture errors remain for provenance. Only the named final positive logs establish the corresponding passed gate. No physical-phone, real-email, public hosting, clinical or real-sale acceptance was performed.

Public text logs have trailing spaces/extra terminal blank lines normalized for Git whitespace checks; commands, outcomes and failure evidence are retained.
