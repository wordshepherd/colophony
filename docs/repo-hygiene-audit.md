# Repo Hygiene Audit — 2026-07-25

Source: a config-level comparison of `colophony` against `chillest-subs` (the Chill Subs
consumer Next.js app). Only items where chillest-subs enforces something colophony does
not are listed. Everything here was verified against files in this repo on 2026-07-25 —
no speculative items.

**Revised 2026-07-25** after a second pass re-checking every claim against the repo. The
formatting item was demoted from P2 to P3 (its stated failure mode did not hold), several
file counts and call-site lists were corrected, and one already-satisfied action was
removed. Corrections are marked inline as _Amended_.

**Implemented 2026-07-25.** Most of this document has been acted on across three branches
(`chore/repo-hygiene-ci-and-toolchain`, `chore/pnpm-10-and-exact-pins`,
`feat/web-env-schema`). Implementation disproved two recommendations outright — see
"Corrections from implementation" at the end, which is the section to read first if you
are picking this up cold. Remaining work is tracked in `docs/backlog.md`, not here.

**Context / calibration:** colophony is the more rigorous repo overall. It has a 13-job CI
matrix (RLS, queue, service, security, webhook, Playwright, Python SDK), a diff-cover ≥80%
gate on changed lines, CODEOWNERS, dependabot with grouping, a PR template, SECURITY.md,
CODE_OF_CONDUCT.md, migration validators, and 29 tracked docs. chillest-subs has one CI
workflow and no test job. The findings below are a narrow set of gaps, not a verdict on the
repo.

**Do not import wholesale from chillest-subs.** It commits `.npmrc` containing a plaintext
registry auth token (its own scanner misses registry tokens), gitignores `/docs` entirely,
and has stray zero-byte files tracked from a bad shell redirect.

---

## P0 — Secret scanning is not enforced anywhere a push can't bypass

**Current state**

- `scripts/check-secrets.sh` is invoked only from `.husky/pre-commit`.
- Nothing under `.github/` references it (`grep -rn "check-secrets" .github/` → no match).
- `git commit --no-verify` defeats it completely. The script prints that exact flag as its
  own bypass instruction on failure.
- `.github/workflows/ci.yml` triggers only on `pull_request: branches: [main]` and
  `push: branches: [main]`. A feature branch pushed without an open PR runs **no** checks
  at all — not lint, not type-check, not tests, not secrets.

**Comparison:** chillest-subs runs `.github/workflows/secret-scan.yml` on
`push: branches: ["**"]` and on every PR, calling the same script the hooks call.

**Actions**

1. Add a `secret-scan` job to `ci.yml` (or a standalone workflow) triggered on
   `push: branches: ["**"]` and `pull_request: branches: ["**"]`. It should run the same
   script the pre-commit hook runs — one implementation, two call sites.
2. Give `scripts/check-secrets.sh` a mode flag so CI can scan the whole tree, not just the
   index. chillest-subs' equivalent takes `--staged` / `--tracked` / `--range <git-range>`;
   the hook passes `--staged`, CI passes `--tracked`. Currently colophony's script hardcodes
   `git diff --cached --name-only --diff-filter=ACM` at line 8.
3. _Amended._ Widening `ci.yml`'s own triggers to all branches is a **separate decision
   with a real cost**, not a free follow-on. Path filtering bounds only the 9 Playwright
   suites; `quality`, `unit-tests`, `rls-tests`, `queue-tests`,
   `service-integration-tests`, `security-tests`, `webhook-tests`, and
   `python-sdk-tests` all run on any non-docs change — most of a 23-job matrix, on every
   push to every branch. Actions 1 and 2 close the actual bypass for the cost of one cheap
   job. Do those first and evaluate this independently.

**Verify:** push a throwaway branch containing a file with `AKIA` + 16 uppercase alnum
chars and confirm the workflow fails. Delete the branch after.

---

## P0 — Add a scan for the forbidden-path class, not just content patterns

**Current state:** `scripts/check-secrets.sh` (71 lines) matches content patterns
(`sk_live_`, `AKIA`, the PEM private-key header, a generic high-entropy heuristic)
plus a small filename `case` block covering `.env`, `.env.local`, `.env.prod`,
`.env.*.local`.

**Gaps in that filename list**

- `.env.staging` is not matched (the repo has one in the working tree; it is gitignored,
  so this is latent rather than live).
