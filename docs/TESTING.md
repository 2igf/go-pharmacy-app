# Testing

## Commands

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:types
pnpm test
pnpm build
pnpm audit --json
```

Type checking covers application code; test:types separately checks tests, fixture helpers and operator scripts. The existing repo had no ESLint configuration, so no invented lint-success claim is made. Formatting is not a substitute for lint or tests.

Database suites explicitly require TEST_DATABASE_URL. Create a new database named `go_pharmacy_test` or `go_pharmacy_test_<suffix>`, point DATABASE_URL to it temporarily to apply migrations, then restore the app URL and set TEST_DATABASE_URL for `pnpm test`. Test config routes DATABASE_URL to TEST_DATABASE_URL and never falls back to the app database. Fixtures delete tables in FK-safe order only after the database name and URL guard passes. Never point test tools at valuable data. Tests run files serially to avoid fixture races.

Coverage includes cross-user cart mutations/notification mutations/orders/addresses, ordinary-user admin denial, medical gating, password verification and invitation binding, logout/expiry, decimal precision and quantity/total limits, checkout replay, concurrent overselling, rollback after stock decrement, changed basket rejection, order persistence and cancellation replay. HTTP tests start actual loopback Express servers for CSRF, headers, API exposure, authentication and request limits.

Legacy doctor/reminder success tests were updated to assert the documented Beta gate; those features were intentionally disabled, not silently counted as operational. Original database tests now use deterministic disposable fixtures. Conditional empty-catalog checks are supplemented by meaningful integration assertions.

## Browser smoke

With a seeded disposable demo database and invited accounts: follow INVESTOR_DEMO.md. Verify keyboard focus/escape on the product dialog, required fields, empty/loading/error states, mobile-width layout and Arabic RTL. Check registration with a wrong invitation, wrong password, out-of-stock product and restricted product. Use a second browser session for another customer and attempt direct foreign IDs through the API tests. Screenshot evidence alone does not prove transaction or authorization behavior.

Run the complete suite after final code edits. Record command, exit code and pass/fail/skip counts in IMPLEMENTATION_REPORT.md; skipped database tests do not satisfy release criteria.
