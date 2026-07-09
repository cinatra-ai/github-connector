// GitHubSettingsPage — toast island wiring (toast-notifications epic,
// cinatra-ai/cinatra#1107 S7).
//
// `settings-page.tsx` renders `<ConnectorSettingsDialog>` from
// `@cinatra-ai/sdk-ui`, which mounts a Radix `Dialog.Portal` — Radix guards
// portal rendering on `document` and renders nothing outside a browser DOM,
// so `renderToStaticMarkup` on the full page always yields empty markup in
// this repo's node (non-jsdom) vitest environment. Two real, non-mocked-away
// checks instead:
//
//   1. A genuine DOM render of the actual `@cinatra-ai/sdk-ui/search-param-toast`
//      island wired with OUR real `GITHUB_FLASH_TOASTS` config (the exact
//      values settings-page.tsx mounts) — proves the real component + our
//      real config compose without throwing, with `next/navigation`'s hooks
//      mocked (no jsdom needed; the island's `useEffect` toast-fire path is
//      covered behaviorally by ./github-flash.test.ts's static-message
//      contract and ./actions-flash.test.ts's redirect-code contract).
//   2. A source-text render->spec check on settings-page.tsx itself: the 3
//      retired raw-div banners are GONE and the toast island is mounted.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("notice=saved"),
  usePathname: () => "/configuration/llm/github",
  useRouter: () => ({ replace: vi.fn() }),
}));

import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { GITHUB_FLASH_TOASTS } from "../github-flash";

const SETTINGS_PAGE_SOURCE = readFileSync(
  new URL("../settings-page.tsx", import.meta.url),
  "utf-8",
);

describe("GitHub settings page — toast island DOM render", () => {
  it("renders the real SearchParamToast island wired with the real GITHUB_FLASH_TOASTS config without crashing", () => {
    expect(() =>
      renderToStaticMarkup(<SearchParamToast toasts={GITHUB_FLASH_TOASTS} />),
    ).not.toThrow();
  });

  it("the island is a one-shot client effect (no server-rendered markup of its own)", () => {
    const html = renderToStaticMarkup(<SearchParamToast toasts={GITHUB_FLASH_TOASTS} />);
    expect(html).toBe("");
  });
});

describe("GitHub settings page — render->spec: retired banners gone, island mounted", () => {
  it("mounts the sdk-ui SearchParamToast island with the github-flash config", () => {
    expect(SETTINGS_PAGE_SOURCE).toMatch(
      /import \{ SearchParamToast \} from "@cinatra-ai\/sdk-ui\/search-param-toast"/,
    );
    expect(SETTINGS_PAGE_SOURCE).toMatch(/import \{ GITHUB_FLASH_TOASTS \} from "\.\/github-flash"/);
    expect(SETTINGS_PAGE_SOURCE).toMatch(/<SearchParamToast toasts={GITHUB_FLASH_TOASTS} \/>/);
  });

  it("deletes the 3 retired raw-div banners outright (error / saved / repoSaved)", () => {
    expect(SETTINGS_PAGE_SOURCE).not.toContain("GitHub OAuth administration saved.");
    expect(SETTINGS_PAGE_SOURCE).not.toContain(
      "GitHub repository saved and cloned into the local data folder.",
    );
    expect(SETTINGS_PAGE_SOURCE).not.toMatch(/errorMessage/);
    expect(SETTINGS_PAGE_SOURCE).not.toMatch(/\bsaved\s*\?/);
    expect(SETTINGS_PAGE_SOURCE).not.toMatch(/repoSaved/);
    expect(SETTINGS_PAGE_SOURCE).not.toContain("border-destructive");
  });

  it("still renders the surviving persistent-state content (status pill / forms untouched)", () => {
    expect(SETTINGS_PAGE_SOURCE).toContain("GitHub OAuth administration");
    expect(SETTINGS_PAGE_SOURCE).toContain("GitHub repository connection");
    expect(SETTINGS_PAGE_SOURCE).toContain("NangoManagedApiCard");
  });
});
