# Changelog

All notable changes to this project are documented here, derived from the
project's merged pull request and release-tag history.

## v0.1.3 — 2026-07-07

Pairs with Cinatra 0.1.7, which removes the core GitHub client.

- feat(connection-client): own the GitHub connection client, relocated from Cinatra core and registered under the same existing host capability id (provider flip, no contract change), persisting and authorizing through published host capabilities including the instance-connection gate (cinatra#975 W3) (#36)

## v0.1.2 — 2026-07-04

- feat: final connection access-scoping declaration — default scope "admin" (cinatra#954 W4) (#35)
- fix(setup): remove the extension-rendered connection-status pill (#29)
- fix(ui): shadcn raw-element fixes + ramp ui-gate to error (#21)
- chore(manifest): add the declared SDK ABI range to the cinatra block (#30); add cinatra.vendor connector provenance metadata (#32)
- chore(deps): declare cinatra.consumes for closure-gate enrollment (#33)
- docs: expand README to the org standard (#19) (#20); CHANGELOG reconstructed from tag + merged-PR history (#34)
- chore: strip private tracker references from public source and workflow comments (#25, #28)
- ci: adopt source-leak-gate (#22, #23); re-vendor the ui-gate preset with the dynamic-import ban (#24); pin the release workflow to the gated reusable extension-release flow (release-approval wall) (#31)

## v0.1.1 — 2026-06-23

- ci: adopt source-leak-gate (#1)
- ci: adopt source-leak-gate (#2)
- chore: add .gitignore (#3)
- ci: adopt org gates — SHA-pin all uses: refs, bump source-leak-gate to v0.1.0, add actions-pinned + gitignore gate callers (#4)
- chore: keep internal planning notes untracked (#5)
- chore: npm files allowlist + git-archive export-ignore (packaging hygiene) (#6)
- ci: adopt the org ui-design-system gate (#7)
- Bind the GitHub connection surface through a host deps slot (cinatra#172 Stage H4) (#8)
- chore: Configure Renovate (#9)
- ci(release): grant contents: write + pin reusable workflow to .github HEAD (#11)
- ci: repin reusable release workflow (immutable-safe decoration + corrected build-input provisioning) (#12)
- ci: add truthful-attribution-gate caller in WARN mode (#13)
- ci: adopt the reusable extension->host IoC conformance gate (org-wide rollout) (#14)
- ci: tag-driven GitHub release on v* (#15)
- ci: adopt secret-scan-gate (#16)
- release: bump github-connector to 0.1.1 (#17)
- release: fix v0.1.1 publish tarball (exclude src/__tests__) (#18)

## v0.1.0 — 2026-06-03

- Initial release.

