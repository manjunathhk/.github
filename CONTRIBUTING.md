# Contributing: the issue-first process

Every change starts with an issue. No branch, commit or pull request is created until an issue exists that a reader who missed the conversation could pick up and deliver.

This applies equally to humans and AI coding assistants.

## 1. Create the issue

Use one of the templates (**Feature / change request** or **Bug report**). Blank issues are disabled.

A complete issue has:

| Section | Required | Purpose |
|---|---|---|
| Summary | Yes | What is needed and why, in plain language |
| Acceptance Criteria | Yes | How we know it is done |
| User story | No | Who benefits |
| Out of scope | No | What this deliberately excludes |
| Technical notes | No | Constraints, links, decisions |

### Acceptance criteria

Given / When / Then is the preferred form, one scenario per behaviour:

```gherkin
Scenario: Export as PNG
  Given a card is open in the editor
  When I click "Export" and choose PNG
  Then a PNG at 2x resolution downloads
```

Free text is accepted. The bot will suggest Given / When / Then but never blocks on format alone.

Good criteria are observable (someone can check them without reading the code), unambiguous, and independent of implementation.

## 2. Wait for `ready-for-dev`

A bot checks every issue on open and edit:

- **`ready-for-dev`**: Summary and Acceptance Criteria are present and meaningful. Work may start.
- **`needs-refinement`**: something is missing. The bot comments with what to fix. Edit the issue; the check re-runs.

Issues labelled `epic`, `question` or `discussion` are not checked.

## 3. Branch and commit

- Branch name: `<type>/<issue-number>-<short-slug>`, e.g. `feat/42-png-export`, `fix/57-null-title`.
- Reference the issue in commits: `feat: add PNG export (#42)`.

## 4. Open the pull request

- The description must contain `Closes #<issue>` (or link the issue in the PR sidebar).
- Map each acceptance criterion to the test or evidence that proves it.
- The **PR gate** check fails if there is no linked issue, or a linked issue is incomplete. Fix the issue, then re-run the check.

## 5. Scope changes

If the work grows beyond the acceptance criteria, do not widen the PR. Open a new issue for the extra scope and link it. One issue, one deliverable.
