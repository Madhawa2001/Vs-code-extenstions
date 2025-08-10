#!/usr/bin/env python3
import ast, sys, json, textwrap

def estimate_complexity(node):
    class C(ast.NodeVisitor):
        def __init__(self):
            self.count = 1
        def visit_If(self, node): self.count += 1; self.generic_visit(node)
        def visit_For(self, node): self.count += 1; self.generic_visit(node)
        def visit_While(self, node): self.count += 1; self.generic_visit(node)
        def visit_Try(self, node): self.count += 1; self.generic_visit(node)
        def visit_BoolOp(self, node): self.count += 1; self.generic_visit(node)
        def visit_IfExp(self, node): self.count += 1; self.generic_visit(node)
    c = C()
    c.visit(node)
    return c.count

def extract_calls(node):
    calls = set()
    class V(ast.NodeVisitor):
        def visit_Call(self, n):
            if isinstance(n.func, ast.Name):
                calls.add(n.func.id)
            elif isinstance(n.func, ast.Attribute):
                parts = []
                cur = n.func
                while isinstance(cur, ast.Attribute):
                    parts.append(cur.attr)
                    cur = cur.value
                if isinstance(cur, ast.Name):
                    parts.append(cur.id)
                calls.add(".".join(reversed(parts)))
            self.generic_visit(n)
    V().visit(node)
    return sorted(list(calls))

def get_source_segment(source, node):
    try:
        return textwrap.dedent(ast.get_source_segment(source, node) or "")
    except Exception:
        return ""

def analyze(path):
    with open(path, "r", encoding="utf8") as f:
        src = f.read()
    tree = ast.parse(src)
    items = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            name = node.name
            doc = ast.get_docstring(node)
            params = len(node.args.args)
            loc = (node.end_lineno - node.lineno + 1) if hasattr(node, "end_lineno") else 0
            complexity = estimate_complexity(node)
            calls = extract_calls(node)
            snippet = get_source_segment(src, node)
            items.append({
                "type": "function",
                "name": name,
                "signature": f"{name}({', '.join([a.arg for a in node.args.args])})",
                "doc": doc,
                "loc": loc,
                "params": params,
                "complexity": complexity,
                "calls": calls,
                "snippet": snippet,
                "side_effects": []
            })
        elif isinstance(node, ast.ClassDef):
            name = node.name
            doc = ast.get_docstring(node)
            loc = (node.end_lineno - node.lineno + 1) if hasattr(node, "end_lineno") else 0
            snippet = get_source_segment(src, node)
            items.append({
                "type": "class",
                "name": name,
                "signature": name,
                "doc": doc,
                "loc": loc,
                "params": 0,
                "complexity": 0,
                "calls": [],
                "snippet": snippet,
                "side_effects": []
            })
            for b in node.body:
                if isinstance(b, ast.FunctionDef):
                    mname = b.name
                    docm = ast.get_docstring(b)
                    mparams = len(b.args.args)
                    mloc = (b.end_lineno - b.lineno + 1) if hasattr(b, "end_lineno") else 0
                    mcomplex = estimate_complexity(b)
                    mcalls = extract_calls(b)
                    msnippet = get_source_segment(src, b)
                    items.append({
                        "type": "method",
                        "name": f"{name}.{mname}",
                        "signature": f"{mname}({', '.join([a.arg for a in b.args.args])})",
                        "doc": docm,
                        "loc": mloc,
                        "params": mparams,
                        "complexity": mcomplex,
                        "calls": mcalls,
                        "snippet": msnippet,
                        "side_effects": []
                    })
    print(json.dumps({"items": items}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python python_analyzer.py path/to/file.py", file=sys.stderr)
        sys.exit(2)
    analyze(sys.argv[1])
