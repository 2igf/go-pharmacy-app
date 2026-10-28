# Independent review and verified fix

A fresh-context checkout_review agent performed a read-only source review against
eb4a97961f05dc912eaae897a88bff05bb4e3f02. No tests, DB/network or private credential
inspection was performed by the reviewer.

One concrete P1 in the touched tracking view: its ID-only React Query key retained
another customer's successful order after an account switch or failed refetch, while
the component rendered order.data without checking current ownership/error. Backend
ownership was correct. The local visibleCustomerOrder guard now requires matching
userId and no error. Two policy cases failed before it existed and passed after it.
Final actual WebView same-document account switch keeps cache alive, obtains404 from
the real backend and asserts no private article/item appears. Report flag
cachedForeignOrderHidden=true. Full168-test regression passed after correction.

No other concrete blocker was found in numeral normalization/ASCII replay compatibility,
allowlisted diagnostic messages, strict server validation or conditional test CA scope.
Root separately executed native TLS wrong-host rejection, normal-package tests, archive
inspection, assets/secret scan, browser workflow and MySQL preservation/invariant checks.
This is a focused review, not an exhaustive security certification.
