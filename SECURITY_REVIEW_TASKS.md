# Security Review Task List

Last updated: 2026-04-27

## Overview

Command-Manager is a static browser app for managing and generating penetration-testing commands. The command catalog is stored as JSON under `commands/`, bundled into `js/commands.js` by `build-commands.js`, and rendered by `js/app.js`. User engagement data such as IPs, users, passwords, hashes, profiles, favorites, custom asset types, and target context is stored in browser `localStorage`.

Before adding new use-case-specific features, the main stability and security goals are:

- Treat all command catalog data and locally imported data as untrusted.
- Avoid loading third-party scripts on pages that handle engagement data.
- Make validation, build, and syntax-drift checks fail closed.
- Keep command-editor output compatible with the documented JSON workflow.

## Current Verification Baseline

- [x] `npm ci` succeeds from the committed lockfile.
- [x] `npm test` succeeds: render safety regression passes.
- [x] `npm run validate` succeeds: 285 commands validated.
- [x] `npm run build` succeeds and produces no tracked diff.
- [x] `npm audit --audit-level=moderate` reports 0 vulnerabilities.
- [ ] `scripts/verify-syntax.sh` provides reliable coverage.
  - Direct execution currently fails because the script is not executable.
  - `bash scripts/verify-syntax.sh` can exit 0 even when every Docker-backed tool check is skipped.
  - Direct Docker check for `ghcr.io/pennyw0rth/netexec:latest` failed with registry access denied.

## Remediation Tasks

### P1: Remove Third-Party Analytics From Sensitive App Surface

- [x] Remove the GoatCounter script from `index.html`.
- [x] Confirm no app behavior depends on `window.goatcounter` or remote analytics.
- [x] If public-site analytics are still desired, add a build/deploy-only gate that never runs in local engagement workflows.
- [x] Update the README if needed so the "No telemetry" claim remains accurate.

Status: remediated. `index.html` no longer loads `//gc.zgo.at/count.js`, no references to `goatcounter` remain in app code, and the README "No telemetry" claim remains accurate without a wording change.

### P1: Eliminate Catalog XSS in Command List Rendering

- [x] Refactor `renderCommands()` in `js/app.js` to build DOM nodes with `createElement`, `textContent`, and safe `setAttribute`.
- [x] Escape or safely assign command names, command previews, tags, requires badges, protocol badges, titles, and data attributes.
- [x] Add a small regression test or browser smoke check with a deliberately hostile command fixture.

Status: remediated. `renderCommands()` now creates DOM nodes directly and `scripts/test-render-commands-safety.js` covers hostile command names, command text, and tags.

### P1: Eliminate Catalog XSS in Command Builder Rendering

- [x] Refactor `renderCommandBuilder()` in `js/app.js` away from interpolating catalog data into `innerHTML`.
- [x] Safely render command title, description, variation labels, placeholder labels, output command, badges, references, and command links.
- [x] Restrict reference URLs to safe schemes, preferably `http:` and `https:`.
- [x] Add `rel="noopener noreferrer"` to external reference links.
- [x] Safely render linked command names and descriptions in `getCommandLinksForCommand()`.

Status: remediated. `renderCommandBuilder()` and the command-link section now create DOM nodes directly, reference URLs are limited to `http:` and `https:`, and the render safety regression covers hostile builder fields plus unsafe reference URLs.

### P2: Make Builds Fail on Any Invalid Command File

- [ ] Change `build-commands.js` so any collected parse or required-field error exits non-zero.
- [ ] Consider invoking schema validation from the build path or requiring `npm run validate` before build in CI.
- [ ] Add a negative fixture or documented manual check proving a bad command file cannot be silently skipped.

Context: the current build reports errors but only exits non-zero if every command fails, which can produce a partial `js/commands.js`.

### P2: Make Syntax Drift Verification Fail on Skips

- [ ] Make `scripts/verify-syntax.sh` executable or document that it must be invoked with `bash`.
- [ ] Track skipped tool checks separately from drift findings.
- [ ] Exit non-zero if Docker is unavailable, an image cannot be pulled, or a requested tool check is skipped.
- [ ] Print the Docker/image error in a way future agents can distinguish environment failures from clean syntax results.
- [ ] Re-check current image names and registry accessibility.

Context: in the latest review, every Docker-backed tool check skipped, but the script exited 0 with `Total drift findings: 0`.

### P2: Make Command Editor Produce Valid JSON

- [ ] Change `command-editor.html` so generated output is plain JSON using `JSON.stringify`.
- [ ] Remove the success banner from the downloadable/copyable artifact.
- [ ] Ensure downloaded files do not contain unquoted keys or trailing commas.
- [ ] Add validation guidance or a quick validation handoff after download.
- [ ] Keep the README workflow aligned with the editor output.

Context: the README says to save generated JSON under `commands/<category>/<subcategory>/<id>.json`, but the editor currently produces a JavaScript object snippet plus banner text.

## Follow-Up Review Areas

- [ ] Review all remaining `innerHTML` assignments in `js/app.js` and `command-editor.html`.
- [ ] Normalize imported list and backup data before saving to `localStorage`.
- [ ] Consider a content security policy for hosted deployments after inline handlers/scripts are removed.
- [ ] Consider optional local-only privacy controls for sensitive fields stored in `localStorage`.
- [ ] Add a lightweight browser smoke test for selecting commands, filling placeholders, copying output, importing/exporting lists, and switching profiles.
