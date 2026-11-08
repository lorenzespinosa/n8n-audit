import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeWorkflow,
  longestChain,
  connectedNames,
  targetsOf,
  isFallible,
  isTriggerLike,
  isStickyNote,
  baseType,
} from '../src/workflow.js';

test('looksLikeWorkflow accepts an exported workflow shape', () => {
  const workflow = {
    name: 'Demo',
    nodes: [{ name: 'A', type: 'n8n-nodes-base.noOp', position: [0, 0] }],
    connections: {},
    settings: {},
  };
  assert.equal(looksLikeWorkflow(workflow), true);
});

test('looksLikeWorkflow accepts an empty nodes array', () => {
  assert.equal(looksLikeWorkflow({ name: 'Empty', nodes: [], connections: {} }), true);
});

test('looksLikeWorkflow rejects non-workflow JSON', () => {
  assert.equal(looksLikeWorkflow(null), false);
  assert.equal(looksLikeWorkflow('workflow'), false);
  assert.equal(looksLikeWorkflow([]), false);
  assert.equal(looksLikeWorkflow({ name: 'pkg', version: '1.0.0' }), false);
  assert.equal(looksLikeWorkflow({ name: 'x', nodes: 'not-an-array' }), false);
  assert.equal(looksLikeWorkflow({ nodes: [{ name: 'A', type: 't' }] }), false);
});

test('looksLikeWorkflow rejects nodes missing name or type', () => {
  assert.equal(looksLikeWorkflow({ name: 'x', nodes: [{ name: 'A' }] }), false);
  assert.equal(looksLikeWorkflow({ name: 'x', nodes: [{ type: 't' }] }), false);
});

test('baseType strips the package prefix and lowercases', () => {
  assert.equal(baseType({ type: 'n8n-nodes-base.httpRequest' }), 'httprequest');
  assert.equal(baseType({ type: 'n8n-nodes-base.stickyNote' }), 'stickynote');
  assert.equal(baseType({ type: 'weird/custom.Node' }), 'node');
});

test('isFallible matches http, code and database nodes', () => {
  assert.equal(isFallible({ type: 'n8n-nodes-base.httpRequest' }), true);
  assert.equal(isFallible({ type: 'n8n-nodes-base.code' }), true);
  assert.equal(isFallible({ type: 'n8n-nodes-base.postgres' }), true);
  assert.equal(isFallible({ type: 'n8n-nodes-base.executeCommand' }), true);
});

test('isFallible does not match lookalikes such as qrcode', () => {
  assert.equal(isFallible({ type: 'n8n-nodes-base.qrcode' }), false);
  assert.equal(isFallible({ type: 'n8n-nodes-base.set' }), false);
  assert.equal(isFallible({ type: 'n8n-nodes-base.webhook' }), false);
});

test('isTriggerLike covers triggers, webhook and start', () => {
  assert.equal(isTriggerLike({ type: 'n8n-nodes-base.scheduleTrigger' }), true);
  assert.equal(isTriggerLike({ type: 'n8n-nodes-base.webhook' }), true);
  assert.equal(isTriggerLike({ type: 'n8n-nodes-base.start' }), true);
  assert.equal(isTriggerLike({ type: 'n8n-nodes-base.set' }), false);
});

test('isStickyNote detects sticky notes', () => {
  assert.equal(isStickyNote({ type: 'n8n-nodes-base.stickyNote' }), true);
  assert.equal(isStickyNote({ type: 'n8n-nodes-base.set' }), false);
});

test('longestChain counts nodes along the longest path', () => {
  const connections = {
    A: { main: [[{ node: 'B' }]] },
    B: { main: [[{ node: 'C' }]] },
    C: { main: [[]] },
  };
  assert.equal(longestChain(connections), 3);
});

test('longestChain picks the longer branch', () => {
  const connections = {
    Start: { main: [[{ node: 'Short' }, { node: 'Long1' }]] },
    Short: { main: [[]] },
    Long1: { main: [[{ node: 'Long2' }]] },
    Long2: { main: [[]] },
  };
  assert.equal(longestChain(connections), 3);
});

test('longestChain survives cycles without hanging', () => {
  const connections = {
    A: { main: [[{ node: 'B' }]] },
    B: { main: [[{ node: 'A' }]] },
  };
  assert.equal(typeof longestChain(connections), 'number');
});

test('connectedNames unions sources and targets', () => {
  const connections = {
    A: { main: [[{ node: 'B' }]] },
    B: { main: [[]] },
  };
  assert.deepEqual([...connectedNames(connections)].sort(), ['A', 'B']);
  assert.equal(connectedNames(undefined).size, 0);
});

test('targetsOf reads targets across all output groups', () => {
  const connections = {
    A: {
      main: [
        [{ node: 'B' }],
        [{ node: 'C' }],
      ],
      ai_tool: [[{ node: 'D' }]],
    },
  };
  assert.deepEqual(targetsOf(connections, 'A'), ['B', 'C', 'D']);
  assert.deepEqual(targetsOf(connections, 'Missing'), []);
});
