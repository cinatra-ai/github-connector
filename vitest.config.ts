import { defineConfig } from "vitest/config";
import * as path from "node:path";

// Standalone connector test config (mirrors the sibling schema-config
// connectors, e.g. openai-connector). The connector declares the host-internal
// `@cinatra-ai/*` surfaces as OPTIONAL peers, so its own repo CI skips the test
// step and the cinatra monorepo runs these against the workspace-resolved SDK.
// Node is the default for source and action contracts; the repository picker
// interaction test opts into jsdom explicitly.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@cinatra-ai/design-primitives", replacement: path.join(__dirname, "src/__tests__/fixtures/design-primitives.tsx") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
