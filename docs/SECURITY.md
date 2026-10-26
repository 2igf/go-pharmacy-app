# Security and Beta operating boundaries

## Implemented controls

- Protected procedures require authenticated context; administration checks the database role server-side.
- Cart/order/address/notification operations scope access to the acting user. Unknown and foreign records do not return other users' data.
- Patient/clinical API modules are fail-closed for every role. Prescription flags are independently enforced in cart mutations and locked checkout.
- Salted scrypt password hashing, cryptographic random session tokens stored only as hashes, eight-hour expiry, server revocation on logout, HttpOnly/SameSite=Lax cookies. Production cookies are Secure.
- Email allowlist defaults closed. Per-email invitation code is required to register. Codes are operator-delivered; email ownership is not independently verified. Rotate BETA_INVITE_SECRET to revoke unconsumed codes; existing account credentials are unaffected. Remove a participant from BETA_ALLOWED_EMAILS to block current sessions and login.
- No public role-change or password-reset endpoint. The CLI creates a new admin only with explicit confirmation and strong password. No development impersonation, JWT fallback or upstream account auto-sync is active.
- API writes require exact APP_ORIGIN, JSON content type and non-cross-site Fetch Metadata. No permissive CORS. Auth cannot be batched; general batches are capped at 10. Limits: 300 API requests/minute/IP; 20 authentication requests/15 minutes/IP.
- Explicit trusted proxy IP/CIDR only; no trust in arbitrary forwarded HTTPS headers. Development binds loopback and retains host validation.
- Body cap 64 KiB; bounded strings/IDs/quantities/prices; generic internal errors and no stack traces. Logs contain request ID, method/status only.
- Production CSP, HSTS, frame denial, no-sniff, no-referrer and disabled device permissions. Uploaded product files are not accepted; optional images require HTTPS URLs.

## Operating requirements

Use HTTPS and a private durable database with least-privilege application credentials. Use a separate migration operator for ALTER/CREATE privileges. Stop writes for migrations, back up first, and verify restore. Run a single application process until rate limiting is backed by a shared store. Enforce proxy body/time/rate limits as well. Clear expired session rows periodically with an operator query; expiry is enforced even if cleanup has not run.

Never send actual patient information, card details or medication orders into this Beta. Names, addresses and phones in demonstration flows must be fictional. Use private channels for invitation/password delivery, avoid recording the login form, and protect .env/.local with operating-system permissions. Windows file modes alone are not an ACL guarantee.

## Review limits

Source review and negative tests reduce risk; they are not a penetration-test certification. Legacy external-service helpers remain as inactive source. Dependency findings and the exact final verification state are recorded in IMPLEMENTATION_REPORT.md. Do not interpret a passing unit suite as production acceptance.
