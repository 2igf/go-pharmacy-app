# Future optional health profile integration — design only

No Health Profile, diagnoses, chronic-condition history, allergies, documents, medical AI, dose recommendations or adaptive-treatment tables are implemented in V2.

The manual reminder domain owns user-entered schedules and user-reported taken/skipped events. The native device cache contains only minimal notification definitions; the central medication knowledge domain contains public source material. Neither domain needs a health history to operate.

A future health-profile module must be separately approved, purpose-limited and consent-based. A customer may elect to link a reminder to a future profile record using an additive, owner-authorized relationship; existing independent reminders must continue working. Do not collect empty health records or speculative sensitive fields in advance.

Future integration must define granular consent, owner-only access, retention/export/deletion, encryption and audit policy, qualified clinical review, and a threat model before storage begins. Pharmacy/driver organization membership must never imply access to a customer's personal health profile. Any authorized professional access requires a separately reviewed, explicit patient-care relationship and revocation policy.

Reminders must remain manually configurable. Profile changes or knowledge-base imports must not silently change schedules, doses, missed-dose times, or record adherence. A delivered notification is never evidence of ingestion. Any future clinical decision support requires its own scope, validation, qualified oversight and explicit approval; V2 introduces none.
