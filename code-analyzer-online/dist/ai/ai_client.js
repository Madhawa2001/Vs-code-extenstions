"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAiForDocumentWrapper = callAiForDocumentWrapper;
exports.callAiForDocument = callAiForDocumentWrapper;
function buildPrompt(items) {
    // build concise JSON-like context for the LLM to avoid hallucination
    const itemsSummary = items.map((it) => ({
        file: it.file,
        type: it.type,
        name: it.name,
        signature: it.signature,
        params: it.params,
        loc: it.loc,
        complexity: it.complexity,
        calls: it.calls,
        doc: it.doc,
        snippet: it.snippet ? it.snippet.slice(0, 1200) : "",
    }));
    // Upgraded system prompt for clearer, richer output
    const system = `You are an expert software engineer, code reviewer, and reverse-engineering specialist with deep knowledge of software architecture, design patterns, and code quality best practices.
Your task is to analyze the given code structure and generate a concise, precise, and actionable Rationale Document.
Only base your analysis strictly on the provided code snippets, metrics, and details.
Do NOT make assumptions or hallucinate any information beyond the provided data.
If unsure about a detail, qualify your statements with words like "likely", "possibly", or "appears to".`;
    // Upgraded user instructions for a thorough rationale doc with clear structure
    const instructions = `
Below is a JSON representation of the analyzed code elements (functions, classes, methods) with their metrics and snippets:

${JSON.stringify(itemsSummary, null, 2)}

Using ONLY this data, produce a detailed Rationale Document following this exact structure and headings:

---
## Rationale Document

### Purpose
Provide a brief description (1-3 paragraphs) of the overall purpose of the code or each significant component.

### Function-by-Function Analysis
For each function or class:
- State the function/class name
- Describe its likely purpose and responsibilities
- Mention important details such as parameters, complexity, and interactions

### Design Decisions & Trade-offs
List notable architectural or coding decisions, optimizations, and potential trade-offs reflected by the code structure and metrics.

### Possible Origin Prompt
Hypothesize the likely original intent or design goals that might have guided this code's creation.

### Inspiration & References
List any probable libraries, paradigms, or external inspirations inferred from the code and analysis.

### Improvement Suggestions
Provide practical, constructive suggestions for improving the code, design, maintainability, or performance.

---

ONLY output the Rationale Document text with no additional commentary or explanations.
`;
    return { system, instructions };
}
/**
 * Calls OpenAI Chat Completions API (v1/chat/completions) with provided apiKey.
 * This function uses fetch and expects OpenAI-compatible endpoint.
 */
const generative_ai_1 = require("@google/generative-ai");
async function callAiForDocument(items, apiKey, model = "gemini-2.0-flash") {
    const { system, instructions } = buildPrompt(items);
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    const prompt = `${system}\n\n${instructions}`;
    const result = await geminiModel.generateContent(prompt);
    return result.response.text();
}
/**
 * Small wrapper used in analyze.ts
 */
async function callAiForDocumentWrapper(items, apiKey, model) {
    return await callAiForDocument(items, apiKey, model);
}
//# sourceMappingURL=ai_client.js.map