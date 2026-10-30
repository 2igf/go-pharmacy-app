# GO Pharmacy Customer Experience V2 — execution plan

**Goal:** Implement the user's approved V2 scope on the existing platform, with measured visual and native evidence, without changing the phone service or existing data.
**Source:** Verified clean local1b8a82eb50d08911dbd2ee3fd2758d9d95cb786a; new branch feat/go-pharmacy-customer-experience-v2.
**Architecture:** Existing React/tRPC/Drizzle/MySQL/Capacitor. Add bounded customer-access, manual-reminder and read-only knowledge domains. Keep marketplace pricing, inventory and simulated fulfillment separate.

## Constraints / decisions

- No main/merge/push/deploy, no phone-tunnel interruption, no real sales/payment/consultations or future Health Profile tables.
- New isolated `go_pharmacy_test_v2` clone: original test and Demo databases are fingerprinted/read-only. Reset only the V2 clone. Migrations additive, journaled, tested there first.
- Public signup always persists role `user` (platform vocabulary customer); organization/professional/admin authorization remains independent. Optional legacy invite input retained for installed clients, not required by public signup.
- No configured mail provider found by metadata inspection. Real-provider interface plus encrypted/isolated development mail sink; no false email-sent claim. Reset tokens hashed, expiring, single-use, sessions revoked on reset; fixed reset origin, no caller redirects. Do not disclose tokens/passwords in logs/evidence.
- All supplied old/new Canva references are authoritative. New doctors image is visual reference only, not live doctors/ratings/fees. Logo from1000073150.jpg replaces Android branding without package/signing change.
- Banner configuration: source artwork only. Dozova is the only distinct supplied promotional banner; do not fabricate/duplicate offers. Implement carousel behavior/configuration and test multi-slide logic with clearly identified test fixtures; document missing second promotional artwork.
- Prefer native inexact reminders without privileged exact-alarm permission. A small app-owned Capacitor bridge may be used instead of the official plugin if necessary to guarantee bounded per-reminder recurring scheduling, boot/timezone/clock recovery, account cleanup and encrypted local cache without another background framework. Record the rationale and actual native evidence.
- Manual reminders are separate from disabled legacy clinical-reminder tables/routes; legacy data remains preserved and is never silently scheduled. Server definitions persist across reinstall. No prescribed dose/schedule inference.
- RxNorm non-proprietary API is the initial limited candidate. Country registrations/prices remain unknown unless authoritative source supplies them. JFDA automation pending technical/legal confirmation; support authorized structured import. No US record represented as Jordan-approved.

## Ordered implementation

- [x] A. Baseline/history/tooling, isolated DB clone,173-test baseline; preserve source DB fingerprints.
- [x] B. Public customer access, bilingual validation, recovery provider/tokens, login/network diagnostics. Protocol and actual native reset/login/replay verified; real mail provider remains an external configuration gate.
- [x] C. Additional Canva doctors/clinics, responsive refinements, original logo/adaptive launcher/splash, banner carousel and tests. Visual mismatches and missing font/vector/second artwork explicitly documented.
- [x] D. Owner-scoped manual reminders CRUD/history, server persistence, native notifications/permission/account lifecycle, timezone/boot/clock behavior; tests and real emulator evidence.
- [x] E. Normalized medication knowledge/registration/provenance models, validated/deduplicated adapter/import/rollback, limited lawful live ingestion, read-only bilingual UI. Source/license findings recorded; JFDA automation pending permission/current data.
- [x] F. Full regression/types/production build, visual comparisons360/393/430, Android Debug build/signature/assets, full simulated checkout/fulfillment, independent review and data-preservation audit.
- [x] G. APK and configuration/staging/update instructions, exact blockers/unverified items; delivery recorded as a local-only commit on the V2 branch, with hash provided at handoff.

## Review focus

1. Public customers must never become platform or organization administrators through payloads or headers.
2. Reset token replay/concurrency/expiry/rate limits and legacy sessions; no email enumeration or leaked secrets.
3. Reminders must clear stale schedules on account switch/logout, not log medication data or mark delivery as ingestion.
4. Source records must not acquire inferred Jordan registration/pricing/clinical approval; imports and recovery remain auditable.
5. Notification denial, inexact delays, force-stop/reboot/timezone changes and unavailable artwork/provider must be described truthfully.

## Execution ledger

Final ledger supersedes interim pending counts below: 284/284 tests in44 files,130.19s on separate go_pharmacy_test_v2regression; both TypeScript configurations pass. Production/web/Android assets/CSP/sync/Debug builds pass.11JVM,9native scheduler,2installed package,2native feature UI,1actual timed delivery,1native recovery completion/recovered-login/replay and1native checkout journey passed. Browser order387 and emulator order388 reached pharmacy ready/customer visibility.18comparison boards reviewed; all9references retained. Actual generic notification and launcher PNGs captured sequentially and visually inspected. Reboot/normalclose/timezone/clock observations preserve initial timing limits. Original28-table314-row test and18-table33-row Demo fingerprints unchanged. Recovery provider/physical phone/JFDA/font/vector/second-banner limitations are explicit in CUSTOMER_EXPERIENCE_V2_REPORT.md. No main/push/merge/deployment/phone-tunnel redirect.

- Original local source matched reported commit and was clean. Existing 3022/3443 test services are separate from phone service; do not redirect them as phone deployment.
- Created separate V2 DB with only an exact database grant to existing test principal; cloned28 tables/314 rows. Original databases remain untouched.
- User supplied five new JPGs, including doctors/clinics and authoritative square logo. No independent font export supplied.

