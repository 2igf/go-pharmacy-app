# Customer Canva restoration implementation plan

**Goal:** Restore the customer surface from the four supplied screenshots without changing API contracts, database, commerce or security.
**Architecture:** Keep React routes/hooks and existing mutations. Add a customer-only shell, scoped CSS, shared product imagery/cards and six-item navigation. Keep the existing administration layout and Partners styles outside the customer scope. Use screenshot-derived assets with explicit provenance; never infer a product image from an unrelated catalog item.
**Source:** Verified clean latest local HEAD 6e3d11877b18a13656d7638c2ce0aeef12d8438b. New branch feat/customer-canva-ui-restoration-v1.
**Spec:** User's four attached Canva JPGs and restoration request (authoritative; no alternate design requested).

## Constraints and decisions

- No backend/schema/auth/checkout contract changes; no main/push/merge/deployment/phone tunnel modification.
- No original independent font, logo/vector/icon/photo exports found. Extract raster elements from supplied JPGs only, exclude Canva editor/status chrome. Record source coordinates and missing files.
- Catalog, totals, addresses and order states remain API-derived. Screenshot medicine art may only be associated with an explicitly matching catalog identity; otherwise show an honest missing-image state.
- Unsupported medicine, clinic, scan, consultations, payment and reminders keep their visual positions, with unavailable explanations. No simulated sales metrics.
- Existing checkout idempotency, validation and ambiguous request recovery remain unchanged.
- Tests that reset the dedicated test DB require stopped task writers, a new private snapshot and verified restore. Never reset Demo.
- Work in the existing separate foundation checkout/new branch, preserving the separate old phone checkout.

## Tasks

- [x] 1. Audit/crop all references and assets; record missing sources, dimensions and retained historical baseline screenshots. Back up current dedicated test DB and run baseline checks.
- [x] 2. Restore customer shell/navigation, login, home and discovery with scoped CSS and real API data. Add focused behavior tests for safe image mapping/filtering and all six route destinations.
- [x] 3. Restore cart/address/total presentation and checkout styling without altering submit/retry rules. Preserve unsupported controls as explicit unavailable states.
- [x] 4. Capture browser screenshots at equivalent reference aspect ratios; create side-by-side comparisons, inspect and correct layout differences. Verify functional login/search/cart/addresses/checkout and admin/Partners regressions.
- [x] 5. Run full Vitest, both TS checks, production build, Capacitor sync, Debug APK build and actual Android WebView journey/layout. Restore and verify all pre-existing test records; confirm unchanged protected source paths and normal APK trust.
- [x] 6. Self-review plus fresh final reviewer, document exact discrepancies, evidence, files and APK, commit locally only.

## Review focus

- Narrow mobile widths/large text and safe areas must not overlap the fixed six-item bar.
- Same-document account switching must not expose cached cart/order/address data.
- Prescription/out-of-stock items must stay server-protected; original artwork must not mislabel a fictional product.
- Partner/admin login remains usable and their layout remains unchanged.
- Saved pending checkout must retain its original UUID and canonical phone behavior through the visual changes.

## Execution ledger

- Inspection: clean source, complete history verified, no newer local commit found. Four raster JPGs supplied; public asset directory previously empty. Original fonts/source exports missing.
- Ruling: execute the detailed supplied design directly; no redesign alternatives or further design approval needed. Use current stack without dependencies.

- Completed:31 original raster crops +4 app-only references; no independent original fonts/vector/photo exports found in all3 local checkouts or either source archive.
- Baseline168/31, final173/32 real MySQL tests passed. Both reset runs backed up/restored/compared28 tables; final preservation239 original rows and18 unchanged Demo fingerprints.
- Fresh review P1 cached address/whole-quote gates, P2 full-catalog action and phone text floors corrected; RED/GREEN5 presentation tests. No final concrete review blocker.
- Browser21 observations passed, widths360/393/430 checked. Four side-by-side comparisons inspected. Historical versioned screenshots retained; no fresh pre-edit runtime screenshot is claimed.
- Final Android native journey1/1 in53.135s, order200 ready, same-key response-loss recovery, RTL/six-item nav/cache ownership. Ordinary package2/2; actual80 archive hashes matched, normal trust unchanged.
- Ruling: final screenshots include live fictional API records and necessary safety controls; pixel-perfect identity cannot be claimed without original font/source assets and matching authorized catalog content. No counterfeit catalog data or replacement stock imagery introduced.
- Presentation corrections after the full suite were CSS, a native toolbar data attribute and compact address display with link to unchanged full management; both TS checks and final production/native builds/journey were re-executed.
- Phone hardware untested. No main/push/merge/deployment/tunnel change/migration. Commit locally with evidence.
