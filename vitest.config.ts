import { defineConfig } from "vitest/config";

// Standalone connector test config (mirrors the sibling schema-config
// connectors, e.g. openai-connector). The connector declares the host-internal
// `@cinatra-ai/*` surfaces as OPTIONAL peers, so its own repo CI skips the test
// step and the cinatra monorepo runs these against the workspace-resolved SDK.
// Node env — the connector tests are source-text / server-action contracts, no
// DOM render.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
