import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";

// import grammars
import Python from "tree-sitter-python";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript/tsx";
import Java from "tree-sitter-java";
import CSharp from "tree-sitter-c-sharp";

type Item = {
  type: string;
  name: string;
  signature?: string;
  doc?: string | null;
  loc: number;
  params: number;
  complexity: number;
  calls: string[];
  snippet?: string;
  file?: string;
};

const LANG_BY_EXT: { [ext: string]: { name: string; grammar: any } } = {
  ".py": { name: "python", grammar: Python },
  ".js": { name: "javascript", grammar: JavaScript },
  ".jsx": { name: "javascript", grammar: JavaScript },
  ".ts": { name: "typescript", grammar: TypeScript },
  ".tsx": { name: "typescript", grammar: TypeScript },
  ".java": { name: "java", grammar: Java },
  ".cs": { name: "c_sharp", grammar: CSharp },
};

function extForPath(fp: string) {
  return path.extname(fp).toLowerCase();
}

function nodeText(source: string, node: any) {
  return source.slice(node.startIndex, node.endIndex);
}

function nodeLoc(node: any) {
  if (!node.startPosition || !node.endPosition) {
    return 0;
  }
  return node.endPosition.row - node.startPosition.row + 1;
}

function estimateComplexityFromNode(node: any): number {
  let count = 1;
  const stack: any[] = [node];
  while (stack.length) {
    const n = stack.pop();
    if (!n || !n.type) {
      continue;
    }
    const t = n.type;
    if (
      t === "if_statement" ||
      t === "for_statement" ||
      t === "while_statement" ||
      t === "switch_statement" ||
      t === "catch_clause" ||
      t === "conditional_expression"
    ) {
      count += 1;
    }
    if (n.children && n.children.length) {
      for (let i = 0; i < n.children.length; i++) {
        stack.push(n.children[i]);
      }
    }
  }
  return count;
}

function extractCallsFromNode(node: any, source: string): string[] {
  const calls: Set<string> = new Set();
  const stack: any[] = [node];
  while (stack.length) {
    const n = stack.pop();
    if (!n) {
      continue;
    }
    if (
      n.type === "call" ||
      n.type === "call_expression" ||
      n.type === "function_call" ||
      n.type === "method_invocation" ||
      n.type === "invocation_expression"
    ) {
      // heuristic: find first child that looks like an identifier or member expression
      const callee =
        n.namedChildren && n.namedChildren[0]
          ? n.namedChildren[0]
          : n.childCount
          ? n.child(0)
          : null;
      if (callee) {
        try {
          const txt = nodeText(source, callee).trim();
          if (txt) {
            calls.add(txt.split(/\s*\(/)[0]);
          }
        } catch (e) {}
      }
    }
    if (n.children && n.children.length) {
      for (let i = 0; i < n.children.length; i++) {
        stack.push(n.children[i]);
      }
    }
  }
  return Array.from(calls);
}

function findTopLevelDefinitions(tree: any): any[] {
  const root = tree.rootNode;
  const results: any[] = [];
  const stack: any[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) {
      continue;
    }
    if (
      n.type &&
      (n.type.includes("function") ||
        n.type.includes("method") ||
        n.type.includes("class"))
    ) {
      // prefer named nodes only (heuristic)
      results.push(n);
      continue;
    }
    if (n.children && n.children.length) {
      for (let i = 0; i < n.children.length; i++) {
        stack.push(n.children[i]);
      }
    }
  }
  return results;
}

function extractFunctionInfo(
  node: any,
  source: string
): { name: string; params: number; signature?: string; snippet?: string } {
  let name = "<anonymous>";
  let params = 0;
  try {
    const id = node.namedChildren.find(
      (c: any) =>
        c.type === "identifier" ||
        c.type === "name" ||
        c.type === "function_name"
    );
    if (id) {
      name = nodeText(source, id);
    }
    const paramsNode = node.namedChildren.find(
      (c: any) =>
        c.type === "parameters" ||
        c.type === "parameter_list" ||
        c.type === "formal_parameters" ||
        c.type === "argument_list"
    );
    if (paramsNode) {
      // count identifiers or commas
      const text = nodeText(source, paramsNode);
      const inner = text.replace(/^\(|\)$/g, "").trim();
      if (!inner) {
        params = 0;
      } else {
        params = inner.split(",").filter((s) => s.trim().length > 0).length;
      }
    } else {
      // fallback: try to detect parentheses in the substring
      const txt = nodeText(source, node);
      const m = txt.match(/\(([\s\S]*?)\)/);
      if (m && m[1]) {
        const inner = m[1].trim();
        params = inner
          ? inner.split(",").filter((s) => s.trim().length > 0).length
          : 0;
      }
    }
  } catch (e) {}
  const snippet = nodeText(source, node);
  const signature = `${name}(${params})`;
  return { name, params, signature, snippet };
}

export function analyzeTextWithTreeSitter(
  source: string,
  filePath: string
): Item[] {
  const ext = extForPath(filePath);
  const langEntry = LANG_BY_EXT[ext];
  if (!langEntry) {
    return [];
  }

  const parser = new Parser();
  try {
    parser.setLanguage(langEntry.grammar);
  } catch (err) {
    console.warn("Failed to set tree-sitter language", err);
    return [];
  }

  const tree = parser.parse(source);
  const defs = findTopLevelDefinitions(tree);
  const items: Item[] = [];

  for (const d of defs) {
    try {
      const typ = d.type;
      const { name, params, signature, snippet } = extractFunctionInfo(
        d,
        source
      );
      const loc = nodeLoc(d);
      const complexity = estimateComplexityFromNode(d);
      const calls = extractCallsFromNode(d, source);

      let ttype = "unknown";
      if (typ.includes("class")) {
        ttype = "class";
      } else if (typ.includes("function") || typ.includes("method")) {
        ttype = "function";
      }

      items.push({
        type: ttype,
        name,
        signature,
        doc: null,
        loc,
        params,
        complexity,
        calls,
        snippet,
        file: filePath,
      });
    } catch (e) {
      console.warn("node analysis error", e);
    }
  }
  return items;
}

export function analyzeFileWithTreeSitter(filePath: string): Item[] {
  const src = fs.readFileSync(filePath, { encoding: "utf8" });
  return analyzeTextWithTreeSitter(src, filePath);
}
