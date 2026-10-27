# GO Partners — local controlled testing

## Prepared Windows workspace

Project:
`C:\Users\Issax\Documents\Codex\2026-10-26\files-pasted-by-the-user-go\outputs\go-pharmacy-foundation`

Use branch feat/go-partners-pharmacy-portal-v1. The prepared runtime binds only
127.0.0.1:3022 and uses go_pharmacy_test, never go_pharmacy_demo. Its final browser
origin is **http://localhost:3022**, separating its cookies from older127.0.0.1
applications. It is a local web test server, not an Android HTTPS endpoint.

- Portal: http://localhost:3022/partners/pharmacy
- Login: http://localhost:3022/partners/login
- Administration: http://localhost:3022/admin/pharmacies
- Existing customer catalog: http://localhost:3022/products

Named fictional accounts and generated passwords are in the local private file
`.local/partners/browser-users.json`. They are not committed or printed here.
browser-fixture-summary.json in evidence contains only non-secret IDs/test emails.
Use the admin account for governance, ownerA/staffA for Pharmacy A, ownerB for B,
viewer for read-only, dual for authorized context switching, and customer for
negative route tests. A separate suspendedMember fixture demonstrates revocation.

The already prepared private launcher reads the local test connection and these
fixtures. To start it after stopping an existing instance, run from the project:

```powershell
node .local/partners/start.mjs
```

Do not start a second instance on the same port. The existing process/state is
recorded in .local/partners/server-state.json. Inspect its command line/start time
before stopping it; do not stop MySQL, the older3017 app or3018 tunnel backend.
The launcher is workspace-specific private test setup, not a production service.
No auto-start service, global environment variable or public tunnel was added.

## Manual acceptance path

1. Sign in as fictional admin and open /admin/pharmacies. Inspect application,
   choose a supported next state, enter a reason and confirm. Own applications
   cannot be approved. Approval does not activate memberships.
2. Explicitly provision an existing account ID and appropriate membership role/
   status. Active status requires an approved organization. Reading member records
   additionally requires the admin's own active owner/manager membership.
3. Sign out and sign in as its owner/staff. Select the authorized pharmacy, open
   inventory and choose a registered/catalog product. Review the actual stock/
   version, enter a delta/reason and confirm. Owners/managers can inspect audit.
4. Try viewer/customer/suspended accounts and a foreign ?org selector. They must
   not receive operational data or unsupported actions. Test cases use fictional
   accounts; never treat the local fixtures as real provider approvals.
5. For a conflict, refresh and review a new change. For an ambiguous failure use
   the saved same-request retry; do not invent another UUID for that attempt.

## Automated checks

Use Node24 and pinned pnpm10.34.5. Configure TEST_DATABASE_URL privately to an
authorized disposable test database with migrations0000..0004, then run:

```powershell
npx --yes pnpm@10.34.5 check
npx --yes pnpm@10.34.5 test:types
npx --yes pnpm@10.34.5 test
npx --yes pnpm@10.34.5 build
```

**Existing integration fixtures reset their dedicated test DB.** Do not run the raw
suite against a populated database whose rows you need without a verified private
backup/restore process and stopped writers. This task performed that preservation
process twice, restored originals, then added browser fixtures. Re-running the
suite unguarded would remove those extra fictional portal accounts as well.
Never use the Demo URL as TEST_DATABASE_URL. No new migration is needed for this
portal; migration0004 safety remains in PHARMACY_MIGRATION_V1.md.

Android compatibility was checked with the installed SDK/JDK21 via the existing
build-android.ps1. The build output remains local; no APK was published or phone
update performed. Android Checkout validation remains unresolved.
