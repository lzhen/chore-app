# Nesmi dependency release check — October 11, 2026

The shipped root and mobile dependency audits report zero vulnerabilities. Capacitor core/iOS/CLI and the mobile Android wrapper are pinned to 7.6.9. CocoaPods spec checksums were regenerated with cocoapods-core 1.17.0 from the installed 7.6.9 podspecs. No signing identity, provisioning profile or Apple team was inferred or changed.

Unused @capacitor/assets was removed after confirming no scripts or sources invoke it. Compatible npm audit fixes reduced the full development audit from 35 findings to nine (seven high, two moderate, zero critical).

The remaining findings are in development/build tooling:

| Package | Severity |
|---|---|
| braces | high |
| chokidar | high |
| fast-glob | high |
| gh-pages | high |
| globby | high |
| micromatch | high |
| postcss-nested | moderate |
| postcss-selector-parser | moderate |
| tailwindcss | high |

The braces advisory GHSA-vfj7-8cjw-p6xm affects every published braces release through 3.0.3; npm reports no patched braces version. Resolving the Tailwind/gh-pages dependency chains requires replacement or a larger build-system migration, not an unverified override. Development tools must not process untrusted glob patterns. No clean full-audit claim is made.

Validation: 98 tests, coverage run, TypeScript/Vite production build, clean root production audit, and clean mobile production audit. CI now uses supported Node 22/24 and high/critical production findings block release. Xcode Cloud runs the same production audit after npm ci. Native distribution signing remains unverified until an authorized App Store Connect build succeeds.
