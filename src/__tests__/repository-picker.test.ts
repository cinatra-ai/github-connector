// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";

const state = vi.hoisted(() => ({
  selected: "octo/one",
  save: vi.fn(async () => ({})),
  authorize: vi.fn(async () => {}),
  redirect: vi.fn(),
}));

vi.mock("@cinatra-ai/sdk-extensions", () => ({ requireExtensionAction: state.authorize }));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));
vi.mock("../deps", () => ({
  getGitHubDeps: () => ({
    getOAuthSettings: async () => ({ selectedRepositoryFullName: state.selected }),
    getStatus: async () => ({ status: "connected" }),
    listRepositories: async () => [
      { id: 1, fullName: "octo/one", visibility: "private" },
      { id: 2, fullName: "octo/two", visibility: "public" },
    ],
    saveRepositorySelection: state.save,
  }),
}));
vi.mock("@cinatra-ai/sdk-ui/connector-setup-page", () => ({
  ConnectorSetupPage: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@cinatra-ai/sdk-ui/connector-setup-columns", () => ({
  ConnectorSetupColumns: ({ fields }: { fields: React.ReactNode }) => fields,
}));
vi.mock("@cinatra-ai/sdk-ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => children,
  TabsListRow: () => null,
  TabsTrigger: () => null,
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => value === "setup" ? children : null,
}));
vi.mock("@cinatra-ai/sdk-ui/search-param-toast", () => ({ SearchParamToast: () => null }));
vi.mock("../setup-client", () => ({
  ConnectGitHubButton: () => null,
  ConnectionStatusPanel: () => null,
  DisconnectAction: () => null,
}));

import { GitHubSettingsPage } from "../settings-page";
import { saveGitHubRepositorySelectionAction } from "../actions";

const ctx = {
  nango: { getPrimarySavedConnection: async () => ({ connectionId: "saved" }) },
} as unknown as ExtensionHostContext;

beforeEach(() => {
  state.selected = "octo/one";
  vi.clearAllMocks();
  // jsdom has no layout/scrolling; Radix calls these browser operations.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

async function mountPicker() {
  render(await GitHubSettingsPage({ ctx }));
  return screen.getByRole("combobox", { name: /^Repository/ });
}

describe("repository picker on the setup page", () => {
  it("uses the host trigger and retains the saved repository in form data", async () => {
    const trigger = await mountPicker();
    expect(trigger.getAttribute("data-slot")).toBe("select-trigger");
    expect(trigger.textContent).toContain("octo/one (private)");
    expect(new FormData(trigger.closest("form")!).get("repositoryFullName")).toBe("octo/one");
  });

  it("offers every repository and submits the chosen full name through the existing action", async () => {
    const trigger = await mountPicker();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["octo/one (private)", "octo/two (public)"]);
    fireEvent.click(screen.getByRole("option", { name: "octo/two (public)" }));
    const form = trigger.closest("form")!;
    await waitFor(() => expect(new FormData(form).get("repositoryFullName")).toBe("octo/two"));
    expect(trigger.textContent).toContain("octo/two (public)");
    await saveGitHubRepositorySelectionAction(new FormData(form));
    expect(state.authorize).toHaveBeenCalledWith("@cinatra-ai/github-connector", "manage");
    expect(state.save).toHaveBeenCalledWith({ repositoryFullName: "octo/two" });
    expect(state.redirect).toHaveBeenCalledWith(expect.stringContaining("repo-saved"));
  });

  it("starts without a repository when none has been saved", async () => {
    state.selected = "";
    const trigger = await mountPicker();
    expect(trigger.textContent).toBe("Choose a repository");
    expect(new FormData(trigger.closest("form")!).get("repositoryFullName")).toBe("");
  });
});
