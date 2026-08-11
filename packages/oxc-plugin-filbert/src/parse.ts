// Thin wrapper around oxc-parser.
//
// Parses TS/TSX/JS/JSX by extension (oxc infers from the filename), returns
// the ESTree-shaped program, and precomputes a module-scope `const` binding
// table used by the static-extraction pass. Function-scope shadowing is
// intentionally NOT tracked — the plugin bails if the tagged template isn't
// module-scope, matching the babel plugin's conservative behaviour.

import { parseSync } from 'oxc-parser';

// Node type from oxc-parser is a plain JS object with an ESTree-ish shape and
// `start` / `end` byte offsets. We type it loosely because a strict typing of
// the entire oxc AST buys us nothing here — every access is a shallow
// property read against a discriminated `type` string.
export type Node = any;

export interface ParsedFile {
  program: Node;
  moduleConsts: Map<string, Node>; // top-level `const foo = <init>` bindings.
  moduleBindingKinds: Map<string, 'const' | 'let' | 'var' | 'import' | 'fn' | 'class'>;
  source: string;
  filename: string;
}

export class OxcParseError extends Error {
  filename: string;
  detail: unknown;
  constructor(msg: string, filename: string, detail: unknown) {
    super(msg);
    this.name = 'OxcParseError';
    this.filename = filename;
    this.detail = detail;
  }
}

export function parseFile(filename: string, source: string): ParsedFile {
  const result = parseSync(filename, source);
  // oxc emits parse errors as `result.errors` (non-empty on failure). Some
  // TS-specific things (decorators, syntax additions) may not parse.
  if (result.errors && result.errors.length > 0) {
    // Prefer to include the first error's message for the fallback log.
    const first: any = result.errors[0];
    const msg = first?.message || 'oxc-parser failed';
    throw new OxcParseError(msg, filename, result.errors);
  }
  const program = result.program;
  const { moduleConsts, moduleBindingKinds } = buildModuleBindings(program);
  return { program, moduleConsts, moduleBindingKinds, source, filename };
}

function buildModuleBindings(program: Node): {
  moduleConsts: Map<string, Node>;
  moduleBindingKinds: Map<string, 'const' | 'let' | 'var' | 'import' | 'fn' | 'class'>;
} {
  const moduleConsts = new Map<string, Node>();
  const moduleBindingKinds = new Map<
    string,
    'const' | 'let' | 'var' | 'import' | 'fn' | 'class'
  >();
  for (const stmt of program.body || []) {
    if (stmt.type === 'VariableDeclaration') {
      const kind: 'const' | 'let' | 'var' = stmt.kind;
      for (const d of stmt.declarations || []) {
        // Only track plain `Identifier` binders — patterns aren't in scope
        // for the semantics we mirror from the babel plugin.
        if (d.id?.type === 'Identifier') {
          moduleBindingKinds.set(d.id.name, kind);
          if (kind === 'const' && d.init) moduleConsts.set(d.id.name, d.init);
        }
      }
    } else if (stmt.type === 'FunctionDeclaration') {
      if (stmt.id?.type === 'Identifier') moduleBindingKinds.set(stmt.id.name, 'fn');
    } else if (stmt.type === 'ClassDeclaration') {
      if (stmt.id?.type === 'Identifier') moduleBindingKinds.set(stmt.id.name, 'class');
    } else if (stmt.type === 'ImportDeclaration') {
      for (const spec of stmt.specifiers || []) {
        if (spec.local?.type === 'Identifier') moduleBindingKinds.set(spec.local.name, 'import');
      }
    }
  }
  return { moduleConsts, moduleBindingKinds };
}

