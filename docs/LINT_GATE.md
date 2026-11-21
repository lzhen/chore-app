# ESLint gate (issue #7)

`npm run lint` uses ESLint 10 flat configuration. The CI Static checks job runs
both TypeScript and ESLint as blocking steps; ESLint errors stop the job.

## Coverage

- JavaScript: ESLint recommended correctness rules, with browser/Node/service-worker
  globals and extension globals scoped to `chrome-extension/**/*.js`.
- TypeScript/TSX: ESLint and typescript-eslint recommended rules, plus
  `react-hooks/rules-of-hooks` as an error. TypeScript remains a separate gate.
- Source, unit tests, E2E specifications, public service worker, extension scripts,
  and root configuration files are included. Generated `dist`, coverage and
  dependency directories are excluded. `ios` and `mobile` are independent native
  wrapper/generated-project boundaries, not covered by this root lint gate.
- This is not type-aware linting, exhaustive dependency validation, native
  validation, or a full React Compiler rule set.

## Deliberate incremental policy

Existing `any` annotations and unused variables/parameters remain warnings rather
than forcing a broad typing/test rewrite in this change. The reviewed baseline
has **64 warnings: 58 explicit-any and 6 unused parameters**, with zero errors.
Warnings are visible in local/CI output; this is not a zero-warning claim.
No source file is ignored to hide a finding and no correctness rule is globally
disabled. Warning cleanup can be tracked separately before escalating severity.

The small source edits remove unused initial assignments, use `const`, simplify
equivalent date-character classes and scope a switch-case declaration. They do
not change the product flow or deploy a new build.

## Validation

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.
- Negative probes must show real errors fail the lint command, including an
  undefined JS identifier and a conditional React hook in TSX. Do not commit probes.
- GitHub Pages deployment is limited to main/master pushes or manual dispatch;
  keep this change on a draft task branch. Native/device/store checks remain
  separate from lint, unit tests and web build success.
