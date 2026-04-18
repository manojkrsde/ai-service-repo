function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = i;

  for (let j = 1; j <= n; j++) {
    let prev = dp[0] ?? 0;
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = dp[i] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        dp[i] = prev;
      } else {
        dp[i] = 1 + Math.min(prev, dp[i - 1] ?? 0, dp[i] ?? 0);
      }
      prev = temp;
    }
  }
  return dp[m] ?? 0;
}

export function scoreName(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.includes(q) || q.includes(c)) return 0.9;

  const qTokens = q.split(" ").filter(Boolean);
  const cTokens = c.split(" ").filter(Boolean);
  const tokenMatches = qTokens.filter((t) =>
    cTokens.some((ct) => ct === t || ct.startsWith(t) || t.startsWith(ct)),
  ).length;

  if (tokenMatches > 0) {
    const tokenScore =
      tokenMatches / Math.max(qTokens.length, cTokens.length);
    if (tokenScore >= 0.5) return 0.65 + tokenScore * 0.2;
  }

  const maxLen = Math.max(q.length, c.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(q, c);
  return Math.max(0, 1 - dist / maxLen);
}

export interface Ranked<T> {
  item: T;
  score: number;
}

export function rankByName<T>(
  query: string,
  items: T[],
  getName: (t: T) => string,
  minScore = 0.4,
): Ranked<T>[] {
  return items
    .map((item) => ({ item, score: scoreName(query, getName(item)) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
