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
exports.analyzeJSFile = analyzeJSFile;
const babelParser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
function analyzeJSFile(code, filePath) {
    const ast = babelParser.parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "classProperties", "decorators-legacy"],
    });
    const items = [];
    // Helper to compute simple complexity
    function complexityFromNode(node) {
        let count = 1;
        (0, traverse_1.default)(node, {
            enter(path) {
                if (t.isIfStatement(path.node) ||
                    t.isForStatement(path.node) ||
                    t.isWhileStatement(path.node) ||
                    t.isSwitchCase(path.node) ||
                    t.isConditionalExpression(path.node) ||
                    t.isLogicalExpression(path.node)) {
                    count += 1;
                }
            },
        }, undefined, {});
        return count;
    }
    (0, traverse_1.default)(ast, {
        FunctionDeclaration(path) {
            const node = path.node;
            const name = node.id?.name ?? "<anonymous>";
            const params = node.params.length;
            const loc = node.loc ? node.loc.end.line - node.loc.start.line + 1 : 0;
            const complexity = complexityFromNode(node);
            const calls = [];
            path.traverse({
                CallExpression(innerPath) {
                    const callee = innerPath.node.callee;
                    if (t.isIdentifier(callee)) {
                        calls.push(callee.name);
                    }
                    else if (t.isMemberExpression(callee) &&
                        t.isIdentifier(callee.property)) {
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
        ClassDeclaration(path) {
            const node = path.node;
            const name = node.id?.name ?? "<anonymous class>";
            const loc = node.loc ? node.loc.end.line - node.loc.start.line + 1 : 0;
            const methods = [];
            node.body.body.forEach((member) => {
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
//# sourceMappingURL=js_analyzer.js.map