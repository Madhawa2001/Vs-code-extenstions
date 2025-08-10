export function computeSimpleComplexity(snippet: string): number {
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
