# GO Pharmacy MVP implementation plan

Goal: stabilize the existing application for fictional, invitation-only simulated orders.
Architecture: retain React, Express, tRPC, Drizzle and MySQL; add portable local authentication, transactional commerce, server authorization, and a bounded Beta interface. Existing unfinished medical source remains preserved but inaccessible.
Spec: the user-supplied GO Pharmacy Complete MVP Stabilization request (2026-10-26).
Execution: autonomous inline execution explicitly requested; no design-approval pause, no merge or public deployment.

## Global constraints
- Dedicated branch; main unchanged. No real sales, payments, dispensing or patient data.
- No schema data deletion; migrations must stop on incompatible existing data.
- Use pinned pnpm 10.4.1 and existing dependencies where feasible.
- Readiness depends on measured tests, real MySQL integration and browser flow.

## Tasks
- [x] Inspect repository, configuration, existing API, schema, UI and tests; record baseline.
- [x] Security: add local password/session auth and allowlist, CSRF/request controls; regression tests before fixes for ownership, protected/admin access and medical gating.
- [x] Commerce: exact decimal arithmetic, validated cart mutations, locked transactional checkout, persistent idempotency, reversible cancellation and status rules; test stock races and rollback on real MySQL when available.
- [x] Database: additive auth/commerce fields, safe relational constraints and indexes, preflight validation, migration and fictional seed tools.
- [x] Interface: complete existing catalog/cart/checkout/tracking, login/account/admin pages, remove fabricated statistics and gate unfinished routes; preserve colors/RTL.
- [x] Verification: TypeScript, entire test suite, production build, dependency audit, HTTP smoke and browser flow; self-review and fixes.
- [x] Release: accurate README, scope/architecture/security/deployment/testing/demo/limitations and final evidence report; draft PR only if remote write permissions exist.

## Review focus
Concurrent cart edits versus checkout; duplicate retries after cart clear; stock changed after quote; prescription flags changed before checkout; cancelled order replay must never restore inventory twice. Legacy orders must not be represented as Beta simulations. Passwords/session tokens must never appear in API output or logs. Missing DB must be an error rather than an empty successful catalog.

## Progress
Baseline main: d9a383e55882aa7fdfd29711976ef1e7005faa53. Branch feat/go-pharmacy-investor-mvp. No repository AGENTS.md or README present. GitHub connector pull=true, push=false.

Final: 71/71 real-MySQL-backed suite, app/test types and production build passed. Browser workflow and 390/1366 RTL verified. Backup/restore and dirty legacy preflight validated. Draft PR blocked by push=false; local review artifacts supplied. Broader security coverage, Docker and hosted HTTPS remain explicitly unverified; no merge/deploy performed.
