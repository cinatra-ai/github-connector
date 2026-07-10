// Owner review on PR #45: the standalone "Save GitHub administration" button
// was removed — its function (persisting the OAuth-app Client ID / Client
// secret) is covered by the Connect / Reconnect button. Removing the button
// must NOT orphan the credential save it performed, so the equivalent save is
// wired into the connect flow via `saveGitHubOAuthSettingsForConnect`.
//
// This suite pins BOTH halves of that contract:
//   1. Behavior of the new manage-gated save action — carries over the auth
//      gate, the zod parse, and the exact `saveOAuthSettings` writer from the
//      removed action UNCHANGED, but RETURNS an outcome (never redirects) so
//      the client can abort the connect and surface the error inline.
//   2. The UI removal is real and non-orphaning — the "Save GitHub
//      administration" submit button is gone, the credential fields became a
//      plain field GROUP the Connect button reads by id, and the Help how-to no
//      longer instructs a now-nonexistent "Save" step.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The auth gate lives in the SDK; drive it from the test so the fail-closed
// (unauthorized → throws, never writes) path is exercised.
const { requireExtensionActionMock } = vi.hoisted(() => ({
  requireExtensionActionMock: vi.fn(async () => {}),
}));
vi.mock("@cinatra-ai/sdk-extensions", () => ({
  requireExtensionAction: requireExtensionActionMock,
}));
// actions.ts imports `redirect` at module scope (used by the OTHER actions);
// the save-for-connect action must never call it — assert that below.
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { saveGitHubOAuthSettingsForConnect } from "../actions";
import {
  registerGitHubConnector,
  _resetGitHubDepsForTests,
  type GitHubConnectorDeps,
} from "../deps";

const PACKAGE_NAME = "@cinatra-ai/github-connector";

function installDeps(overrides: Partial<GitHubConnectorDeps> = {}) {
  // The override (if any) wins, so the returned handle is the SAME mock that was
  // actually registered.
  const saveOAuthSettings = overrides.saveOAuthSettings ?? vi.fn(async () => ({}));
  registerGitHubConnector({
    getStatus: vi.fn(),
    getOAuthSettings: vi.fn(),
    listRepositories: vi.fn(),
    saveRepositorySelection: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
    saveOAuthSettings,
  } as unknown as GitHubConnectorDeps);
  return { saveOAuthSettings };
}

beforeEach(() => {
  requireExtensionActionMock.mockReset();
  requireExtensionActionMock.mockResolvedValue(undefined);
  redirectMock.mockClear();
  _resetGitHubDepsForTests();
});

afterEach(() => {
  _resetGitHubDepsForTests();
});

describe("saveGitHubOAuthSettingsForConnect (folds in the removed Save button)", () => {
  it("manage-gates, persists the credentials, and returns ok — never redirects", async () => {
    const { saveOAuthSettings } = installDeps();

    const result = await saveGitHubOAuthSettingsForConnect({
      clientId: "cid-123",
      clientSecret: "csecret-456",
    });

    expect(result).toEqual({ ok: true });
    // Same manage gate the removed action carried.
    expect(requireExtensionActionMock).toHaveBeenCalledWith(PACKAGE_NAME, "manage");
    // Exact writer + payload carried over from the removed Save action.
    expect(saveOAuthSettings).toHaveBeenCalledWith({
      clientId: "cid-123",
      clientSecret: "csecret-456",
    });
    // Unlike the removed redirecting action, this one returns — the client
    // stays on the page and launches the Nango connect itself.
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("degrades a writer failure to a returned error (no throw, no redirect)", async () => {
    const { saveOAuthSettings } = installDeps({
      saveOAuthSettings: vi.fn(async () => {
        throw new Error("nango down");
      }),
    });

    const result = await saveGitHubOAuthSettingsForConnect({ clientId: "x", clientSecret: "y" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Client ID and Client secret/);
    expect(saveOAuthSettings).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("fails CLOSED on an unauthorized caller — throws BEFORE any write", async () => {
    requireExtensionActionMock.mockRejectedValueOnce(new Error("forbidden"));
    const { saveOAuthSettings } = installDeps();

    await expect(
      saveGitHubOAuthSettingsForConnect({ clientId: "x", clientSecret: "y" }),
    ).rejects.toThrow(/forbidden/);
    // The gate throwing must short-circuit the writer.
    expect(saveOAuthSettings).not.toHaveBeenCalled();
  });

  it("fails CLOSED on a malformed payload — the zod parse throws before the write", async () => {
    const { saveOAuthSettings } = installDeps();

    await expect(
      // clientId must be a string; a non-string is rejected by the parse.
      saveGitHubOAuthSettingsForConnect({ clientId: 42 as unknown as string }),
    ).rejects.toThrow();
    expect(saveOAuthSettings).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The UI removal is real and does not orphan the credential save. Source-text
// asserts (node env, no DOM) — the same posture the connectors-package design
// contracts use.
// ---------------------------------------------------------------------------
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const settingsPage = readFileSync(join(SRC, "settings-page.tsx"), "utf8");
const setupClient = readFileSync(join(SRC, "setup-client.tsx"), "utf8");
const actionsSrc = readFileSync(join(SRC, "actions.ts"), "utf8");

describe("Save button removal is complete and non-orphaning", () => {
  it("drops the standalone \"Save GitHub administration\" submit button", () => {
    expect(settingsPage).not.toMatch(/Save GitHub administration/);
    // The old self-submitting form action is gone from the credential group.
    expect(settingsPage).not.toMatch(/action=\{saveGitHubConnectionAction\}/);
    expect(actionsSrc).not.toMatch(/export async function saveGitHubConnectionAction/);
  });

  it("keeps the credential fields as a group the Connect button persists by id", () => {
    // Field group carries a stable id (no form action) …
    expect(settingsPage).toMatch(/<form id="github-oauth-form"/);
    // … which the Connect button reads and saves before it connects.
    expect(settingsPage).toMatch(/formId="github-oauth-form"/);
    expect(settingsPage).toMatch(/saveOAuthAction=\{saveGitHubOAuthSettingsForConnect\}/);
    expect(setupClient).toMatch(/saveOAuthAction\(/);
    // The real Nango connect only fires AFTER a successful save.
    expect(setupClient).toMatch(/if \(!result\.ok\)/);
  });

  it("removes the orphaned \"then Save\" step from the Help how-to", () => {
    expect(settingsPage).not.toMatch(/then Save/);
  });
});
