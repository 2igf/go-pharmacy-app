# V2 browser UI validation — 2026-10-30

Actual UI actions ran through CUA in a dedicated Chrome tab against `http://localhost:3023`, the isolated V2 local test server. This report does not assert Android, physical-phone, hosted-backend, real email, medical adherence, real sales, or production acceptance. No production source, database schema, credentials, server process, or original database was changed by this browser task.

## Result

The fictional customer-to-pharmacy fulfillment journey passed. Browser order **387**, product **27**, quantity **1**, total **0.10 JOD**, was created using a fictional saved address, fictional recipient, and Arabic-Indic test phone. Administrator enrollment and assignment to organization **95** were explicit UI actions. Authorized staff accepted, prepared, and marked the order ready; the customer then saw **جاهز للتوصيل التجريبي** and the assigned pharmacy.

One post-logout UI privacy issue was reproduced and reported to the root engineer, then fixed and independently retested on the rebuilt UI. All recorded browser gates now pass; the original failure evidence remains for provenance.

## Verified UI behavior

- Login at 360, 393, and 430 pixels; empty login yields the bilingual email validation message. Registration displays ordinary customer fields without an invitation field. No account was created by this browser task.
- Recovery request for an unknown fictional `example.test` recipient reports local development mode and explicitly says no real email was sent. The reset form rejects an empty recovery code. No password or reset credential was entered or changed.
- Home, Discovery, doctors preview, and populated Cart at all three requested widths; all six customer navigation links are present. Doctors booking opens the truthful unavailable-service dialog.
- Single approved Dozova artwork is visible, opens `/products?view=all`, and has no multi-slide next control. No multi-slide autoplay claim follows from this single-artwork configuration.
- Invalid short checkout phone produces the Arabic field error. Arabic-Indic phone succeeds for the fictional order. No response-loss marker or direct API mutation was used.
- Customer is denied administrator pharmacy data and has no authorized partner operational membership. Administrator pharmacy list and authorized staff inventory both load through the UI.
- Manual reminder **162**, named `Browser V2 fictional reminder`, was created and edited. A keyboard change committed its actual time to **11:42 Asia/Amman**. After that real minute elapsed, the UI accepted one explicit fictional user statement and displayed **أفاد المستخدم بأنه تناوله** with its user-reported provenance. Pausing retained the history and disabled further occurrence choices. The delete confirmation was inspected and canceled. The reminder remains **paused**.
- Browser reminder settings explicitly report that local notifications work only in Android and that no browser notification was scheduled.
- Jordan knowledge scope returns zero locally verified records with an explanatory empty state. International scope returns the two actual imported source records. The acetaminophen detail exposes source identifier 161, source version, local version/import times and source links; Jordan registration, Jordan price, availability and unsupported product facts stay unknown. Arabic and English reference-language selection works without invented translation or medical text.

## Resolved finding: previous profile name after logout and Back

Reproduction: authenticated customer profile → normal logout → login screen → browser Back. The restored `/profile` page shows the previous customer's name in the editable name field, despite the account email/role being empty and orders/addresses being removed. A second full accessibility read confirmed this was not a transient loading frame. See `logout-back-profile-leak-360.png`.

The original `client/src/pages/Profile.tsx` copied name/phone only when `user` was truthy and rendered the local form unconditionally. History restoration retained that component/form state without rerunning the authentication redirect effect. The root engineer subsequently added an authentication/loading gate, account-bound draft fields and history-restoration invalidation. This browser task made no source repair.

Independent actual-browser retest at **360×640** used a **fresh tab** loading rebuilt asset `/assets/index-BPbIb3LN.js` at **2026-10-30 08:54 UTC**. The authenticated customer profile was given an unsaved fictional name draft and unsaved fictional address draft, without saving either. Normal logout reached Login; browser Back returned to `/login`, with **zero** profile-name fields, **zero** address-draft fields and neither draft text present. See `logout-back-profile-fixed-360.png`. This closes the reproduced finding.

A subsequent switch to the distinct fictional administrator account displayed the administrator's correct profile name, an empty address draft and no customer order 387 or prior customer draft. See `account-switch-profile-fixed-360.png`. The administrator was logged out afterward, and the temporary viewport override was reset. Order 387 and paused reminder 162 were not modified by this retest. The root's reported unit/SSR tests are separate evidence; this paragraph records only the browser retest actually performed here.

## Images and measurement limits

`browser-report.json` records each source URL, requested width, actual browser inner/client/scroll dimensions, PNG dimensions and SHA-256. The **15 core images** are `login`, `home`, `discovery`, `doctors`, and `cart` at widths **360 / 393 / 430**. Additional images document the new flows and authorization boundaries.

All captured document measurements had `scrollWidth <= clientWidth`; no page-level horizontal overflow was detected. Screenshots were visually inspected for layout and content. The 430×764 requested viewport produced 430×763 captures due to browser rounding; administrator/staff screens with a scrollbar captured 415×737. These are recorded as actual dimensions, not relabeled as exact requested pixel output. Some long forms require normal vertical scrolling, and viewport captures deliberately preserve that behavior.

CUA returns JPEG screenshots. PNGs are lossless format conversions of those captured JPEG bytes using the bundled Pillow runtime; no retouching or generated replacement content was applied. Original JPEGs remain beside the PNGs. Transient CUA capture/input timeouts were recovered using fresh state and documented accessibility clicks. A direct time-field value assignment initially changed the displayed control without committing React state; a real keyboard increment then saved the intended time and the persisted detail was checked. This was treated as an automation interaction limit, not asserted as an application bug.

At handoff the temporary viewport override was reset and the fictional customer browser session was logged out. Only order 387 and paused reminder 162 with its fictional statement were created by this task. Original databases, previous local servers, phone HTTPS service and native QA ownership remained outside this browser task.
