import * as babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import NodePath from "@babel/traverse";
import * as t from "@babel/types";

export type Item = {
  type: string;
  name: string;
  signature?: string;
  doc?: string | null;
  loc: number;
  params: number;
  complexity: number;
  calls: string[];
  snippet?: string;
  file: string;
};

export function analyzeJSFile(code: string, filePath: string): Item[] {
  const ast = babelParser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "classProperties", "decorators-legacy"],
  });

  const items: Item[] = [];

  // Helper to compute simple complexity
  function complexityFromNode(node: t.Node): number {
    let count = 1;
    traverse(
      node,
      {
        enter(path: NodePath<t.Node>) {
          if (
            t.isIfStatement(path.node) ||
            t.isForStatement(path.node) ||
            t.isWhileStatement(path.node) ||
            t.isSwitchCase(path.node) ||
            t.isConditionalExpression(path.node) ||
            t.isLogicalExpression(path.node)
          ) {
            count += 1;
          }
        },
      },
      undefined,
      {}
    );
    return count;
  }

  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const node = path.node;
      const name = node.id?.name ?? "<anonymous>";
      const params = node.params.length;
      const loc = node.loc ? node.loc.end.line - node.loc.start.line + 1 : 0;
      const complexity = complexityFromNode(node);

      const calls: string[] = [];
      path.traverse({
        CallExpression(innerPath: NodePath<t.CallExpression>) {
          const callee = innerPath.node.callee;
          if (t.isIdentifier(callee)) {
            calls.push(callee.name);
          } else if (
            t.isMemberExpression(callee) &&
            t.isIdentifier(callee.property)
          ) {
            calls.push(callee.property.name);
          }
        },
      });

      const snippet = code.slice(node.start ?? 0, node.end ?? 0);

      items.push({
        type: "function",
        name,
        signature: `${name}(${params})`,
        doc: null,
        loc,
        params,
        complexity,
        calls,
        snippet,
        file: filePath,
      });
    },

    ClassDeclaration(path: NodePath<t.ClassDeclaration>) {
      const node = path.node;
      const name = node.id?.name ?? "<anonymous class>";
      const loc = node.loc ? node.loc.end.line - node.loc.start.line + 1 : 0;

      const methods: Item[] = [];
      node.body.body.forEach((member: t.ClassBody["body"][number]) => {
        if (t.isClassMethod(member) || t.isClassPrivateMethod(member)) {
          const mName = t.isIdentifier(member.key)
            ? member.key.name
            : "<method>";
          const params = member.params.length;
          const mLoc = member.loc
            ? member.loc.end.line - member.loc.start.line + 1
            : 0;
          const complexity = complexityFromNode(member);

          methods.push({
            type: "method",
            name: `${name}.${mName}`,
            signature: `${mName}(${params})`,
            doc: null,
            loc: mLoc,
            params,
            complexity,
            calls: [],
            snippet: code.slice(member.start ?? 0, member.end ?? 0),
            file: filePath,
          });
        }
      });

      items.push({
        type: "class",
        name,
        signature: name,
        doc: null,
        loc,
        params: 0,
        complexity: 0,
        calls: [],
        snippet: code.slice(node.start ?? 0, node.end ?? 0),
        file: filePath,
      });

      items.push(...methods);
    },
  });

  return items;
}
