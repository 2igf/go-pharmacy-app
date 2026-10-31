# Customer acceptance V1

Scope: execute the user's customer MVP acceptance specification without redesign, medical activation, original database migrations, or phone service replacement.

- [x] Verify clean baseline 33adca0; branch feat/customer-feature-acceptance-v1.
- [x] Restore existing local MySQL and V2 backend only with explicit user authorization; preserve original API build.
- [x] Create go_pharmacy_test_acceptancev1 from test schema only (42 tables, no customer rows copied).
- [x] Audit routed customer controls and document API/asset dependencies and inactive services.
- [x] Fix profile phone HTML validation and private-data rendering guards; expose existing settings destinations, without inventing translation support.
- [x] Execute full isolated Vitest, both TypeScript configurations, production and Android build.
- [x] Verify emulator Android journey and browser public surfaces. Physical beta.4 acceptance remains open, explicitly documented.
- [x] Deliver Arabic phone acceptance checklist, exact gaps, artifact and verification evidence.

Review focus: Arabic phone input; stale account cache after logout; backend compatibility; no native reminder changes; no new HTTPS endpoint without approval.
