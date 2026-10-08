---
name: issue-first-rollout
description: Roll out Manj's issue-first process (issue forms, PR gate, labelling bot) to one of his GitHub repos. Use when asked to gate, onboard or enable issue-first on a repo.
---

# Issue-first rollout

Enables the issue-first process on one repo under `manjunathhk`. The argument is the repo name (e.g. `/issue-first-rollout my-repo`). If none is given, ask which repo.

> Source of truth: this file in `manjunathhk/.github`. The copy installed in Claude is a mirror; edit here first, then re-install.

## Background

- **Shared kit (already live, do not change unless asked):** public repo `manjunathhk/.github` holds the issue forms (`feature.yml`, `bug.yml`, `config.yml` with blank issues off), the PR template, `CONTRIBUTING.md`, reusable workflows `.github/workflows/issue-first-issue.yml` and `issue-first-pr.yml`, and the validator in `actions/issue-first/validate.js`. Docs: `docs/issue-first.md`.
- **Per-repo pieces:** the caller workflow below, plus an issue-first section in the repo's `AGENTS.md` (and `CONTRIBUTING.md` / PR template if the repo has its own, since those override the shared ones).
- **Reference implementation:** `manjunathhk/social-card-generator` issue #43, PR #44.
- **Rules the bot enforces:** an issue needs a non-empty `Summary` and `Acceptance Criteria` (min 20 chars, placeholders like `TBD`, `n/a`, `_No response_` count as empty). Given / When / Then is preferred but never blocking. A PR needs `Closes #N` (or a sidebar link) to a complete issue in the same repo.

## Hard boundaries

- **Never merge a PR.** Hand over to Manj.
- **Never edit a ruleset's bypass list.** Tell Manj to do it.
- **Ask before** creating issues, opening PRs or changing repo settings, unless Manj has already said yes in this conversation.
- **Never overwrite** an existing `AGENTS.md`, `CONTRIBUTING.md` or PR template. Insert sections only.

## Steps

### 1. Inspect (read only)

Report, before changing anything:

- Default branch, and whether it is protected (ruleset or classic branch protection).
- Existing `AGENTS.md`, `CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`.
- CI workflows and the gates they impose (lint, Prettier, actionlint, version bump checks, required labels).
- Collisions: a repo-level `ISSUE_TEMPLATE/` folder blocks the shared forms entirely (no merge), so flag it and propose removing or aligning it.

### 2. Dogfood: create the issue

Open an issue from the shared Feature form (`/issues/new?template=feature.yml`, fields can be prefilled with query params `title`, `summary`, `user-story`, `acceptance`, `out-of-scope`). Acceptance criteria in Given / When / Then:

- Issue is validated (labelled `ready-for-dev` or `needs-refinement` with a comment).
- PR without a linked issue fails `pr / validate`.
- PR with a complete linked issue passes `pr / validate`.
- Agents and contributors know the rule (docs state it and link the account-level process).

Out of scope: settings changes. Note any version-bump exemption needed.

### 3. Branch `feat/<issue>-issue-first`

**Caller workflow** `.github/workflows/issue-first.yml`, exactly:

```yaml
# Issue-first gate. Copy this file into each repo you want enforced.
# Logic lives in manjunathhk/.github; this is only the caller.
name: Issue-first

on:
  issues:
    types: [opened, edited, reopened, labeled, unlabeled]
  pull_request:
    types: [opened, edited, reopened, synchronize, ready_for_review]

concurrency:
  group: issue-first-${{ github.event.issue.number || github.event.pull_request.number }}
  cancel-in-progress: true

permissions: {}

jobs:
  issue:
    if: github.event_name == 'issues'
    uses: manjunathhk/.github/.github/workflows/issue-first-issue.yml@v1
    permissions:
      contents: read
      issues: write

  pr:
    if: github.event_name == 'pull_request'
    uses: manjunathhk/.github/.github/workflows/issue-first-pr.yml@v1
    permissions:
      contents: read
      issues: read
      pull-requests: read
```

**AGENTS.md section.** Insert before the first content section (after the intro). If the file is missing, create it with a one-line intro plus this section:

