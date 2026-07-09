// Codes-only flash protocol contract (toast-notifications epic,
// cinatra-ai/cinatra#1107 S7). Locks the code->message map and the derived
// <SearchParamToast> config so the action emitters (./actions) and the
// mount-site island (./settings-page) cannot drift silently.

import { describe, expect, it } from "vitest";

import {
  GITHUB_NOTICE_MESSAGES,
  GITHUB_ERROR_MESSAGES,
  GITHUB_FLASH_TOASTS,
} from "../github-flash";

describe("github-flash — codes-only flash protocol", () => {
  it("has exactly the notice + error codes the actions emit", () => {
    expect(Object.keys(GITHUB_NOTICE_MESSAGES).sort()).toEqual(["repo-saved", "saved"]);
    expect(Object.keys(GITHUB_ERROR_MESSAGES).sort()).toEqual([
      "oauth-save-failed",
      "repo-save-failed",
    ]);
  });

  it("builds one SearchParamToast config entry per code", () => {
    expect(GITHUB_FLASH_TOASTS).toHaveLength(
      Object.keys(GITHUB_NOTICE_MESSAGES).length + Object.keys(GITHUB_ERROR_MESSAGES).length,
    );
  });

  it("wires notice codes onto the `notice` param as success-variant toasts with the STATIC message", () => {
    const saved = GITHUB_FLASH_TOASTS.find((t) => t.param === "notice" && t.value === "saved");
    expect(saved).toMatchObject({
      param: "notice",
      value: "saved",
      message: GITHUB_NOTICE_MESSAGES.saved,
      variant: "success",
    });

    const repoSaved = GITHUB_FLASH_TOASTS.find(
      (t) => t.param === "notice" && t.value === "repo-saved",
    );
    expect(repoSaved).toMatchObject({
      param: "notice",
      value: "repo-saved",
      message: GITHUB_NOTICE_MESSAGES["repo-saved"],
      variant: "success",
    });
  });

  it("wires error codes onto the `error` param as error-variant toasts with the STATIC message", () => {
    for (const [code, message] of Object.entries(GITHUB_ERROR_MESSAGES)) {
      const entry = GITHUB_FLASH_TOASTS.find((t) => t.param === "error" && t.value === code);
      expect(entry).toMatchObject({ param: "error", value: code, message, variant: "error" });
    }
  });

  it("never derives a toast message from anything but the static map (no interpolation/URL-derived text)", () => {
    for (const entry of GITHUB_FLASH_TOASTS) {
      expect(typeof entry.message).toBe("string");
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });
});