- `*.key`, `*.pem`, `privkey.pem` are not blocked as paths at all — only caught if their
  content happens to hit the BEGIN-PRIVATE-KEY pattern, which misses DER/PKCS#12 and
  raw API-key files.
- The rule is allowlist-by-omission. chillest-subs inverts it: block every `.env*` path,
  then explicitly allow `.env.example` / `.env.local-example`. That fails safe when someone
  adds `.env.qa` or `.env.e2e` later.

**Action:** restructure the filename check as block-all-then-allow-templates, and add
`*.key` / `*.pem` / `privkey.pem` to the blocked path classes. Keep the existing content
patterns as-is — they're fine.

---

## P1 — pnpm executes every dependency's install scripts

**Current state:** `package.json` declares `packageManager: "pnpm@9.15.0"`. pnpm 9 runs
postinstall/preinstall/install scripts for **all** dependencies by default. The existing
`pnpm.overrides` block pins CVE'd transitives (glob, minimatch, ajv, esbuild) — that's a
different control and does not address script execution.

**Comparison:** chillest-subs is on `pnpm@10.32.1` with an explicit allowlist:

```json
"pnpm": {
  "onlyBuiltDependencies": ["@prisma/client", "@prisma/engines", "prisma", "@clerk/shared"]
}
```

**Actions**

1. Upgrade `packageManager` to pnpm 10.x — pnpm 10 blocks dependency build scripts by
   default and prompts for an allowlist.
2. Add `pnpm.onlyBuiltDependencies` naming just the packages that legitimately need to
   build. Likely candidates in this repo: `sharp`, `esbuild`, `clamscan` (native/binary
   deps) — confirm empirically by running a clean install and reading what pnpm reports as
   blocked.
3. _Amended._ Update the pnpm version in **all five** places in the same change (see P3):
   `package.json` → `packageManager`, `PNPM_VERSION` in `.github/workflows/ci.yml` and
   `.github/workflows/deploy.yml`, and the `corepack prepare pnpm@9.15.0 --activate` lines
   at `apps/web/Dockerfile:3` and `apps/api/Dockerfile:3`. Missing the Dockerfiles leaves
   the container builds on pnpm 9 — exactly the drift P3 describes.

**Risk:** this can break a clean install if a needed native build is omitted from the
allowlist. Test with `rm -rf node_modules && pnpm install` before pushing, and check the
Docker builds in `docker/`.

---

## P1 — `apps/web` has no type-aware linting

**Current state:** `apps/web/eslint.config.mjs` composes only
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Neither enables
typescript-eslint's type-checked rule sets, so the entire web app is unlinted for
`no-floating-promises`, `no-misused-promises`, `await-thenable`, and the `no-unsafe-*`
family. `apps/api/eslint.config.mjs` does use `tseslint.configs.recommendedTypeChecked` —
so the gap is frontend-only and inconsistent within the monorepo.

Secondary: the API config blanket-disables `no-explicit-any` and every `no-unsafe-*` rule
(lines ~28–36), which neutralises most of the value of enabling `recommendedTypeChecked`
there. `no-floating-promises` is set to `warn` rather than `error`.

**Actions**

1. Add `tseslint.configs.recommendedTypeChecked` to `apps/web/eslint.config.mjs` with
   `parserOptions.projectService: true`. Expect a large first-run failure count — land it
   as its own PR, and downgrade the noisiest rules to `warn` initially rather than
   disabling them outright.
2. Add `linterOptions.reportUnusedDisableDirectives: true` to both configs so stale
   `eslint-disable` comments get cleaned up as the codebase changes.
3. Revisit the API's disabled `no-unsafe-*` set — at minimum promote
   `no-floating-promises` to `error`, since unhandled rejections in Fastify handlers are a
   real production failure mode.

---

## P1 — `apps/web` reads `process.env` with no schema

**Current state:** `apps/api/src/config/env.ts` is a strong zod schema (coercion, defaults,
`startsWith('postgresql://')` validation) and even has `env.spec.ts` covering it. But
`apps/web` reads `process.env` directly in **12** files (_amended_ — an earlier draft
listed 10): `src/lib/trpc.ts`, `src/lib/demo-auth.ts`, `src/lib/oidc.ts`,
`src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`,
`src/app/identity/page.tsx`, the three `src/app/embed/**` routes, plus
`src/components/landing/landing-demo-form.tsx` and `src/hooks/use-notification-stream.ts`.
A missing or misspelled `NEXT_PUBLIC_*` therefore fails at runtime in the browser rather
than at build time.

