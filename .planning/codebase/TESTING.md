# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Not configured in this extracted repo — no `jest.config.*`, `vitest.config.*`, or test runner dependency in `package.json`
- Config: None present

**Assertion Library:**
- Not applicable — no test framework installed

**Run Commands:**
```bash
# CI defers all test execution to the cinatra monorepo host
# For standalone repos (no @cinatra-ai/* peer deps), CI runs:
pnpm test --if-present   # via .github/workflows/ci.yml "Test" step
```

## Why Tests Are Not Run Standalone

This repo is a **source mirror** (Cinatra extracted connector). It declares `@cinatra-ai/sdk-extensions` and `@cinatra-ai/sdk-ui` as optional `peerDependencies`. The CI pipeline (`.github/workflows/ci.yml`) explicitly detects this pattern and skips standalone install, typecheck, and test steps:

> "Skipping standalone tests (host-internal @cinatra-ai/* peers — the cinatra monorepo runs these)."

The monorepo host owns test execution because `@cinatra-ai/*` packages are not published to any registry and cannot be resolved outside the monorepo workspace.

## Test File Organization

**Location:**
- No test files exist in this repo (confirmed: no `*.test.*` or `*.spec.*` files found)

**Naming:**
- Not applicable

**Structure:**
- Not applicable

## Test Structure

Not applicable — no tests in this repo. Tests for the connector logic live in the cinatra monorepo host where `@cinatra-ai/sdk-extensions` and `@cinatra-ai/sdk-ui` are available.

## Mocking

Not applicable — no test files present.

## Fixtures and Factories

Not applicable — no test files present.

## Coverage

**Requirements:** Not enforced at this repo level — coverage runs in the monorepo host

**View Coverage:**
- Not applicable standalone

## Test Types

**Unit Tests:**
- Not present in this repo; expected to exist in the monorepo host for server actions (`src/actions.ts`) and utility functions (`src/lib/utils.ts`)

**Integration Tests:**
- Not present in this repo

**E2E Tests:**
- Not applicable

## CI Validation That Does Run

The CI pipeline (`.github/workflows/ci.yml`) performs these checks even for source-mirror repos:

1. **Package shape validation** — inline Node.js script verifies no `@cinatra-ai/*` packages leaked into `dependencies`/`devDependencies`/`optionalDependencies`, and all first-party peers have `peerDependenciesMeta.optional: true`
2. **Pack dry-run** — `npm pack --dry-run` validates publish payload shape without resolving peers
3. **Kind-specific gate** — `kind-gates` job runs after `build`; for `connector` kind, no additional gate is applied today (documented placeholder in workflow)

## Testable Code

The following units are candidates for testing in the monorepo host:

- `src/actions.ts` — `saveGitHubConnectionAction` and `saveGitHubRepositorySelectionAction`: authorization gate, Zod validation, redirect behavior
- `src/lib/utils.ts` — pure utility functions (`cn`, `slugify`, `formatCurrencyMillions`, `firstName`, `asArray`, `compareValues`, `getPageNumbers`) are fully side-effect-free and straightforward to unit test
- `src/settings-page.tsx` — `pickSearchParam` helper is a pure function embedded in the module

---

*Testing analysis: 2026-06-09*
