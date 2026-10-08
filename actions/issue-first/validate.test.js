'use strict';
// Run: node --test actions/issue-first/validate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { evaluate, linkedFromBody } = require('./validate.js');

const gwt = `### Summary
Users cannot export their card as PNG today.

### Acceptance Criteria
Given a card is open in the editor
When I click Export and choose PNG
Then a PNG downloads`;

test('issue form with Given/When/Then passes cleanly', () => {
  const r = evaluate(gwt);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.warnings.length, 0);
});

test('free-text criteria pass with a warning', () => {
  const r = evaluate(`## Summary\nUsers cannot export their card as PNG today.\n\n## Acceptance criteria\nA PNG export button exists and downloads a 2x image.`);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.warnings.length, 1);
});

test('missing acceptance criteria fails', () => {
  const r = evaluate('### Summary\nUsers cannot export their card as PNG today.');
  assert.strictEqual(r.ok, false);
  assert.match(r.errors[0], /Acceptance Criteria/);
});

test('issue form "_No response_" counts as empty', () => {
  const r = evaluate('### Summary\nUsers cannot export their card as PNG today.\n\n### Acceptance Criteria\n\n_No response_');
  assert.strictEqual(r.ok, false);
});

test('template placeholders inside HTML comments are ignored', () => {
  const r = evaluate('### Summary\n<!-- describe the thing in detail here please -->\n\n### Acceptance Criteria\n<!-- Given When Then goes here, at least twenty chars -->');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors.length, 2);
});

test('empty body fails both sections', () => {
  assert.strictEqual(evaluate(null).errors.length, 2);
});

test('closing keywords: local, cross-repo same, cross-repo other, URL', () => {
  const body = 'Closes #12, fixes manjunathhk/app#13, resolves other/repo#99\nFixed: https://github.com/manjunathhk/app/issues/14\nsee #15';
  assert.deepStrictEqual([...linkedFromBody(body, 'manjunathhk', 'app')].sort(), [12, 13, 14]);
});

test('closing keyword inside an HTML comment is ignored', () => {
  assert.strictEqual(linkedFromBody('<!-- Closes #1 -->', 'o', 'r').size, 0);
});
