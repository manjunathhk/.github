'use strict';

/**
 * Issue-first validator, shared by the issue gate and the PR gate.
 *
 * mode "issue": labels the issue `ready-for-dev` or `needs-refinement` and keeps
 *               one sticky comment explaining what is missing.
 * mode "pr":    fails unless the PR links at least one issue in this repo and
 *               every linked issue passes the same quality rules.
 *
 * Rules: an issue needs a non-empty Summary and non-empty Acceptance Criteria.
 * Given / When / Then is preferred but never blocking; free text passes with a warning.
 */

const MARKER = '<!-- issue-first-validator -->';
const LABEL_READY = 'ready-for-dev';
const LABEL_NOT_READY = 'needs-refinement';
const PLACEHOLDER = /^(_no response_|n\/?a|tbd|todo|none|-+|\.+)$/i;

const SUMMARY_KEYS = ['summary', 'description', 'user story', 'problem'];
const AC_KEYS = ['acceptance criteria', 'acceptance'];

const CLOSING =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/|([\w.-]+)\/([\w.-]+)#|#)(\d+)\b/gi;

function stripComments(text) {
  return (text || '').replace(/<!--[\s\S]*?-->/g, '');
}

function parseSections(body) {
  const sections = {};
  let current = null;
  for (const line of stripComments(body).split(/\r?\n/)) {
    const heading = line.match(/^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      current = heading[1].toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  for (const key of Object.keys(sections)) sections[key] = sections[key].join('\n').trim();
  return sections;
}

function pick(sections, keys) {
  const hit = Object.keys(sections).find((k) => keys.some((key) => k.startsWith(key)));
  return hit === undefined ? null : sections[hit];
}

function hasContent(text, minLength) {
  if (!text) return false;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (PLACEHOLDER.test(flat)) return false;
  return flat.length >= minLength;
}

function evaluate(body, minLength = 20) {
  const sections = parseSections(body);
  const errors = [];
  const warnings = [];
  const summary = pick(sections, SUMMARY_KEYS);
  const ac = pick(sections, AC_KEYS);

  if (summary === null) errors.push('Missing a **Summary** section.');
  else if (!hasContent(summary, minLength))
    errors.push(`**Summary** is empty or too short (minimum ${minLength} characters).`);

  if (ac === null) errors.push('Missing an **Acceptance Criteria** section.');
  else if (!hasContent(ac, minLength))
    errors.push(`**Acceptance Criteria** is empty or too short (minimum ${minLength} characters).`);
  else if (!(/\bgiven\b/i.test(ac) && /\bwhen\b/i.test(ac) && /\bthen\b/i.test(ac)))
    warnings.push(
      'Acceptance criteria are free text. Given / When / Then is preferred because each scenario maps directly to a test. Not blocking.'
    );

  return { ok: errors.length === 0, errors, warnings };
}

function linkedFromBody(body, owner, repo) {
  const found = new Set();
  const self = `${owner}/${repo}`.toLowerCase();
  for (const m of stripComments(body).matchAll(CLOSING)) {
    const o = m[1] || m[3];
    const r = m[2] || m[4];
    if (o && `${o}/${r}`.toLowerCase() !== self) continue;
    found.add(Number(m[5]));
  }
  return found;
}

function renderComment(result) {
  const lines = [MARKER];
  if (result.ok) {
    lines.push('### ✅ Issue-first check: ready for development');
  } else {
    lines.push('### ❌ Issue-first check: needs refinement', '', 'No code should start on this issue until these are fixed:', '');
    result.errors.forEach((e) => lines.push(`- ${e}`));
  }
  if (result.warnings.length) {
    lines.push('', '**Suggestions (non-blocking)**', '');
    result.warnings.forEach((w) => lines.push(`- ${w}`));
  }
  lines.push('', '_Edit the issue description and this check re-runs automatically._');
  return lines.join('\n');
}

async function upsertComment(github, ref, body, createIfMissing) {
  const comments = await github.paginate(github.rest.issues.listComments, { ...ref, per_page: 100 });
  const existing = comments.find((c) => c.user && c.user.type === 'Bot' && (c.body || '').includes(MARKER));
  if (existing) {
    if (existing.body !== body) await github.rest.issues.updateComment({ owner: ref.owner, repo: ref.repo, comment_id: existing.id, body });
  } else if (createIfMissing) {
    await github.rest.issues.createComment({ ...ref, body });
  }
}

async function setLabel(github, ref, add, remove) {
  await github.rest.issues.addLabels({ ...ref, labels: [add] });
  try {
    await github.rest.issues.removeLabel({ ...ref, name: remove });
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

async function issueMode({ github, context, core, minLength, skipLabels }) {
  const issue = context.payload.issue;
  if (!issue || issue.pull_request) {
    core.info('Not an issue event; nothing to do.');
    return;
  }
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  if (labels.some((l) => skipLabels.includes(l))) {
    core.info(`Issue #${issue.number} carries a skip label; not validated.`);
    return;
  }

  const ref = { ...context.repo, issue_number: issue.number };
  const result = evaluate(issue.body, minLength);
  await setLabel(github, ref, result.ok ? LABEL_READY : LABEL_NOT_READY, result.ok ? LABEL_NOT_READY : LABEL_READY);
  await upsertComment(github, ref, renderComment(result), !result.ok || result.warnings.length > 0);

  result.warnings.forEach((w) => core.warning(w));
  await core.summary.addHeading(`Issue #${issue.number}`, 3).addRaw(renderComment(result).replace(MARKER, '')).write();
  core.info(result.ok ? 'Issue is ready for development.' : 'Issue needs refinement (labelled, not failed).');
}

async function prMode({ github, context, core, minLength, exemptAuthors }) {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.setFailed('Not a pull_request event.');
    return;
  }
  if (exemptAuthors.includes(pr.user.login)) {
    core.info(`Author ${pr.user.login} is exempt from the issue-first gate.`);
    return;
  }

  const { owner, repo } = context.repo;
  const numbers = linkedFromBody(pr.body, owner, repo);

  // Sidebar "Development" links. GitHub only populates this for PRs into the default branch.
  try {
    const q = await github.graphql(
      `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
        closingIssuesReferences(first:25){nodes{number repository{nameWithOwner}}}}}}`,
      { o: owner, r: repo, n: pr.number }
    );
    for (const node of q.repository.pullRequest.closingIssuesReferences.nodes) {
      if (node.repository.nameWithOwner.toLowerCase() === `${owner}/${repo}`.toLowerCase()) numbers.add(node.number);
    }
  } catch (e) {
    core.warning(`Could not read sidebar-linked issues: ${e.message}`);
  }

  const report = [];
  let failed = numbers.size === 0;
  if (failed) report.push('- No linked issue found. Add `Closes #<issue>` to the PR description.');

  for (const n of [...numbers].sort((a, b) => a - b)) {
    let issue;
    try {
      ({ data: issue } = await github.rest.issues.get({ owner, repo, issue_number: n }));
    } catch (e) {
      failed = true;
      report.push(`- #${n}: not found in ${owner}/${repo}.`);
      continue;
    }
    if (issue.pull_request) {
      failed = true;
      report.push(`- #${n}: is a pull request, not an issue.`);
      continue;
    }
    const r = evaluate(issue.body, minLength);
    if (!r.ok) failed = true;
    report.push(`- #${n} ${r.ok ? '✅' : '❌'} ${issue.title}`);
    r.errors.forEach((e) => report.push(`  - ${e}`));
    r.warnings.forEach((w) => {
      report.push(`  - ⚠️ ${w}`);
      core.warning(`#${n}: ${w}`);
    });
    if (issue.state === 'closed') report.push('  - ⚠️ Issue is already closed.');
  }

  await core.summary.addHeading(`PR #${pr.number}: issue-first gate`, 3).addRaw(report.join('\n')).write();
  if (failed) {
    core.setFailed(
      numbers.size === 0
        ? 'No linked issue. Add "Closes #<issue>" to the PR description.'
        : 'One or more linked issues are not ready. See the job summary. Fix the issue, then re-run this check.'
    );
  } else {
    core.info('All linked issues are ready.');
  }
}

function list(value) {
  return (value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

async function run({ github, context, core }) {
  const mode = (process.env.MODE || '').trim();
  const opts = {
    github,
    context,
    core,
    minLength: Number(process.env.MIN_LENGTH || 20),
    skipLabels: list(process.env.SKIP_LABELS),
    exemptAuthors: list(process.env.EXEMPT_AUTHORS),
  };
  if (mode === 'issue') return issueMode(opts);
  if (mode === 'pr') return prMode(opts);
  core.setFailed(`Unknown mode "${mode}". Use "issue" or "pr".`);
}

module.exports = run;
module.exports.evaluate = evaluate;
module.exports.linkedFromBody = linkedFromBody;
