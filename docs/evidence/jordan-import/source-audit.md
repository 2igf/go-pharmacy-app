# User-supplied Jordan catalog source audit

The primary input is the CSV member of the user-supplied ZIP. The ZIP and workbook were read without modification. The audit uses Python standard-library CSV, ZIP, XML and Decimal readers. No package installation, workbook authoring, database access, application change or network request was performed by this audit.

All four accompanying documents were read as untrusted source descriptions. Their authority and quality claims were not adopted as independent verification. The dataset contains 1,000 product rows and 38 columns, representing 752 exact trade-name strings or 748 trade names after whitespace and case normalization. It does not establish 1,000 distinct brands. There are 309 exact generic-name strings and 188 exact therapeutic categories.

## CSV and workbook reconciliation

Every one of the 38,038 CSV header and data cells was compared with the `products_1000` OOXML sheet. Fourteen cells differ only in equivalent decimal representations. Fifty-one public-price cells have strict Decimal differences caused by numeric serialization precision, with maximum absolute difference `0.0000000000001`. Each strict difference, coordinate and exact numeric value is retained in `validation.json`. Using the disclosed absolute Decimal tolerance below `0.000000000001`, there are no material differences. The CSV remains primary. No formulas or extra nonempty cells outside the CSV extent were found on that sheet.

## Identity and completeness

All 1,000 product IDs are unique. There are no duplicate nonempty barcode values and no duplicate case/whitespace-normalized `(trade_name, strength, dosage_form, package_size)` combinations. Those checks do not prove pharmaceutical equivalence or regulatory registration.

There are no structurally rejected product rows under the audit's nonclinical import requirements. One strength is missing (`JO-MED-0761`) and remains missing with a warning. Every other required identity, package, source-date and public-price field is populated. Missing optional values are retained as missing. Field-by-field counts and warning IDs are in `validation.json`.

## Barcode and ATC handling

There are 881 nonempty barcodes and 119 missing values. The length distribution is four values of length 7, four of length 12, 812 of length 13 and 61 of length 14. Of the supported GTIN lengths, 875 pass GS1 check-digit arithmetic and two fail (`JO-MED-0186`, `JO-MED-0927`). Four seven-digit source identifiers are preserved as internal identifiers with warnings (`JO-MED-0089`, `JO-MED-0127`, `JO-MED-0662`, `JO-MED-0664`). No barcode is synthesized, padded, corrected or treated as independently assigned by GS1.

There are 997 populated ATC values and three missing (`JO-MED-0111`, `JO-MED-0147`, `JO-MED-0293`). Twenty-two raw values include trailing whitespace. All 997 populated values satisfy hierarchical ATC lexical syntax after outer whitespace trimming. The trimmed lengths are two at level 3 (length 4), 27 at level 4 (length 5), and 968 at level 5 (length 7). No current authoritative ATC lookup or ingredient/formulation mapping was performed.

## Price, prescription and clinical boundaries

Every public price parses as a finite, nonnegative Decimal. The range is JOD 0.07–737.36. All 1,000 source price years are 2021 and all source dates are `2021-02-28`. All source preparation dates are `2026-08-27`. These are source assertions, not current-price checks. All hospital prices are empty. Prescription and availability fields on all rows require verification. No live inventory, current price or legal prescription classification was verified.

Clinical content is unreviewed and excluded from the normalized nonclinical row artifact. Source URLs and label dates may remain as provenance only. The source claims 729 labels found but only 718 rows contain a label source URL; 11 label-found claims lack a URL and are flagged. A source formulation mismatch was observed for `JO-MED-0001` and requires qualified review. This is one observed issue, not an exhaustive clinical assessment. No clinical excerpts are reproduced in this report.

## Mapping constraints

| Source field | Meaning to preserve |
| --- | --- |
| `product_id` | Stable source product identity, separate from application-generated identifiers. |
| `barcode` | Exact source string. Missing, seven-digit internal, and failed-check-digit values retain distinct warning states. |
| `trade_name`, `generic_name`, `strength`, `dosage_form`, `package_size`, `route` | Identity and package data. Never fill missing strength from another formulation. |
| `manufacturer_or_agent_ar/en` | Source party may be manufacturer, agent or warehouse. Do not assert manufacturer identity. |
| `therapeutic_category`, `atc_code` | Source classification. ATC outer whitespace may be trimmed; syntax success does not establish clinical validity. |
| `jfda_item_code` | Source item identifier, not independently verified regulatory registration. |
| `public_price_jod`, `hospital_price_jod`, `price_source_year` | Historical source price and year; no inference of current sell price. |
| `prescription_status`, `availability_status` | Unverified status; no inference of OTC classification or stock. |
| Source URLs, source dates, label date and `verification_status` | Source assertions and provenance; independent verification remains false. |
| Clinical indication, usage, dose and warning text | Quarantined from nonclinical import and public clinical display pending qualified review. |

The exact CSV bytes, raw complete rows, normalized nonclinical rows and audit script are kept only beneath the ignored `.local/jordan` directory. Public evidence contains aggregate counts, source hashes and issue IDs without clinical excerpts. The original archive SHA-256 was rechecked after the audit. Exact ZIP, CSV and XLSX hashes are recorded in `validation.json`.
