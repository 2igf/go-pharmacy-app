# Customer access V2 — configuration and test boundary

Public registration accepts no invitation for ordinary customers. The server always writes `users.role=user`; supplied roles, user IDs, organization privileges and verification claims are rejected. Existing invitations are retained and validated only when older clients supply them. Existing accounts are not re-registered or overwritten. Email uniqueness is checked against credentials and legacy users.

Email is explicitly **unverified**; V2 does not pretend that signup verifies ownership. No privileged onboarding is opened by public registration. Existing opaque, HttpOnly, Secure native sessions, native HTTPS origin checks and organization authorization remain in force.

## Recovery configuration

- `RESET_WEB_ORIGIN`: fixed, trusted HTTPS **origin only**, without credentials, paths, query or fragment. A local HTTP loopback origin is accepted exclusively under NODE_ENV=test. No caller redirect or Host/forwarded header chooses the link.
- `RESEND_API_KEY`, `CUSTOMER_RESET_EMAIL_FROM`: configure a real authorized Resend account and verified sender. Keys stay in server environment, never Vite variables/APK. No credential is configured or sent by this work.
- Without provider + valid origin, the request returns `delivery=unavailable`; UI explicitly says no email was sent.
- Real provider channel acceptance is not a delivery guarantee. The UI uses conditional account-independent wording; asynchronous provider failures are sanitized and invalidate the undelivered token.
- Isolated local test only: `CUSTOMER_RESET_MAIL_MODE=development`, NODE_ENV=test/development and `CUSTOMER_RESET_DEV_DIR` strictly below `.local`. Only example.test recipients. AES-GCM envelopes and a separate local key replace outbound mail. No token/password/recipient appears in public evidence or logs. Do not expose this directory through static serving, upload or commit it.

Links use `/login?mode=reset#token=...`; fragments avoid HTTP request logs and are removed immediately from browser history. Android can accept the code manually within its trusted bundled UI. No arbitrary deep-link intent or redirect handler was added. Reset tokens are random256-bit values, SHA-256 hashed in MySQL, expire after15minutes and can be consumed once under a credential row lock. Successful reset invalidates every outstanding reset token and all account sessions. Login uses the same lock, preventing a stale password from issuing a session after reset.

## Abuse and operational limits

The existing HTTP edge limiter remains; additional bounded per-IP/per-identity limits cover direct procedures. IP authority follows existing explicit Express trusted-proxy configuration, never caller headers. No account-specific lookup occurs before the reset channel response. Invalid credentials/missing account use one privacy-preserving message.

Limits and the bounded two-worker recovery queue are single-process and non-durable. Process restart can lose pending delivery; configure shared rate limiting and a durable delivery queue before scaling. Do not retry by logging tokens or bypassing verification. The queue has a64request cap and transport timeout.

## Migration0006

Adds `customerAccounts` and `customerPasswordResets`, indexed and FK-constrained; no change to existing users/credentials/orders. Applied ONLY to `go_pharmacy_test_v2`. Migration requires existing migration preflight and exact target confirmation. Existing Demo/test databases are fingerprinted and untouched.

Before applying elsewhere: stop writes; take an encrypted full database backup including migration journal; verify restoration to a different database; run preflight against the explicit target; review0006; obtain authorization for original data. MySQL DDL is not transactional: if partially applied, stop and inspect table definitions and journal. Restore the verified backup into a new database and test before switching; do not automatically drop tables, delete users or edit old migration hashes. Keep old APK/backend paired until schema/backend updates are explicitly approved.

## Evidence

`docs/evidence/v2` contains baseline and focused/full logs. The dev sink proves the recovery protocol on fictional accounts and the isolated DB, not real email delivery or recovery on the user's physical phone. Phone HTTPS service and original databases were not migrated or redirected.
