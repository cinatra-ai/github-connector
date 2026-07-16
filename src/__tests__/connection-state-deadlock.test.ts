// The connected↔repository-selection deadlock (#53).
//
// getStatus() is three-state: a successful OAuth connect WITHOUT a selected
// repository is "incomplete". The settings page used to collapse that to
// `connected === "connected"` and gate the repository picker on it — but
// `connected` REQUIRES a selected repository, and the repository is selected
// in that picker, so a valid connection was pinned at "Disconnected" forever.
//
// Pinned here:
//   1. checkGitHubStatusAction passes the FULL three-state through (the
//      boolean collapse hid the deadlock from the Check button too).
//   2. Source-pins on the render gates (client/server components; repo runs
//      component code inside the cinatra monorepo, so behavior-render tests
//      live there): the picker is gated on the saved connection — never on
//      `connected` — and Connect/Disconnect key off connection EXISTENCE.
//   3. The status card maps "incomplete" to an action-needed badge that names
//      the missing step instead of the false "Disconnected".

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { requireExtensionActionMock } = vi.hoisted(() => ({
  requireExtensionActionMock: vi.fn(async () => {}),
}));
vi.mock("@cinatra-ai/sdk-extensions", () => ({
  requireExtensionAction: requireExtensionActionMock,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { checkGitHubStatusAction } from "../actions";
import { registerGitHubConnector, _resetGitHubDepsForTests } from "../deps";

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC_ROOT, rel), "utf8");

afterEach(() => {
  _resetGitHubDepsForTests();
  vi.clearAllMocks();
});

function stubDepsWithStatus(status: unknown) {
  registerGitHubConnector({
    getStatus: vi.fn(async () => status),
  } as never);
}

describe("checkGitHubStatusAction — three-state passthrough (#53)", () => {
  it("returns 'incomplete' verbatim (account connected, repository pending)", async () => {
    stubDepsWithStatus({
      status: "incomplete",
      detail: "GitHub account connected, but repository selection is still required.",
      settingsConfigured: true,
    });
    await expect(checkGitHubStatusAction()).resolves.toBe("incomplete");
  });

  it("returns 'connected' and 'not_connected' verbatim", async () => {
    stubDepsWithStatus({ status: "connected", settingsConfigured: true });
    await expect(checkGitHubStatusAction()).resolves.toBe("connected");
    _resetGitHubDepsForTests();
    stubDepsWithStatus({ status: "not_connected", settingsConfigured: false });
    await expect(checkGitHubStatusAction()).resolves.toBe("not_connected");
  });

  it("stays behind the manage auth gate", async () => {
    requireExtensionActionMock.mockRejectedValueOnce(new Error("nope"));
    await expect(checkGitHubStatusAction()).rejects.toThrow("nope");
  });
});

describe("settings page render gates (source-pins, #53)", () => {
  const page = read("settings-page.tsx");

  it("gates the repository picker on the saved connection — NEVER on `connected`", () => {
    expect(page).toMatch(/\{savedConnection \? \(/);
    // The deadlock shape must not come back in any spelling.
    expect(page).not.toMatch(/connected && savedConnection/);
    expect(page).not.toMatch(/connectionState === "connected" && savedConnection/);
  });

  it("keeps the three-state status (no boolean collapse) and feeds it to the status panel", () => {
    expect(page).toMatch(/connectionState = status\.status;/);
    expect(page).not.toMatch(/= status\.status === "connected";/);
    expect(page).toMatch(/initialState=\{connectionState\}/);
    expect(page).toMatch(/incompleteDetail=\{statusDetail\}/);
  });

  it("enables Connect(reconnect) and Disconnect whenever a connection EXISTS (incl. incomplete)", () => {
    const gates = page.match(/connected=\{connectionState !== "not_connected"\}/g) ?? [];
    expect(gates.length).toBe(2); // ConnectGitHubButton + DisconnectAction
  });
});

describe("status card mapping (source-pin, #53)", () => {
  it("maps 'incomplete' to an action-needed badge naming the missing step", () => {
    const client = read("setup-client.tsx");
    expect(client).toMatch(/incomplete: \{ status: "disconnected", label: "Repository required" \}/);
    expect(client).toMatch(/state === "incomplete" && incompleteDetail/);
  });
});