**Comparison:** chillest-subs centralises this in `src/env.js` using `@t3-oss/env-nextjs`,
with an explicit `server` / `client` split, defaults, URL validation, and enum-typed
feature flags. It's imported at the top of `next.config.js`, so an invalid environment
fails `next build`, with `SKIP_ENV_VALIDATION` as a documented escape hatch for Docker.

**Actions**

1. Add `apps/web/src/env.ts` — either `@t3-oss/env-nextjs`, or a hand-rolled zod schema
   mirroring the API's `config/env.ts` style to avoid a new dependency.
2. Import it from `apps/web/next.config.ts` so build fails on invalid env.
3. Support a `SKIP_ENV_VALIDATION` bypass — the Docker builds under `docker/` will need it.
4. Replace the raw `process.env` reads listed above with imports from the new module.

---

## P2 — `noUncheckedIndexedAccess` is off

**Current state:** `packages/typescript-config/base.json` enables the full `strict*` family
plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, and `forceConsistentCasingInFileNames` — several of which
chillest-subs does _not_ have. The one meaningful omission is `noUncheckedIndexedAccess`,
the flag that catches `arr[i].foo` and `record[key].bar` on possibly-absent entries.

**Action:** enable `"noUncheckedIndexedAccess": true` in `base.json`. This will produce a
large number of errors on first run across all workspace packages. Land it package by
package — `packages/types` and `packages/api-contracts` first (smallest surface), then
`packages/db`, then `apps/api`, then `apps/web` — rather than as one sweeping PR.

---

## P2 — Dependency versions are all caret ranges

**Current state:** every workspace `package.json` uses `^` ranges — 170 caret ranges, zero
exact pins (`"fastify": "^5.8.4"`, `"drizzle-orm": "^0.45.2"`, `"zod": "^4.3.6"`, …).
chillest-subs pins ~130 dependencies to exact versions.

_Amended twice:_ the original "9 workspace `package.json` files" was correct and a first
revision wrongly changed it to 11. `pnpm-workspace.yaml` globs `apps/*` and `packages/*` →
**9 member packages** (`apps/api`, `apps/web`, and the 7 under `packages/`), plus the root
manifest = 10 in-workspace files. `sdks/typescript/package.json` is generated and sits
outside the workspace — it should not be pinned along with the rest.

`pnpm-lock.yaml` covers most of the risk, so this is a preference call, not a defect.
It matters in two places: `pnpm up` drifts minors silently, and any resolve that doesn't
honour the committed lockfile (a Docker build stage that copies `package.json` before the
lockfile, a CI cache miss on a stale lock) can install something you never tested.

**Actions**

1. Decide the policy and write it down in `CONTRIBUTING.md` — either "exact pins,
   dependabot moves them" or "carets, lockfile is authoritative". Both are defensible; the
   current state is unstated.
2. If pinning: `pnpm up --latest` then strip carets, in one PR per workspace package.
3. ~~Audit the Dockerfiles to confirm every install runs with `--frozen-lockfile`.~~
   _Amended — already satisfied._ `apps/web/Dockerfile:10` and `apps/api/Dockerfile:13`
   both use `--frozen-lockfile`, as does every `pnpm install` in `ci.yml` and
   `deploy.yml`. (The Node builds live under `apps/`, not `docker/`; `docker/` holds
   infra images with no Node install step.) The lockfile-bypass risk named above is
   therefore theoretical in this repo today — which further supports treating this item
   as a policy decision rather than a defect.

---

## P3 — Node and pnpm versions are declared in many places that disagree

> _Amended:_ the first draft counted five Node sites and two pnpm sites. The real totals are
> seven and five — see "Node's version lives in seven places" in the second-pass section.

**Current state**

| Location                                            | Value      |
| --------------------------------------------------- | ---------- |
| `.nvmrc`                                            | `v22.22.0` |
| `.node-version`                                     | `22`       |
| `package.json` → `engines.node`                     | `>=22.0.0` |
| `.github/workflows/ci.yml` → `env.NODE_VERSION`     | `"22"`     |
| `.github/workflows/deploy.yml` → `env.NODE_VERSION` | `"22"`     |

