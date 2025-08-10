"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFileTreeText = parseFileTreeText;
function stripCodeFences(text) {
    // remove surrounding ``` optionally with language
    return text.replace(/^\s*```[\w-]*\n?/, "").replace(/\n?```\s*$/, "");
}
function isTreeCharsPresent(text) {
    return /[├└│─]{1,}/.test(text);
}
function isDotIndentation(text) {
    // check if any line starts with dot(s) followed by a non-space char
    return /^\.+\S/m.test(text);
}
function detectIndentationUnit(lines) {
    for (const l of lines) {
        const match = l.match(/^([ \t]+)/);
        if (match) {
            return match[1].includes("\t") ? "\t" : " ".repeat(match[1].length);
        }
    }
    return "  "; // default 2 spaces
}
// Parse tree-symbol format like:
// my-project/
// ├── src/
// │   ├── index.js
// │   └── utils/
// │       └── helper.js
// ├── package.json
// └── README.md
function parseTreeSymbols(lines) {
    const nodes = [];
    for (const raw of lines) {
        const line = raw.replace(/\r$/, "").replace(/^\s+/, "");
        if (!line.trim() ||
            line.trim().startsWith("#") ||
            line.trim().startsWith("//")) {
            continue;
        }
        // Remove all leading tree chars (│, ├, └, ─) and spaces before the actual name
        const rest = line.replace(/^[│\s├└─]+/, "").trim();
        // Approximate depth by counting leading whitespace and pipes on raw line
        const depthPrefix = raw.match(/^[\s│]*/)?.[0] ?? "";
        let depth = Math.floor(depthPrefix.replace(/\t/g, "    ").length / 4);
        // fallback: count '│' characters in prefix
        const pipeCount = (depthPrefix.match(/[│]/g) || []).length;
        depth = Math.max(depth, pipeCount);
        nodes.push({ depth, name: rest });
    }
    // Convert flat nodes to tree structure
    const rootNodes = [];
    const stack = [];
    for (const n of nodes) {
        const isDir = /\/$/.test(n.name) || !/\.[^\/]+$/.test(n.name);
        const cleanedName = n.name.replace(/\/$/, "").trim();
        let content = undefined;
        const inline = cleanedName.match(/^([^:]+)\s*:\s*(.*)$/);
        let nodeName = cleanedName;
        if (inline) {
            nodeName = inline[1].trim();
            content = inline[2];
        }
        const node = {
            name: nodeName,
            isDirectory: isDir && !inline,
            content,
        };
        while (stack.length > 0 && stack[stack.length - 1].depth >= n.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            rootNodes.push(node);
            stack.push({ node, depth: n.depth });
        }
        else {
            const parent = stack[stack.length - 1].node;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(node);
            stack.push({ node, depth: n.depth });
        }
    }
    return rootNodes;
}
// Parse indentation-based format like:
// my-project
//   src
//     index.js
//   package.json
//   README.md
function parseIndentation(lines) {
    const indentUnit = detectIndentationUnit(lines);
    const unitIsTab = indentUnit === "\t";
    const nodes = [];
    for (const line of lines) {
        const raw = line.replace(/\r$/, "");
        if (!raw.trim() ||
            raw.trim().startsWith("#") ||
            raw.trim().startsWith("//")) {
            continue;
        }
        const leadingMatch = raw.match(/^([ \t]*)/);
        const leading = leadingMatch ? leadingMatch[1] : "";
        const depth = unitIsTab
            ? leading.split("\t").length - 1
            : Math.floor(leading.length / Math.max(1, indentUnit.length));
        const name = raw.trim();
        nodes.push({ depth, name });
    }
    // Convert flat nodes to tree
    const rootNodes = [];
    const stack = [];
    for (const n of nodes) {
        const isDir = /\/$/.test(n.name) || !/\.[^\/]+$/.test(n.name);
        const cleanedName = n.name.replace(/\/$/, "").trim();
        let content = undefined;
        const inline = cleanedName.match(/^([^:]+)\s*:\s*(.*)$/);
        let nodeName = cleanedName;
        if (inline) {
            nodeName = inline[1].trim();
            content = inline[2];
        }
        const node = {
            name: nodeName,
            isDirectory: isDir && !inline,
            content,
        };
        while (stack.length > 0 && stack[stack.length - 1].depth >= n.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            rootNodes.push(node);
            stack.push({ node, depth: n.depth });
        }
        else {
            const parent = stack[stack.length - 1].node;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(node);
            stack.push({ node, depth: n.depth });
        }
    }
    return rootNodes;
}
// Parse dot-indentation format like:
// .myproject
// ..src
// ...index.js
// ..package.json
// ..readme
function parseDotIndentation(lines) {
    const nodes = [];
    for (const raw of lines) {
        if (!raw.trim() ||
            raw.trim().startsWith("#") ||
            raw.trim().startsWith("//")) {
            continue;
        }
        const match = raw.match(/^(\.+)(.*)$/);
        if (!match) {
            // No leading dots = root level
            nodes.push({ depth: 0, name: raw.trim() });
            continue;
        }
        const depth = match[1].length;
        const name = match[2].trim();
        nodes.push({ depth, name });
    }
    // Convert flat nodes to tree
    const rootNodes = [];
    const stack = [];
    for (const n of nodes) {
        const isDir = /\/$/.test(n.name) || !/\.[^\/]+$/.test(n.name);
        const cleanedName = n.name.replace(/\/$/, "").trim();
        let content = undefined;
        const inline = cleanedName.match(/^([^:]+)\s*:\s*(.*)$/);
        let nodeName = cleanedName;
        if (inline) {
            nodeName = inline[1].trim();
            content = inline[2];
        }
        const node = {
            name: nodeName,
            isDirectory: isDir && !inline,
            content,
        };
        while (stack.length > 0 && stack[stack.length - 1].depth >= n.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            rootNodes.push(node);
            stack.push({ node, depth: n.depth });
        }
        else {
            const parent = stack[stack.length - 1].node;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(node);
            stack.push({ node, depth: n.depth });
        }
    }
    return rootNodes;
}
function parseFileTreeText(text) {
    // Normalize newlines and strip code fences
    text = text.replace(/\r\n/g, "\n").replace(/\t\r/g, "\n");
    text = stripCodeFences(text).trim();
    const lines = text.split(/\n/).map((l) => l.replace(/\t/g, "  "));
    let roots = [];
    if (isTreeCharsPresent(text)) {
        roots = parseTreeSymbols(lines);
    }
    else if (isDotIndentation(text)) {
        roots = parseDotIndentation(lines);
    }
    else {
        roots = parseIndentation(lines);
    }
    // If multiple root nodes, create a synthetic root
    const root = { name: ".", isDirectory: true, children: [] };
    for (const r of roots) {
        root.children.push(r);
    }
    // Assign full relative paths to each node
    function assignPaths(node, currentPath) {
        const name = node.name === "." ? "" : node.name;
        const full = currentPath
            ? name
                ? `${currentPath}/${name}`
                : currentPath
            : name || "";
        node.fullPath = full || (node.isDirectory ? "" : node.name);
        if (node.children) {
            for (const c of node.children) {
                assignPaths(c, full);
            }
        }
    }
    assignPaths(root, "");
    return root;
}
//# sourceMappingURL=parser.js.map