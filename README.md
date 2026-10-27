# GO Pharmacy — Private Beta simulation

Existing React/TypeScript/Express/tRPC/Drizzle/MySQL application, stabilized for invited fictional-data testing. **No real medicine sales, payments, patient records, consultation, dispensing or delivery.**

## Android debug application

This branch also packages the MVP interface locally with Capacitor 8.5.3 as `com.gopharmacy.beta`. See [Android build, Studio, installation and HTTPS configuration](docs/ANDROID.md). The APK keeps Express/MySQL external; the current loopback HTTP demo cannot serve a phone. Without a configured reachable trusted HTTPS backend, the installed Arabic connection screen is available but login/catalog/orders are not connected. No cleartext or certificate bypass is included.

## Quick start

Requires Node 24, the package manager pinned in package.json, and MySQL 8.4 with a dedicated empty UTF-8 database. Copy `.env.example` to `.env`; replace every placeholder. Set `BETA_ALLOWED_EMAILS` and a cryptographically random `BETA_INVITE_SECRET` of at least 32 characters. Never use a `VITE_` variable for secrets.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm seed:beta
pnpm invite:create
pnpm dev
```

Before `seed:beta`, set `CONFIRM_FICTIONAL_SEED=yes` in the private local environment. Before `invite:create`, set `INVITE_EMAIL` to an allowlisted email. The invitation goes to gitignored `.local/invitation.json`; distribute it privately. Register at `/login` with the email and its code. `PRIVATE_BETA` defaults to enabled; an empty allowlist fails closed. Registration always requires an invitation code, even when `PRIVATE_BETA=false`.

Create an operator account using `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD` of at least 16 characters, and `CONFIRM_CREATE_ADMIN=yes`, then run `pnpm admin:create`. Remove the password/confirmation immediately afterward. No privileged account or password is seeded. Existing accounts are never silently promoted.

`NODE_ENV=development` enables local Vite. `HOST=127.0.0.1` is the default. Use exactly the origin in `APP_ORIGIN` (127.0.0.1 and localhost are different origins).

## Checks and builds

```sh
pnpm check
pnpm test:types
pnpm test
pnpm build
```

Database tests require `TEST_DATABASE_URL` pointing to a **disposable** database named `go_pharmacy_test` or `go_pharmacy_test_<suffix>`. Apply migrations to that database first. Fixtures delete records only after that name/URL guard passes. They never use the ordinary app database by default. Without the variable the database suites are explicitly skipped, which is not database verification.

For the compiled server, set `NODE_ENV=production`, a real HTTPS `APP_ORIGIN`, the database and invitation settings, then `pnpm start`. HTTPS termination/reverse proxy is the operator's responsibility. See deployment instructions before exposing any port.

## Documentation

- [Scope](docs/MVP_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Deployment and recovery](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
- [Investor demonstration](docs/INVESTOR_DEMO.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Implementation evidence](docs/IMPLEMENTATION_REPORT.md)

No merge or public deployment is performed as part of this delivery. Read the evidence report for the measured release verdict.