_Amended:_ the pnpm version is duplicated in **four** places beyond
`package.json` → `packageManager` — not two:

| Location                                            | Value         |
| --------------------------------------------------- | ------------- |
| `package.json` → `packageManager`                   | `pnpm@9.15.0` |
| `.github/workflows/ci.yml` → `env.PNPM_VERSION`     | `"9.15.0"`    |
| `.github/workflows/deploy.yml` → `env.PNPM_VERSION` | `"9.15.0"`    |
| `apps/web/Dockerfile:3` → `corepack prepare`        | `pnpm@9.15.0` |
| `apps/api/Dockerfile:3` → `corepack prepare`        | `pnpm@9.15.0` |

`engines.node: ">=22.0.0"` is open-ended, so Node 25 satisfies it while CI tests only 22.

**Actions**

1. Narrow `engines.node` to `"22.x"`.
2. Have both workflows read the version from `.nvmrc` — `actions/setup-node` supports
   `node-version-file: .nvmrc` — and drop the hardcoded `NODE_VERSION` env vars.
3. Use `corepack` / `packageManager` for pnpm in CI instead of hardcoded `PNPM_VERSION`,
   so the pnpm 10 upgrade in P1 is a one-line change.
4. Delete either `.nvmrc` or `.node-version` — keeping both invites drift.

---

## P3 — Agent instructions are local-only (judgment call)

**Current state:** `.gitignore` excludes `CLAUDE.md`, `.claude/`, `.claudeignore`, `.codex/`,
and `docs/devlog/`. The root `CLAUDE.md` is ~14KB of substantial project context that no
contributor, reviewer, or CI job can see, and it can't be reviewed in a PR. The repo also
maintains parallel `.claude/` and `.codex/` trees.

**Comparison:** chillest-subs commits a single `AGENTS.md` with `CLAUDE.md` as a symlink to
it — one file serving every agent tool — plus `.agents/rules/*.mdc` and `.agents/skills/`,
with a `skills-lock.json` recording source repo, path, and SHA-256 for each vendored skill
(tamper-evident, and diffable when a vendored skill updates).

For an AGPL project intended to take outside contributions, shared-and-versioned is the
better default. This is a deliberate choice though, not a defect — if the exclusion is
intentional (e.g. the file contains private context), leave it and note the reasoning in
`CONTRIBUTING.md`.

**Actions (if adopting)**

1. Move shared project context to a tracked `AGENTS.md`; symlink `CLAUDE.md` → `AGENTS.md`.
2. Keep genuinely local/private material in `.claude/` and leave that gitignored.
3. If any skills or rules are vendored from an external repo, add a lock file recording
   source + commit + hash.

---

## P3 — Two formatting regimes in one monorepo (_amended — was P2_)

**Correction to the original finding.** The earlier draft claimed that `lint-staged` applies
root-default prettier to staged `*.{ts,tsx}` files "including API files that eslint will
then re-check against `apps/api/.prettierrc`," and concluded the two "will fight each other."
**That is wrong.** Prettier resolves the _nearest_ config to each file regardless of the
directory it is invoked from:

```
$ ./node_modules/.bin/prettier --find-config-path apps/api/src/index.ts
apps/api/.prettierrc
$ ./node_modules/.bin/prettier --find-config-path apps/web/src/lib/trpc.ts
[error] Can not find configure file for "apps/web/src/lib/trpc.ts".
```

So `lint-staged`, the root `format` script, and `eslint-plugin-prettier` all agree on API
files today. `ci.yml:101` runs `pnpm format:check` and passes. There is no conflict to fix.

**What is actually true**

- No prettier config at the repo root; root `format` / `format:check` run prettier 3.8.1
  defaults across `**/*.{ts,tsx,md,json}`.
- `apps/api/.prettierrc` sets `{ "singleQuote": true, "trailingComma": "all" }`, and the API
  additionally enforces prettier _as an eslint rule_ via `eslint-plugin-prettier/recommended`
  with `{ endOfLine: "auto" }`.
- `apps/web` and all `packages/*` have no prettier config, so they get defaults —
  double quotes.

The residual issue is **stylistic inconsistency** (API uses single quotes, everything else
double), not tool conflict. That is a cosmetic preference, which is why this drops to P3.

**Actions**

