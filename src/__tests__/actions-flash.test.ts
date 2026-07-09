// saveGitHubConnectionAction / saveGitHubRepositorySelectionAction — codes-only
// flash protocol contract (toast-notifications epic, cinatra-ai/cinatra#1107
// S7). Both actions used to redirect to the connector-list page with NO
// outcome param (dead banner-render code in ./settings-page); they now
// redirect back to the settings page itself carrying a `?notice=<code>` /
// `?error=<code>` the <SearchParamToast> island renders (see ./github-flash).

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireExtensionAction: vi.fn(async () => undefined),
  saveOAuthSettings: vi.fn(async (input: unknown) => input),
  saveRepositorySelection: vi.fn(async (input: unknown) => input),
}));

vi.mock("@cinatra-ai/sdk-extensions", () => ({
  requireExtensionAction: h.requireExtensionAction,
}));
vi.mock("../deps", () => ({
  getGitHubDeps: () => ({
    saveOAuthSettings: h.saveOAuthSettings,
    saveRepositorySelection: h.saveRepositorySelection,
  }),
}));
vi.mock("next/navigation", () => ({
  // Capture the redirect target via a thrown sentinel so action execution
  // stops exactly where the real `redirect()` would (it throws internally).
  redirect: vi.fn((url: string) => {
    const err = new Error("REDIRECT:" + url);
    (err as unknown as { __isRedirect: true }).__isRedirect = true;
    throw err;
  }),
}));

import { saveGitHubConnectionAction, saveGitHubRepositorySelectionAction } from "../actions";
import { redirect } from "next/navigation";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function redirectTargetOf(action: () => Promise<void>): Promise<string> {
  try {
    await action();
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("REDIRECT:")) return message.slice("REDIRECT:".length);
    throw e;
  }
  throw new Error("expected the action to redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.saveOAuthSettings.mockImplementation(async (input: unknown) => input);
  h.saveRepositorySelection.mockImplementation(async (input: unknown) => input);
});

describe("saveGitHubConnectionAction — flash codes", () => {
  it("redirects to the settings page with ?notice=saved on success", async () => {
    const target = await redirectTargetOf(() =>
      saveGitHubConnectionAction(form({ clientId: "id-1", clientSecret: "secret-1" })),
    );
    expect(target).toBe("/configuration/llm/github?notice=saved");
    expect(h.saveOAuthSettings).toHaveBeenCalledWith({ clientId: "id-1", clientSecret: "secret-1" });
  });

  it("redirects to the settings page with ?error=oauth-save-failed when the writer throws, without leaking the inner error text", async () => {
    h.saveOAuthSettings.mockRejectedValueOnce(new Error("nango upsert failed: secret leaked detail"));
    const target = await redirectTargetOf(() =>
      saveGitHubConnectionAction(form({ clientId: "id-1", clientSecret: "secret-1" })),
    );
    expect(target).toBe("/configuration/llm/github?error=oauth-save-failed");
    expect(target).not.toMatch(/nango|leaked/i);
  });

  it("gates on requireExtensionAction before touching the writer", async () => {
    await redirectTargetOf(() => saveGitHubConnectionAction(form({ clientId: "id-1" })));
    expect(h.requireExtensionAction).toHaveBeenCalledWith("@cinatra-ai/github-connector", "manage");
  });
});

describe("saveGitHubRepositorySelectionAction — flash codes", () => {
  it("redirects to the settings page with ?notice=repo-saved on success", async () => {
    const target = await redirectTargetOf(() =>
      saveGitHubRepositorySelectionAction(form({ repositoryFullName: "octo/repo" })),
    );
    expect(target).toBe("/configuration/llm/github?notice=repo-saved");
    expect(h.saveRepositorySelection).toHaveBeenCalledWith({ repositoryFullName: "octo/repo" });
  });

  it("redirects to the settings page with ?error=repo-save-failed when the writer throws (e.g. unknown repository)", async () => {
    h.saveRepositorySelection.mockRejectedValueOnce(new Error("unknown repository"));
    const target = await redirectTargetOf(() =>
      saveGitHubRepositorySelectionAction(form({ repositoryFullName: "octo/does-not-exist" })),
    );
    expect(target).toBe("/configuration/llm/github?error=repo-save-failed");
  });
});

// Sanity: redirect() itself is exercised through the sentinel-throw mock
// above, so `redirect` import stays referenced (avoids an unused-import
// lint false-positive in some configs).
void redirect;