```markdown
## Issue-first (required)

No branch, code change, commit or PR without a GitHub issue that carries the `ready-for-dev` label.

1. Find the issue for the task. If there is none, or it is labelled `needs-refinement`, stop coding: draft the issue (Summary + Acceptance Criteria, Given / When / Then preferred), show it to the user, and create it only once they confirm.
2. Treat the issue's acceptance criteria as the contract. Extra scope goes in a new issue, not this PR.
3. Branch `<type>/<issue-number>-<slug>` (e.g. `feat/42-png-export`); commits reference `(#42)`.
4. The PR description starts with `Closes #<issue>`. The `Issue-first` workflow fails the PR otherwise.

Full process: the account-level [CONTRIBUTING](https://github.com/manjunathhk/.github/blob/main/CONTRIBUTING.md) and [docs](https://github.com/manjunathhk/.github/blob/main/docs/issue-first.md).
```

If the repo has a "before opening a PR" checklist in AGENTS.md, also add: ``- **Link the issue.** `Closes #<issue>` on the first line of the PR description; see "Issue-first" above.``

**Repo-level CONTRIBUTING.md (only if it exists):** insert before the "before you open a PR" section:

```markdown
## Start with an issue

Every change starts with a GitHub issue, opened from the Feature or Bug form. It needs a **Summary** and **Acceptance Criteria** (Given / When / Then preferred, free text accepted). A bot labels it `ready-for-dev` or `needs-refinement`; start work only on `ready-for-dev`.

The PR must say `Closes #<issue>`. The `Issue-first` check fails a PR with no linked issue, or one linked to an incomplete issue. The full process is in the account-level [CONTRIBUTING](https://github.com/manjunathhk/.github/blob/main/CONTRIBUTING.md).
```

**Repo-level PR template (only if it exists):** add near the top:

```markdown
Closes #

<!-- Replace with the issue this PR delivers, e.g. "Closes #42". The Issue-first check fails without it. -->
```

and a checklist item: `- [ ] Every acceptance criterion in the linked issue is met and covered by the test plan above.`

**Before committing:** run whatever the repo's CI runs on these files (e.g. `actionlint`, `prettier --check` with the repo's config). **After committing:** fetch each file from `raw.githubusercontent.com/manjunathhk/<REPO>/<branch>/<path>` and compare byte-for-byte with the intended content.

### 4. Prove the PR gate

1. Open the PR **without** `Closes #N`. Add any label the repo's CI needs (e.g. `no-version-bump` for CI/docs-only).
2. Confirm `pr / validate` fails with "No linked issue" (check the job annotation, not just the red X).
3. Edit the description to start with `Closes #N`, tick the test-plan item, and confirm `pr / validate` passes on the re-run.
4. Confirm the repo's other CI is green.

### 5. Hand over the merge

Stop. Tell Manj the PR is ready and ask him to merge it.

### 6. After Manj confirms the merge

1. **Required check:** add `pr / validate` (GitHub Actions) to the default-branch ruleset's required status checks, keeping the existing ones. Reload and confirm it persisted. If there is no ruleset or protection, tell Manj and propose one (require PR, require status checks incl. `pr / validate`, block force pushes) before creating it.
2. **Labelling test:** open a throwaway Bug-form issue titled `[Test]: issue-first labelling check (will be closed)` with acceptance criteria `TBD`. Confirm `needs-refinement` plus the bot comment, then close it.
3. **Bypass list:** remind Manj to add **Repository admin** with mode **For pull requests only** to the ruleset bypass list (Settings > Rules > Rulesets). Do not do it yourself.

## Finish

A short table: what is live, what was verified (with issue / PR numbers), and anything left for Manj.

## Working without `gh` (browser-only notes)

Prefer an authenticated `gh` CLI when available. If only the browser is available (signed in to GitHub):

- **New file:** `/<owner>/<repo>/new/<branch>?filename=<path>` opens the editor with the path set.
- **Set editor content:** focus `.cm-content`, then dispatch a synthetic `paste` `ClipboardEvent` with a `DataTransfer` holding the text. To replace a whole file, focus the editor and press Ctrl+A first.
- **Insert at a line:** set the wrap dropdown to "No wrap", focus `.cm-content` via script (a mouse click can land on the file-tree panel instead), press Ctrl+Home, Down N times, Home, then paste. DOM-range selection does not move the editor cursor.
- **Commit dialog:** the message is an `input[type=text]`, the description a `textarea` (set via the native value setter plus an `input` event). On a protected default branch the dialog forces a new branch; type the branch name into the "PR target branch" field after Ctrl+A.
- **Prefill PRs:** `/compare/<base>...<branch>?expand=1&title=...&body=...&labels=...`.