1. Decide whether the API's single-quote style is deliberate. If not, add a root
   `.prettierrc` as the single source of truth and delete `apps/api/.prettierrc`. Expect a
   large whitespace-only diff — land it alone and add the commit to `.git-blame-ignore-revs`.
2. Consider `prettier-plugin-tailwindcss` for deterministic Tailwind class ordering, since
   `apps/web` and the design system lean on Tailwind + Radix.

---

## Additional items — second pass

Found while verifying the items above. Same method: config-level, verified against files in
this repo, no speculative entries.

### P1 — Turbo's `build` task does not declare the env vars that change its output

**Current state:** `turbo.json` declares `"build": { "env": ["NODE_ENV"] }`. But the
`apps/web` build consumes at least ten more environment variables that change its output —
`apps/web/Dockerfile:14-33` passes them all in as build args:
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TUS_URL`, `NEXT_PUBLIC_ZITADEL_AUTHORITY`,
`NEXT_PUBLIC_ZITADEL_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Turbo hashes only _declared_ env vars into the cache key. `NEXT_PUBLIC_*` values are inlined
into the client bundle at build time. So a cached `build` from one environment is a valid
cache hit for another — turbo can hand back a web bundle baked with the wrong API URL,
Zitadel authority, or Sentry environment. This is a correctness bug, not a style issue, and
it is silent when it fires.

**Actions**

1. Add every build-affecting variable to `turbo.json` → `tasks.build.env`. Prefer the
   wildcard `"NEXT_PUBLIC_*"` plus the three explicit `SENTRY_*` entries.
2. Consider `"globalEnv"` for anything that affects every task.
3. This pairs naturally with the web env-schema item above — the schema module gives you a
   single authoritative list of variables to mirror into `turbo.json`.

### P1 — `pnpm audit` runs in CI but cannot fail the build

**Current state:** `ci.yml:109-111` runs `pnpm audit --audit-level=high` with
`continue-on-error: true`. It reports and is ignored. This is the same shape as the P0
secret-scanning finding — a control that exists but sits on a path where nothing enforces it.

**Action:** decide whether it should gate. If yes, drop `continue-on-error` and add explicit
`pnpm.auditConfig.ignoreCves` entries for accepted risks, so exceptions are reviewed in a PR
rather than blanket-suppressed. If no, that is defensible for a solo-maintained repo — say so
in a comment on the step, so the next reader knows it is deliberate.

### P2 — No `.gitattributes`, and `endOfLine: "auto"` quietly defeats the `lf` intent

**Current state:** `.editorconfig` exists and sets `end_of_line = lf`. There is **no**
`.gitattributes`, so git performs no line-ending normalisation on commit or checkout.
Meanwhile `apps/api/eslint.config.mjs` overrides prettier with `{ endOfLine: "auto" }` —
which accepts whatever line endings a file already has, defeating the `lf` intent rather than
enforcing it. That override reads as a workaround for a CRLF problem someone already hit,
which is plausible given the documented WSL development environment.

**Actions**

1. Add `.gitattributes` with `* text=auto eol=lf` plus `binary` markers for images and fonts.
2. Run `git add --renormalize .` once, as its own commit.
3. Then remove the `endOfLine: "auto"` override so prettier enforces `lf` for real.

### P2 — GitHub Actions are pinned to mutable tags, not commit SHAs

**Current state:** every action is referenced by tag — `actions/checkout@v6`,
`actions/setup-node@v6`, `actions/setup-python@v6`, `actions/upload-artifact@v7`,
`pnpm/action-setup@v5`, and `appleboy/ssh-action@v1`. Tags are mutable; a compromised or
force-moved tag executes in your runner.

The sharpest case is `appleboy/ssh-action@v1` — a **third-party** action used in
`deploy.yml`, which is the workflow that holds SSH credentials to the Hetzner VPS. A
supply-chain compromise there is production access, not a broken build.

Mitigating factor: `.github/dependabot.yml:22-32` already tracks the `github-actions`
ecosystem weekly, so tags do get bumped. That handles _staleness_; it does not handle a tag
being force-moved between bumps.

**Action:** pin to full commit SHAs with the tag as a trailing comment
(`uses: appleboy/ssh-action@<sha> # v1.2.3`). Dependabot understands this form and keeps
updating it. If pinning everything is too noisy, pin the third-party actions at minimum —
`appleboy/ssh-action` and `pnpm/action-setup` — and leave the first-party `actions/*` on tags.

