import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyServices } from '../scripts/classify-services.mjs';
import { mergeGraph } from '../scripts/refresh.mjs';
const service = () => ({ id: 'firebase', name: 'Firebase', evidence: [{ type: 'package', value: 'firebase' }] });
const response = () => ({ ok: true, json: async () => ({ answers: ['infrastructure', 'integrations', 'developer-tools'].map((name, i) => ({ name, type: 'predicate', probability: [0.99, 0.1, 0.91][i] })) }) });
test('classification supports multiple groups, caches evidence and invalidates changes', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => { calls++; assert.equal(url, 'https://api.openai.com/v1/decisions'); assert.equal(JSON.parse(options.body).questions.length, 3); return response(); };
  const first = await classifyServices([service()], { apiKey: 'test', fetchImpl });
  assert.deepEqual(first[0].groups, ['infrastructure', 'developer-tools']);
  await classifyServices([service()], { previous: first, apiKey: 'test', fetchImpl });
  assert.equal(calls, 1);
  const changed = service(); changed.evidence.push({ type: 'package', value: 'firebase-admin' });
  await classifyServices([changed], { previous: first, apiKey: 'test', fetchImpl });
  assert.equal(calls, 2);
});
test('missing credentials, check mode and malformed answers fail safely', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ answers: [] }) }; };
  for (const options of [{}, { apiKey: 'test', check: true }, { apiKey: 'test' }]) {
    const result = await classifyServices([service()], { ...options, fetchImpl, warn() {} });
    assert.deepEqual(result[0].groups, []);
    assert.equal(result[0].classification, undefined);
  }
  assert.equal(calls, 1);
});
test('refresh preserves manual grouping while replacing detection evidence', async () => {
  const services = await classifyServices([service()], { apiKey: 'test', fetchImpl: async () => response() });
  const previous = { services, edges: [], project: { root: '/example' }, summary: {} };
  const current = structuredClone(previous); current.services[0].groups = ['integrations'];
  const fresh = structuredClone(previous); fresh.services[0].groups = ['infrastructure'];
  assert.deepEqual(mergeGraph(previous, current, fresh).services[0].groups, ['integrations']);
});
