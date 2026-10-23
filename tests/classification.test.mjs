import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyServices } from '../scripts/classify-services.mjs';
import { mergeGraph } from '../scripts/refresh.mjs';
import { scanProject } from '../scripts/scan-project.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const service = () => ({ id: 'firebase', name: 'Firebase', evidence: [{ type: 'package', value: 'firebase' }] });

test('saved model and manual assignments survive changed detection evidence', () => {
  const previous = [{ ...service(), groups: ['infrastructure', 'developer-tools'] }];
  const changed = service();
  changed.evidence.push({ type: 'package', value: 'firebase-admin' });
  const result = classifyServices([changed], { previous });
  assert.deepEqual(result[0].groups, previous[0].groups);
  assert.equal(result[0].evidence.length, 2);
  result[0].groups.push('integrations');
  assert.equal(previous[0].groups.length, 2);
});

test('new services await agent review and invalid saved groups are ignored', () => {
  assert.deepEqual(classifyServices([service()])[0].groups, []);
  for (const groups of [null, 'infrastructure', ['unknown'], ['infrastructure', 'infrastructure']]) {
    const result = classifyServices([service()], { previous: [{ ...service(), groups }] });
    assert.deepEqual(result[0].groups, Array.isArray(groups) && groups.includes('infrastructure') ? ['infrastructure'] : []);
  }
});

test('refresh preserves manual grouping while replacing detection evidence', () => {
  const previous = { services: [{ ...service(), groups: ['infrastructure'] }], edges: [], project: { root: '/example' }, summary: {} };
  const current = structuredClone(previous); current.services[0].groups = ['integrations'];
  const fresh = structuredClone(previous);
  fresh.services[0].evidence.push({ type: 'package', value: 'firebase-admin' });
  const result = mergeGraph(previous, current, fresh);
  assert.deepEqual(result.services[0].groups, ['integrations']);
  assert.equal(result.services[0].evidence.length, 2);
});

test('real scanner needs no model API and preserves saved categories in normal and check modes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-categories-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Scanner must not request a model'); };
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'example', dependencies: { firebase: '*' } }));
    const initial = await scanProject(root);
    const firebase = initial.services.find(item => item.id === 'firebase');
    assert.ok(firebase);
    assert.deepEqual(firebase.groups, []);
    const previous = [{ ...firebase, groups: ['infrastructure'] }];
    for (const check of [false, true]) {
      const result = await scanProject(root, [], { check, previous });
      const saved = result.services.find(item => item.id === 'firebase');
      assert.deepEqual(saved.groups, ['infrastructure']);
      assert.equal(saved.classification, undefined);
    }
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});