### P3 — Node's version lives in seven places, and one of them is wrong

**Extends the P3 table above.** Two more declaration sites, both missed in the first pass:

| Location                   | Value                         |
| -------------------------- | ----------------------------- |
| `apps/api/Dockerfile:2,30` | `node:22-alpine`              |
| `apps/web/Dockerfile:2,41` | `node:22-alpine`              |
| `CONTRIBUTING.md:11-12`    | `Node.js >= 22`, `pnpm 9.15+` |

And `.github/dependabot.yml:34` carries the comment `# Docker base images (pinned to Node 20
LTS)` while both Dockerfiles are on Node 22. The comment is simply stale — the `ignore` rule
below it correctly blocks major bumps regardless — but it is exactly the kind of drift the
parent finding is about.

**Actions**

1. Fix the stale Node 20 comment in `dependabot.yml`.
2. Add `CONTRIBUTING.md` to the list of files touched by any Node or pnpm version change.
3. The Dockerfile base images are also floating tags (`node:22-alpine`, not a digest). Same
   tradeoff as the Actions item — dependabot tracks them, which is probably sufficient here.

### P3 — `pre-push` skips type-checking `apps/web`; CI does not

**Current state:** `.husky/pre-push:12-13` filters type-check to `@colophony/db` and
`@colophony/api`, with the comment _"Scoped to API + DB during v2 rewrite (web app
excluded)."_ But `ci.yml:107` type-checks `@colophony/web` along with everything else — and
passes.

So this is **not** an enforcement hole; CI catches web type errors. It is a stale local
feedback gap: a contributor changing only web code gets a green pre-push and finds out in CI.
Since CI already demonstrates that web type-checks clean, the exclusion has outlived its
reason.

**Action:** drop the `--filter` flags and let pre-push run `pnpm turbo run type-check` across
the workspace, matching CI. Turbo's cache makes the extra cost small.

### P3 — `SENTRY_AUTH_TOKEN` is a build ARG in the web image

**Current state:** `apps/web/Dockerfile:28-29` takes `SENTRY_AUTH_TOKEN` as an `ARG` and
promotes it to `ENV` in the `builder` stage.

**Scope this correctly:** the final image is built `FROM node:22-alpine AS runner` and copies
only `.next/standalone`, so the token does **not** reach the shipped image or its
`docker history`. The exposure is limited to the `builder` stage's own layers — which matters
only if that stage is pushed to a registry or shared via a remote build cache. Worth knowing,
not worth an urgent fix.

**Action:** if a registry-backed build cache is ever introduced, move the token to a BuildKit
secret mount (`RUN --mount=type=secret,id=sentry_token`) rather than an ARG. No action needed
today.

### Noted as already correct

Checked because the patterns above suggested they might be gaps; they are not. Recorded so a
future pass does not re-litigate them:

- Every `pnpm install` in `ci.yml`, `deploy.yml`, and both Dockerfiles uses
  `--frozen-lockfile`.
- Every job in `ci.yml` and `deploy.yml` declares an explicit `permissions:` block.
- `.dockerignore` already implements the exact block-all-then-allow-templates pattern that
  P0 recommends for `check-secrets.sh` (`.env` / `.env.*` blocked, `!.env.example` allowed) —
  **use it as the reference implementation when restructuring the script.**
- `dependabot.yml` covers all three relevant ecosystems: npm, github-actions, and docker.
- `.editorconfig`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and an
  `AGPL-3.0-or-later` license declaration are all present.
- `ci.yml` enforces `pnpm format:check`, and blocks newly-added `*.flaky.test.*` files on PRs.

---

## Suggested sequence

_Amended:_ formatting moved to the end (it is cosmetic, and the urgency in the first draft
rested on the conflict claim that did not hold); the two new P1 items are slotted by value.

1. **P0 secret scanning** (both items) — small, self-contained, closes a real bypass. Model
   the path rules on the existing `.dockerignore`.
2. **P1 turbo `build` env declarations** — a few lines, and it fixes a silent
   wrong-bundle-from-cache bug. Highest value-per-line in this document.
3. **P3 toolchain version consolidation** — mechanical, and unblocks the pnpm 10 upgrade.
   Covers seven Node sites and five pnpm sites, not the two the first draft listed.
