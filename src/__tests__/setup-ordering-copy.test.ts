// Setup-tab ordering copy (#54). Source-pins: the OAuth-app prerequisite and
// the credentials-before-Connect sequence must live ON the Setup tab (the
// default tab) — not only on Help — with the OAuth-app surface linked inline.
// UI copy only; the Connect button's fold-in save behavior is unchanged.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.resolve(__dirname, "..", "settings-page.tsx"), "utf8");

describe("Setup tab ordering copy (#54)", () => {
  it("states the three-step sequence on the Setup tab", () => {
    expect(page).toMatch(/Connecting takes three steps/);
    // The button's real behavior (saves credentials, then connects) and its
    // limit (cannot create the OAuth app) are both said out loud.
    expect(page).toMatch(/Connect saves the credentials and starts the\s+GitHub authorization/);
    expect(page).toMatch(/it cannot create the OAuth app for you/);
  });

  it("links the OAuth-app surface inline on Setup AND keeps the Help-tab link", () => {
    const links = page.match(/href="https:\/\/github\.com\/settings\/developers"/g) ?? [];
    expect(links.length).toBe(2);
  });
});
