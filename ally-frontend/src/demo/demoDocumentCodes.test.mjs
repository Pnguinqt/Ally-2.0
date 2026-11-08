import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocumentCodes } from './demoDocumentCodes.js';

test('practice codes are scoped to an action and can be used once', () => {
  const codes = createDemoDocumentCodes(() => 'respondent');
  const { code } = codes.issue('workspace:-1');
  assert.match(code, /^\d{6}$/);
  assert.throws(() => codes.verify('preview:-1', code), { status: 410 });
  assert.equal(codes.workspaceAccess(-1).unlocked, false);
  assert.equal(codes.unlockWorkspace(-1, code).unlocked, true);
  assert.throws(() => codes.unlockWorkspace(-1, code), { status: 410 });
  assert.equal(codes.workspaceAccess(-2).unlocked, false);
});

test('expired codes and workspace access are rejected', context => {
  let now = 1000;
  context.mock.method(Date, 'now', () => now);
  const codes = createDemoDocumentCodes(() => 'respondent');
  const { code } = codes.issue('workspace:-1');
  now += 5 * 60_000;
  assert.throws(() => codes.unlockWorkspace(-1, code), { status: 410 });
  codes.unlockWorkspace(-1, codes.issue('workspace:-1').code);
  now += 15 * 60_000;
  assert.throws(() => codes.requireWorkspaceAccess(-1), /Unlock the document workspace/);
});

test('incorrect attempts and resetting the respondent invalidate outstanding codes', () => {
  let session = 'first';
  const codes = createDemoDocumentCodes(() => session);
  codes.unlockWorkspace(-1, codes.issue('workspace:-1').code);
  const preview = codes.issue('preview:-1');
  for (const remaining of [4, 3, 2, 1]) {
    assert.throws(() => codes.verify('preview:-1', 'invalid'), new RegExp(`Attempts remaining: ${remaining}`));
  }
  assert.throws(() => codes.verify('preview:-1', 'invalid'), { status: 410 });
  assert.throws(() => codes.verify('preview:-1', preview.code), { status: 410 });
  const download = codes.issue('download:-1');
  session = 'second';
  assert.equal(codes.workspaceAccess(-1).unlocked, false);
  assert.throws(() => codes.verify('download:-1', download.code), { status: 410 });
});
