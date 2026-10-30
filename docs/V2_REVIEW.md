# V2 independent review and resolutions

A fresh-context read-only reviewer inspected actual tracked/untracked V2 runtime sources, including authentication, owner predicates/transactions, native account/intent validation, source imports/rollback and public review filters. This was a scoped engineering review, not an exhaustive security certification.

Two P2 findings were accepted and fixed:

1. Native reminder cleanup could reject before logout reached server revocation/cache finalization, or after login/password reset had already committed. Added account-lifecycle tests with native I/O failures. Logout now attempts server revocation and clears private queries regardless of native cancellation; local cancellation failures have separate truthful feedback. Login/signup require native cleanup before sending credentials. A committed reset always clears account queries and reports password success, while separately warning of any native cleanup issue. API-origin changes remain blocked until previous local alarms are cleared.
2. Shared reminder schemas accepted ISO control characters and pre1970 dates that native validation rejects. Added regressions showing both failures, then aligned server/client validation with Android and applied the date floor to date inputs. Native validation remains an independent final check.

Additional root review: delayed final-day alarms could post after the user-entered end date. The real Android regression was observed failing; a native date-range delivery guard was added. Its fresh Android result is recorded with the final runtime evidence, not inferred from compilation.

Earlier review also found and fixed duplicate public registrations for existing legacy users without local credentials, and a five-parallel-login pool deadlock caused by acquiring a separate admission connection inside credential transactions. Their failing/passing evidence is preserved under docs/evidence/v2.

No other P0/P1 was identified by the scoped reviewer. Actual verification still depends on the executed test/build/browser/native logs; static review alone does not establish a secure production deployment.

The actual browser pass found a previous customer's unsaved Profile draft remaining after logout and Back. Added two failing SSR regressions, then authenticated rendering, account-bound draft fields and persisted-history query invalidation. Both regression tests and an independent fresh-browser logout/Back/account-switch retest passed. No prior customer's draft or order appeared in the subsequent administrator context. See the browser evidence report for the original failure and successful retest.

Final full MySQL Vitest run passed 284/284 in44 files (130.19 seconds). Native expired-end-date regression passed in the nine-test Android suite. Actual generic notification, normal closure, reboot, and timezone/clock observations are recorded separately; neither a short observation timeout nor a capture accessibility probe was relabeled as a delivery success. Final sequential screenshot capture passed and its real system notification/launcher PNGs were visually inspected.
