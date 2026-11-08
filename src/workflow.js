/**
 * Shared helpers for reading n8n workflow exports: shape detection,
 * connection graph walks, and node type classification.
 *
 * Everything here is pure. No file IO, so scoring stays easy to test.
 */

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Decide whether parsed JSON looks like an exported n8n workflow.
 * n8n exports carry a name, a nodes array, a connections object and a
 * settings object. We require the nodes array plus a string name, and
 * every node must have string name and type fields. An empty nodes array
 * still counts (freshly created workflows look like that).
 */
export function looksLikeWorkflow(data) {
  if (!isPlainObject(data)) return false;
  if (!Array.isArray(data.nodes)) return false;
  if (typeof data.name !== 'string') return false;
  return data.nodes.every(
    (node) =>
      isPlainObject(node) &&
      typeof node.name === 'string' &&
      typeof node.type === 'string'
  );
}

/**
 * The part after the last dot in an n8n node type, lowercased.
 * "n8n-nodes-base.httpRequest" becomes "httprequest".
 */
export function baseType(node) {
  const type = String(node.type || '');
  const base = type.slice(type.lastIndexOf('.') + 1);
  return base.toLowerCase();
}

/**
 * Node types whose failure breaks the run unless handled: HTTP calls,
 * code execution, databases, remote command and file transfer nodes.
 * Exact base-name match against a built-in list, so "qrcode" never
 * trips the "code" entry.
 */
const FALLIBLE_BASES = new Set([
  'httprequest',
  'request',
  'graphql',
  'code',
  'executecommand',
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'mongodbtwo',
  'mssql',
  'sqlite',
  'redis',
  'supabase',
  'snowflake',
  'bigquery',
  'clickhouse',
  'dynamodb',
  'neo4j',
  'elasticsearch',
  'opensearch',
  'cassandra',
  'couchdb',
  'ssh',
  'ftp',
  'sftp',
  's3',
]);

export function isFallible(node) {
  return FALLIBLE_BASES.has(baseType(node));
}

const TRIGGER_BASES = new Set(['webhook', 'start', 'emailreadimap', 'emailread']);

/**
 * Nodes that legitimately have no input connection: triggers and the
 * legacy start node.
 */
export function isTriggerLike(node) {
  const base = baseType(node);
  return base.endsWith('trigger') || TRIGGER_BASES.has(base);
}

export function isStickyNote(node) {
  return baseType(node) === 'stickynote';
}

/**
 * All target node names a connection entry points at, across every
 * output type ("main", "ai_languageModel", and so on).
 */
export function targetsOf(connections, nodeName) {
  const entry = isPlainObject(connections) ? connections[nodeName] : null;
  if (!isPlainObject(entry)) return [];
  const targets = [];
  for (const outputs of Object.values(entry)) {
    if (!Array.isArray(outputs)) continue;
    for (const group of outputs) {
      if (!Array.isArray(group)) continue;
      for (const conn of group) {
        if (isPlainObject(conn) && typeof conn.node === 'string') {
          targets.push(conn.node);
        }
      }
    }
  }
  return targets;
}

/**
 * Set of every node name that appears in the connection graph, either
 * as a source or as a target.
 */
export function connectedNames(connections) {
  const names = new Set();
  if (!isPlainObject(connections)) return names;
  for (const [source, entry] of Object.entries(connections)) {
    if (!isPlainObject(entry)) continue;
    names.add(source);
    for (const targets of targetsOf(connections, source)) names.add(targets);
  }
  return names;
}

/**
 * True when the node has a wired second "main" output, which in n8n is
 * the error output used by onError: continueErrorOutput.
 */
export function hasWiredErrorOutput(connections, nodeName) {
  const entry = isPlainObject(connections) ? connections[nodeName] : null;
  if (!isPlainObject(entry) || !Array.isArray(entry.main)) return false;
  const second = entry.main[1];
  return Array.isArray(second) && second.length > 0;
}

/**
 * Longest chain of nodes you can walk by following connections.
 * Counts nodes, so a linear A -> B -> C workflow has chain 3. Cycles
 * are cut at the first repeat instead of looping forever.
 */
export function longestChain(connections) {
  const graph = new Map();
  if (isPlainObject(connections)) {
    for (const source of Object.keys(connections)) {
      graph.set(source, targetsOf(connections, source));
    }
  }

  const memo = new Map();
  const onStack = new Set();

  const visit = (name) => {
    const seen = memo.get(name);
    if (seen !== undefined) return seen;
    if (onStack.has(name)) return 0;
    onStack.add(name);
    let best = 0;
    for (const target of graph.get(name) || []) {
      best = Math.max(best, visit(target));
    }
    onStack.delete(name);
    const depth = best + 1;
    memo.set(name, depth);
    return depth;
  };

  let longest = 0;
  for (const name of graph.keys()) {
    longest = Math.max(longest, visit(name));
  }
  return longest;
}

/**
 * Recurse over a parameters tree and call visit(value, key) for every
 * string leaf. Used by the credential scanner.
 */
export function walkStrings(root, visit) {
  const walk = (value, key) => {
    if (typeof value === 'string') {
      visit(value, key);
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, key);
    } else if (isPlainObject(value)) {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey);
      }
    }
  };
  walk(root, undefined);
}
