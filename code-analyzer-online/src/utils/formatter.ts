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

export function formatRationaleFromItems(items: Item[]): string {
  const byFile = new Map<string, Item[]>();

  items.forEach((it) => {
    const fileKey = it.file ?? "unknown";
    const arr = byFile.get(fileKey) ?? [];
    arr.push(it);
    byFile.set(fileKey, arr);
  });

  let md = "";

  // Header for whole document
  if (byFile.size === 1) {
    md += "# Generated Rationale Document\n\n";
  } else {
    md += "# Generated Rationale Document (workspace)\n\n";
  }

  // General note about offline mode
  md +=
    "_Note: This rationale is generated offline. Use AI mode for richer descriptions._\n\n";

  for (const [file, its] of byFile.entries()) {
    md += `---\n\n## File: ${file}\n\n`;

    // List all functions/classes for this file
    for (const it of its) {
      md += `### ${it.type}: ${it.name}\n\n`;
      md += `**Signature:** \`${it.signature ?? ""}\`\n\n`;
      md += `**LOC:** ${it.loc}  \n**Params:** ${it.params}  \n**Cyclomatic complexity (approx):** ${it.complexity}\n\n`;
      md += `**Calls:** ${
        it.calls && it.calls.length ? it.calls.join(", ") : "none"
      }\n\n`;
      md += `**Docstring / Comments:** ${
        it.doc ? `\n${it.doc}\n` : "None"
      }\n\n`;
      md += `**Snippet:**\n\n\`\`\`\n${it.snippet ?? ""}\n\`\`\`\n\n`;
    }
  }

  return md;
}
