// -----------------------------------------------------------------------------
// GitHub settings — codes-only flash protocol (toast-notifications epic,
// cinatra-ai/cinatra#1107 S7). The "use server" actions in ./actions redirect
// back to /configuration/llm/github carrying an outcome CODE (`?notice=<code>`
// / `?error=<code>`); the <SearchParamToast> island mounted in
// ./settings-page maps each code to a STATIC, server-trusted message here —
// it NEVER toasts URL-derived text (a crafted `?error=<spoofed link>` maps to
// no entry and is ignored). This module is the single source of truth so the
// action emitters and the mount-site message map cannot drift.
// -----------------------------------------------------------------------------

import type { SearchParamToastConfig } from "@cinatra-ai/sdk-ui/search-param-toast";

export const GITHUB_NOTICE_MESSAGES = {
  saved: "GitHub OAuth administration saved.",
  "repo-saved": "GitHub repository saved and cloned into the local data folder.",
} as const;

export const GITHUB_ERROR_MESSAGES = {
  "oauth-save-failed":
    "Could not save the GitHub OAuth administration settings. Check the client ID/secret and try again.",
  "repo-save-failed":
    "Could not save the GitHub repository selection. Try again.",
} as const;

export type GitHubNoticeCode = keyof typeof GITHUB_NOTICE_MESSAGES;
export type GitHubErrorCode = keyof typeof GITHUB_ERROR_MESSAGES;

// One <SearchParamToast> config entry per code, mounted in ./settings-page.
export const GITHUB_FLASH_TOASTS: SearchParamToastConfig[] = [
  ...(Object.entries(GITHUB_NOTICE_MESSAGES) as [GitHubNoticeCode, string][]).map(
    ([code, message]) => ({
      param: "notice" as const,
      value: code,
      message,
      variant: "success" as const,
    }),
  ),
  ...(Object.entries(GITHUB_ERROR_MESSAGES) as [GitHubErrorCode, string][]).map(
    ([code, message]) => ({
      param: "error" as const,
      value: code,
      message,
      variant: "error" as const,
    }),
  ),
];