// Depth-first walker. We use a hand-rolled walker instead of `estree-walker`
// or oxc's Visitor to keep the runtime dep count tiny — every extra layer of
// closure would show up on the hot path where we transform thousands of
// files per build.
//
// `visit` can return `false` to skip children.
export function walk(
  node: Node,
  visit: (n: Node, parent: Node | null, key: string | number | null) => void | boolean,
  parent: Node | null = null,
  key: string | number | null = null,
): void {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const stop = visit(node, parent, key);
  if (stop === false) return;
  // Pull child keys from the shared visitorKeys map (per-type constant, no
  // Object.keys() at every node). Falls back to a scan for unknown node
  // types (extensions / new syntax we haven't listed).
  const keys = VISITOR_KEYS[node.type as string];
  if (keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = (node as any)[k];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j++) walk(v[j], visit, node, j);
      } else if (typeof (v as any).type === 'string') {
        walk(v, visit, node, k);
      }
    }
    return;
  }
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    const v = (node as any)[k];
    if (Array.isArray(v)) {
      for (let j = 0; j < v.length; j++) walk(v[j], visit, node, j);
    } else if (v && typeof v === 'object' && typeof (v as any).type === 'string') {
      walk(v, visit, node, k);
    }
  }
}

// The keys we actually traverse. This is a superset of what we need but
// stays deliberately narrow; anything unrecognised falls back to the
// property-scan branch above.
const VISITOR_KEYS: Record<string, string[]> = {
  Program: ['body'],
  ExpressionStatement: ['expression'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id', 'init'],
  FunctionDeclaration: ['id', 'params', 'body'],
  FunctionExpression: ['id', 'params', 'body'],
  ArrowFunctionExpression: ['params', 'body'],
  BlockStatement: ['body'],
  ReturnStatement: ['argument'],
  IfStatement: ['test', 'consequent', 'alternate'],
  ConditionalExpression: ['test', 'consequent', 'alternate'],
  LogicalExpression: ['left', 'right'],
  BinaryExpression: ['left', 'right'],
  UnaryExpression: ['argument'],
  CallExpression: ['callee', 'arguments'],
  MemberExpression: ['object', 'property'],
  TaggedTemplateExpression: ['tag', 'quasi'],
  TemplateLiteral: ['quasis', 'expressions'],
  TemplateElement: [],
  Identifier: [],
  StringLiteral: [],
  NumericLiteral: [],
  BooleanLiteral: [],
  NullLiteral: [],
  Literal: [],
  ImportDeclaration: ['specifiers', 'source'],
  ImportSpecifier: ['local', 'imported'],
  ImportDefaultSpecifier: ['local'],
  ImportNamespaceSpecifier: ['local'],
  ExportNamedDeclaration: ['declaration', 'specifiers', 'source'],
  ExportDefaultDeclaration: ['declaration'],
  ObjectExpression: ['properties'],
  ObjectProperty: ['key', 'value'],
  Property: ['key', 'value'],
  ArrayExpression: ['elements'],
  SpreadElement: ['argument'],
  AssignmentExpression: ['left', 'right'],
  UpdateExpression: ['argument'],
  SequenceExpression: ['expressions'],
  NewExpression: ['callee', 'arguments'],
  ClassDeclaration: ['id', 'superClass', 'body'],
  ClassBody: ['body'],
  MethodDefinition: ['key', 'value'],
  ForStatement: ['init', 'test', 'update', 'body'],
  ForInStatement: ['left', 'right', 'body'],
  ForOfStatement: ['left', 'right', 'body'],
  WhileStatement: ['test', 'body'],
  DoWhileStatement: ['body', 'test'],
  SwitchStatement: ['discriminant', 'cases'],
  SwitchCase: ['test', 'consequent'],
  TryStatement: ['block', 'handler', 'finalizer'],
  CatchClause: ['param', 'body'],
  ThrowStatement: ['argument'],
  ChainExpression: ['expression'],
  AwaitExpression: ['argument'],
  YieldExpression: ['argument'],
  TSAsExpression: ['expression', 'typeAnnotation'],
  TSNonNullExpression: ['expression'],
  TSTypeAssertion: ['typeAnnotation', 'expression'],
  TSSatisfiesExpression: ['expression', 'typeAnnotation'],
  JSXElement: ['openingElement', 'children', 'closingElement'],
  JSXFragment: ['openingFragment', 'children', 'closingFragment'],
  JSXOpeningElement: ['name', 'attributes'],
  JSXClosingElement: ['name'],
  JSXAttribute: ['name', 'value'],
  JSXSpreadAttribute: ['argument'],
  JSXExpressionContainer: ['expression'],
  JSXText: [],
};