4. **P1 pnpm 10 + `onlyBuiltDependencies`** — needs a clean-install and Docker-build test.
5. **P1 `pnpm audit` gating** — a one-line decision, either way.
6. **P2 `.gitattributes` + renormalise** — do before any prettier work so line-ending churn
   and quote-style churn do not land in the same diff.
7. **P1 web type-aware eslint** — large diff, own PR, expect to start rules at `warn`.
8. **P1 web env schema** — moderate, touches 12 files. Reuse its variable list for item 2.
9. **P2 GitHub Actions SHA pinning** — start with the third-party actions in `deploy.yml`.
10. **P2 `noUncheckedIndexedAccess`** — largest blast radius, package-by-package.
11. **P2 dependency pinning policy**, **P3 agent instructions**, **P3 formatting**, and
    **P3 pre-push type-check scope** — decisions first, then mechanical follow-through.

---

## Corrections from implementation

Two recommendations above did not survive contact with the repo. Both were stated
confidently and both were wrong; they are left in place above rather than quietly edited,
with the corrections here.

### `pnpm audit` cannot be gated — the P1 item is not actionable as written

The item says gating is "a one-line decision, either way." It is not. Measured on
2026-07-25:

| Scope                                  | Result                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| `pnpm audit --audit-level=high`        | exit 1 — 151 findings (9 low, 61 moderate, 79 high, 2 critical) |
| `pnpm audit --prod --audit-level=high` | exit 1 — 126 findings (4 low, 52 moderate, 68 high, 2 critical) |

Restricting to production dependencies does not help. The volume is dominated by
transitive advisories reached through dev tooling — `brace-expansion`
GHSA-mh99-v99m-4gvg alone appears on 235 paths via `eslint`.

Removing `continue-on-error` would therefore fail every build on the first push while
improving nothing. **Resolution:** the step stays advisory, the reasoning is recorded
inline at `.github/workflows/ci.yml`, and the remediation is a tracked backlog project.
Gating is the _end state_ of that project, not a config change that precedes it.

### The `onlyBuiltDependencies` candidates were wrong in both directions

The P1 item guesses `sharp`, `esbuild`, and `clamscan`. What pnpm 10 actually blocks on a
forced clean install:

```
Ignored build scripts: @prisma/client@5.22.0, @prisma/engines@5.22.0,
@sentry/cli@2.58.5, prisma@5.22.0, protobufjs@7.5.4.
```

- **`clamscan` declares no install script at all** — it is a pure-JS wrapper around the
  `clamd` binary. It never needed allowlisting.
- **`@sentry/cli` was missed**, and it is the one entry with real breakage potential: its
  postinstall downloads the binary `@sentry/nextjs` uses for sourcemap upload during
  `next build`. Leaving it blocked breaks the web Docker build whenever
  `SENTRY_AUTH_TOKEN` is set — precisely the failure this control is meant to prevent.

The doc's own advice to "confirm empirically" was right, and following it mattered. Note
that a plain `pnpm install` is not sufficient to surface the list: it reuses prebuilt
natives from the global store and prints nothing. Use `pnpm install --force`.

### Additional notes worth carrying forward

- **`packageManager` cannot take a range.** `corepack prepare pnpm@10.x --activate`
  reports success but leaves the previous version active. Pin an exact version.
- **`turbo.json` accepts `env` wildcards but rejects `"//"` comment keys** inside a task
  definition (`Found an unknown key`). Use real JSONC `//` comments.
- **Exact pinning rewrites `pnpm-lock.yaml`.** Lockfile v9 records `specifier:` per
  importer, so `--frozen-lockfile` fails until the lockfile is regenerated. Verify by
  comparing package _names_ between old and new lockfiles, not by counting diff lines —
  a naive count suggested 96 packages had been dropped when the real change was
  duplicate-version deduplication.
- **Do not mark `pnpm-lock.yaml` as `-diff` in `.gitattributes`.** That makes git treat it
  as binary, hiding exactly the changes a reviewer of a dependency change needs to read.
  `linguist-generated=true` alone collapses it in GitHub's UI while keeping it diffable.
- **The secret scanner blocks security documentation.** Any file quoting the literal PEM
  private-key header trips the content pattern — including this document, which had to be
  reworded. Worth knowing before someone reaches for `--no-verify`.
