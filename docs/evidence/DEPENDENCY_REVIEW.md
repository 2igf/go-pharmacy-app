# Dependency review

Measured final pnpm audit: 0 critical, 0 high, 2 moderate, 3 low. Counts are dependency occurrences; the table lists advisories. Audit exits 1 because residual findings are present.

| Package | Severity | Installed path | Fixed range | Source |
| --- | --- | --- | --- | --- |
| esbuild | moderate | .>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild | >=0.25.0 | [Advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| @smithy/config-resolver | low | .>@aws-sdk/client-s3>@smithy/config-resolver | >=4.4.0 | [Advisory](https://github.com/advisories/GHSA-6475-r3vj-m8vf) |
| uuid | moderate | .>streamdown>mermaid>uuid | >=11.1.1 | [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| katex | low | .>streamdown>katex; .>streamdown>mermaid>katex | >=0.18.2 | [Advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7) |

The esbuild issue concerns its development server in an indirect Drizzle tooling dependency; no such server is exposed by the Beta runtime. The Smithy issue is in inactive S3 provider tooling, not an active Beta API. UUID/KaTeX are under the retained, unused Streamdown/Mermaid UI helpers; they are not imported by the exposed Beta router/pages. These facts limit current Beta reachability and do not claim the packages are patched. Reassess or update with targeted compatibility testing before enabling those helpers. No major override was forced solely to suppress an audit result.

Security updates kept Express 4, tRPC 11, mysql2 3 and pnpm 10; Drizzle moved to its identifier-escaping fix with type/database verification. Vitest 2 was replaced by compatible-on-Node-24 Vitest 5 because the old line had critical advisories; its changed worker option was corrected and the entire suite rerun. Unused runtime-injection/analytics plugins and a redundant bundled pnpm dev dependency were removed. The final lockfile remains the dependency source of truth.
