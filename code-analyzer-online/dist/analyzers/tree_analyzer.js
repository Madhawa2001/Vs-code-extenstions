"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTextWithTreeSitter = analyzeTextWithTreeSitter;
exports.analyzeFileWithTreeSitter = analyzeFileWithTreeSitter;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tree_sitter_1 = __importDefault(require("tree-sitter"));
// import grammars
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const tsx_1 = __importDefault(require("tree-sitter-typescript/tsx"));
const tree_sitter_java_1 = __importDefault(require("tree-sitter-java"));
const tree_sitter_c_sharp_1 = __importDefault(require("tree-sitter-c-sharp"));
const LANG_BY_EXT = {
    ".py": { name: "python", grammar: tree_sitter_python_1.default },
    ".js": { name: "javascript", grammar: tree_sitter_javascript_1.default },
    ".jsx": { name: "javascript", grammar: tree_sitter_javascript_1.default },
    ".ts": { name: "typescript", grammar: tsx_1.default },
    ".tsx": { name: "typescript", grammar: tsx_1.default },
    ".java": { name: "java", grammar: tree_sitter_java_1.default },
    ".cs": { name: "c_sharp", grammar: tree_sitter_c_sharp_1.default },
};
function extForPath(fp) {
    return path.extname(fp).toLowerCase();
}
function nodeText(source, node) {
    return source.slice(node.startIndex, node.endIndex);
}
function nodeLoc(node) {
    if (!node.startPosition || !node.endPosition) {
        return 0;
    }
    return node.endPosition.row - node.startPosition.row + 1;
}
function estimateComplexityFromNode(node) {
    let count = 1;
    const stack = [node];
    while (stack.length) {
        const n = stack.pop();
        if (!n || !n.type) {
            continue;
        }
        const t = n.type;
        if (t === "if_statement" ||
            t === "for_statement" ||
            t === "while_statement" ||
            t === "switch_statement" ||
            t === "catch_clause" ||
            t === "conditional_expression") {
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
function extractCallsFromNode(node, source) {
    const calls = new Set();
    const stack = [node];
    while (stack.length) {
        const n = stack.pop();
        if (!n) {
            continue;
        }
        if (n.type === "call" ||
            n.type === "call_expression" ||
            n.type === "function_call" ||
            n.type === "method_invocation" ||
            n.type === "invocation_expression") {
            // heuristic: find first child that looks like an identifier or member expression
            const callee = n.namedChildren && n.namedChildren[0]
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
                }
                catch (e) { }
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
function findTopLevelDefinitions(tree) {
    const root = tree.rootNode;
    const results = [];
    const stack = [root];
    while (stack.length) {
        const n = stack.pop();
        if (!n) {
            continue;
        }
        if (n.type &&
            (n.type.includes("function") ||
                n.type.includes("method") ||
                n.type.includes("class"))) {
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
function extractFunctionInfo(node, source) {
    let name = "<anonymous>";
    let params = 0;
    try {
        const id = node.namedChildren.find((c) => c.type === "identifier" ||
            c.type === "name" ||
            c.type === "function_name");
        if (id) {
            name = nodeText(source, id);
        }
        const paramsNode = node.namedChildren.find((c) => c.type === "parameters" ||
            c.type === "parameter_list" ||
            c.type === "formal_parameters" ||
            c.type === "argument_list");
        if (paramsNode) {
            // count identifiers or commas
            const text = nodeText(source, paramsNode);
            const inner = text.replace(/^\(|\)$/g, "").trim();
            if (!inner) {
                params = 0;
            }
            else {
                params = inner.split(",").filter((s) => s.trim().length > 0).length;
            }
        }
        else {
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
    }
    catch (e) { }
    const snippet = nodeText(source, node);
    const signature = `${name}(${params})`;
    return { name, params, signature, snippet };
}
function analyzeTextWithTreeSitter(source, filePath) {
    const ext = extForPath(filePath);
    const langEntry = LANG_BY_EXT[ext];
    if (!langEntry) {
        return [];
    }
    const parser = new tree_sitter_1.default();
    try {
        parser.setLanguage(langEntry.grammar);
    }
    catch (err) {
        console.warn("Failed to set tree-sitter language", err);
        return [];
    }
    const tree = parser.parse(source);
    const defs = findTopLevelDefinitions(tree);
    const items = [];
    for (const d of defs) {
        try {
            const typ = d.type;
            const { name, params, signature, snippet } = extractFunctionInfo(d, source);
            const loc = nodeLoc(d);
            const complexity = estimateComplexityFromNode(d);
            const calls = extractCallsFromNode(d, source);
            let ttype = "unknown";
            if (typ.includes("class")) {
                ttype = "class";
            }
            else if (typ.includes("function") || typ.includes("method")) {
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
        }
        catch (e) {
            console.warn("node analysis error", e);
        }
    }
    return items;
}
function analyzeFileWithTreeSitter(filePath) {
    const src = fs.readFileSync(filePath, { encoding: "utf8" });
    return analyzeTextWithTreeSitter(src, filePath);
}
//# sourceMappingURL=tree_analyzer.js.map