- B: Migration0006 applied ONLY to V2 clone; 11MySQL auth tests+HTTP validation+6feedback tests passed. Public signup always roleuser; recovery encrypted devsink and unconfiguredmail truthfulness tested. Final B regression currently running.
- Review found legacy users without credentials could duplicate email: added failing test then fixed server check; old invitation integration fixtures now register a genuinely new allowed email instead of duplicating existing customer fixture. API manifest explicitly includes3additiveauthprocedures.
- C: copied all5newrefs and generated launcher/round/adaptive/splash from original1280JPG; preserved source hashes/crop coordinates. NoAIredesign.

- B review: a5-way parallel login regression failed (pool exhaustion from nested pool lookup). Changed membership admission to reuse credential transaction executor;12authMySQLtests pass. Preserves login/reset serialization without acquiring another pooled connection.

- B implementedandreviewed: publicsignup, recovery, truthfulemailconfig, fixedpooldeadlock and legacyduplicateemail. Focused12MySQL+HTTP+7feedbacktests. Full191run had3oldfixture/APIinventoryexpectationfailures, correctedand22regressiontestsgreen. Laterfull201run199passed2SSRtestharnessfailures whileCediting; SSRRoutercontextfixedand16focusedtestsnowpass. Finalfullrunpendingfreeze.
- C implementationcomplete: all5newrefs/directlogo densities+adaptive+splash; doctorspreview+single-real-artcarousel. Responsivevisual/nativecomparisonstillFpending, no pixelperfectclaim.
- D implementationcomplete:0007newmanualtables,31backendtests (inclDSTlastoffsetonly), UI+sync+logout/origincleanup. Native10JVMpass;8instrumentationactualpasswithnotificationdefaultdenied. AftergrantactualAlarmManagerDeliveryTestpassed32.808seconds. NormalcloseamkillPIDabsent; initial200sobservationnegative,laternativeinspectionpassedactivegenericnotificationandnextdayrecurrence. Evidencedelay,noexacttimingguarantee. Physicalphoneunavailableonlyemulator5580.
- E0008appliedV2only9tables,22focusedDBtestspass, reallimitedRxNorm161+202433import2records0JO. Additional0009appliedV2onlytoactuallyrepresentmanufacturer/form/route/package/prescription/media/datefacts and description/interactionswithoutrewriting0008. Awaitingagent9DBverification.
- BuildinterimDAndroidproductionbundle+capsync+Debug/testAPKs succeeded; usesGO_ANDROID_WEB_DIR=.local/v2/android-public soold3022distassetsuntouched. FinalAPKmustberebuiltwithEandlatestDcleanup.
- All0006/7/8/9 migrationsONLYV2; originaltest/Demofingerprintsprivate .local/v2/protected-before.json. OriginalTLS/phonecheckouts/runtimesunchanged. Nativeonlyordinaryemulatorappupdated-rforQA.

- Finalindependentreview2P2: nativeclearfailurecouldblockserverlogout/committedauthfinalization; sharedremindervalidationacceptedISOcontrols/pre1970datesrejectednative. Added4lifecycleRED→GREENtests and2parityRED→GREENtests; logincleanupbeforemutation/logoutserver+cachealwaysfinalized/resetcommittedoutcomehonest; shareddates1970floor+namecontrolreject; finaltypes/fullregressionrerunning.
- Fullregressionprevious275/41pass97.59s; addedknowledgefactsUItest7/7green. Finaltotalexpected282butmustreadactualresult. Nativeenddateexpired-deliverytestobservedRED; rootaddeddate-rangeguard, pendingGREENrealAndroid.
- InterimDebugAPKandtestAPKinstalled-r onemulator5580, 8native+1actualdelivery+normalcloseactualinspectionpassed. ScreenshotactualnotificationshowsgenericArabicbody, captureharnessAXassertfailed(rootactivewindowsearch; changedtoallwindows, pendingretest). EvidencePNGexistsv2-native-notification-drawer.png; launcherPNGmissinguntilretest.
- DedicatedV2clone restored308nonjournaloriginalrows; migrationjournal10rows preserved. LiveRxNormimport2recordsrerun; seedV2newfictionalsupply+inventory20created .local/v2/fixture.json aftercorrectflatpharmacies.minecontract. FinalfullregressionwillresetV2again: restoreclone, archiveoldfixtureandreseedoradjustseedguard, rerunliveimportbeforebrowser/nativeUI.
- PrivateV2start-web.mjs port3023 static .local/v2/web-public, start-tls.mjs3445+3446 isolatedCA andresponse-lossmarker .local/v2/fail-next-checkout readyNOTSTARTED. No old3022/3443/phonechange.
- Buildassets .local/v2/build-assets.mjs writesdocs/evidence/v2/build-*.txt, runsviteweb/serveresbuild/viteandroid/CSP/capsync withisolateddirs; firstallpass butsmallmin-attributefixneedsfreshfinalassets. NativeGradlefinalDebug/test+checkoutTestpending. Appversionbumped2/1.1.0-beta.2 keepingpackage/name/signing.
- SourcechangesallB-Eimplemented; finalworkremainingFbrowser6nav/360393430visual/checkoutfulfillment, AndroidWebViewCustomerV2JourneyTest+CheckoutJourneyTest (newpublicsignupassert and wrongHostOrigin3446 patched), packageassets/signature/evidence; native9testsGREEN/reboot/timezoneclockifpossible; finaldatafingerprintaudit/report/gitcommit. No physicalphoneorrealemailprovider/noadditionalbanner/fonts/Canvavectors.
