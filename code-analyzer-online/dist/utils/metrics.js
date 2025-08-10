"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSimpleComplexity = computeSimpleComplexity;
function computeSimpleComplexity(snippet) {
    const keywords = [
        " if ",
        " for ",
        " while ",
        " case ",
        "&&",
        "||",
        "?",
        " switch ",
        "catch",
        "except",
        "elif",
    ];
    let count = 1;
    const s = snippet.toLowerCase();
    for (const k of keywords) {
        let idx = s.indexOf(k);
        while (idx !== -1) {
            count += 1;
            idx = s.indexOf(k, idx + k.length);
        }
    }
    return count;
}
//# sourceMappingURL=metrics.js.map