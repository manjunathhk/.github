# Issue-first kit

Enforces "issue before code" across your GitHub repos: structured issues with acceptance criteria (Given / When / Then preferred, free text allowed), validated at the issue and PR level.

## Layout

```text
manjunathhk/.github         → this repo (write once)
  CONTRIBUTING.md             process doc, inherited by every repo
  .github/ISSUE_TEMPLATE/     feature + bug forms, blank issues off (inherited)
  .github/pull_request_template.md   "Closes #" prompt (inherited)
  .github/workflows/
    issue-first-issue.yml     reusable: labels issues ready-for-dev / needs-refinement
    issue-first-pr.yml        reusable: fails PRs without a complete linked issue
  actions/issue-first/
    validate.js               shared validation logic
    validate.test.js          node --test actions/issue-first/validate.test.js

per-repo files              → copy into each repo you want gated (see below)
  .github/workflows/issue-first.yml   caller stub (~30 lines)
  AGENTS.md                           tool-agnostic rules for any AI assistant
```

## Setup

### Once

Done: this repository. It must stay **public**, or other repos lose the inherited templates and cannot call the reusable workflows.

### Per repo

1. Add `.github/workflows/issue-first.yml` (the caller stub) and `AGENTS.md` to the repo. Both are in the per-repo section of the kit.
2. Settings → Branches (or Rules → Rulesets) on the default branch: require pull requests, and add **`pr / validate`** as a required status check. It appears in the picker only after the workflow has run once, so open a test PR first.
3. Settings → Actions → General → Workflow permissions can stay at "Read". The caller grants `issues: write` to the issue job only.

## Behaviour

| Event | Result |
|---|---|
| Issue opened / edited, complete, Given/When/Then | `ready-for-dev`, no comment |
| Issue complete, free-text criteria | `ready-for-dev` + one non-blocking suggestion comment |
| Issue missing Summary or Acceptance Criteria | `needs-refinement` + comment listing what to fix (run stays green) |
| Issue labelled `epic`, `question`, `discussion` | Skipped |
| PR with no `Closes #N` / sidebar link | **Fails** |
| PR linking an incomplete issue | **Fails**, job summary names the gap |
| PR by `dependabot[bot]` / `renovate[bot]` | Skipped |

Labels are created automatically on first use.

## Known limits (read before rollout)

- **Per-repo templates override everything.** If a repo has its own `.github/ISSUE_TEMPLATE/`, it stops inheriting all shared templates. Not merged.
- **Blank issues off is UI-only.** API, CLI and AI agents can still create free-form issues. That is exactly why the issue gate exists.
- **Editing an issue does not re-run its PR's check.** After fixing the issue, re-run the failed `pr / validate` job (or push a commit).
- **Sidebar links only count for PRs into the default branch.** For other targets, use `Closes #N` in the description.
- **Same-repo issues only.** Cross-repo links (`other/repo#5`) are ignored by design.
- **Pinned to `v1`.** Callers use `@v1`, and the reusable workflows load the validator from `v1` by default, so changes on `main` reach no repo until released. To release a compatible change: merge to `main`, then move the `v1` tag to that commit. For a breaking change: set the `kit-ref` defaults to `v2`, tag `v2`, then update each caller's `uses:` to `@v2`.
- **`main` is protected.** Changes to this repo go through a pull request; every gated repo depends on it.
- **Solo-maintainer caveat.** With branch protection, you are blocked by your own gate too. Leave "Do not allow bypassing" off if you want an emergency override as admin.

## Tuning

Inputs on the caller `uses:` jobs via `with:`:

| Input | Default | Workflow |
|---|---|---|
| `min-length` | `20` | both |
| `skip-labels` | `epic,question,discussion` | issue |
| `exempt-authors` | `dependabot[bot],renovate[bot]` | PR |
| `kit-ref` | `v1` | both |
