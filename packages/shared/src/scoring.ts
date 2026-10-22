export interface Token {
  raw: string;
  n: string;
}

export const normWord = (w: string): string =>
  w
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, '')
    .replace(/^'+|'+$/g, '');

export function tokenize(s: string): Token[] {
  return s
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((raw) => ({ raw, n: normWord(raw) }))
    .filter((x) => x.n.length > 0);
}

/**
 * Longest common subsequence matching
 * Returns indices sets ma (matched in a) and mb (matched in b)
 */
export function lcsMatch(a: string[], b: string[]): { ma: Set<number>; mb: Set<number> } {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ma = new Set<number>();
  const mb = new Set<number>();
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ma.add(i);
      mb.add(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return { ma, mb };
}

export interface DictationResult {
  expectedTokens: Token[];
  userTokens: Token[];
  matchedExpected: number[];
  matchedUser: number[];
  wrongTokens: string[];
  missingTokens: string[];
  accuracy: number;
  isPerfect: boolean;
}

export function evaluateDictation(
  targetText: string,
  userInput: string,
  hintCount = 0
): DictationResult {
  const expectedTokens = tokenize(targetText);
  const userTokens = tokenize(userInput);

  const { ma, mb } = lcsMatch(
    expectedTokens.map((t) => t.n),
    userTokens.map((t) => t.n)
  );

  let accuracy = expectedTokens.length
    ? Math.round((ma.size / expectedTokens.length) * 100)
    : 100;

  if (hintCount > 0) {
    const penaltyPerHint = Math.ceil(100 / Math.max(expectedTokens.length, 1) / 2);
    accuracy = Math.max(0, accuracy - hintCount * penaltyPerHint);
  }

  const wrongTokens = userTokens.filter((_, j) => !mb.has(j)).map((t) => t.raw);
  const missingTokens = expectedTokens.filter((_, i) => !ma.has(i)).map((t) => t.raw);

  return {
    expectedTokens,
    userTokens,
    matchedExpected: Array.from(ma),
    matchedUser: Array.from(mb),
    wrongTokens,
    missingTokens,
    accuracy,
    isPerfect: ma.size === expectedTokens.length && wrongTokens.length === 0,
  };
}

export function calculateToeicListeningScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 5;
  const ratio = Math.min(Math.max(correctCount / totalQuestions, 0), 1);
  // Scale 5 to 495 in increments of 5
  const raw = 5 + ratio * 490;
  return Math.round(raw / 5) * 5;
}

export function calculateToeicReadingScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 5;
  const ratio = Math.min(Math.max(correctCount / totalQuestions, 0), 1);
  const raw = 5 + ratio * 490;
  return Math.round(raw / 5) * 5;
}

export function calculateIeltsBand(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  // Normalized to 40 items scale
  const normCorrect = Math.round((correctCount / totalQuestions) * 40);
  if (normCorrect >= 39) return 9.0;
  if (normCorrect >= 37) return 8.5;
  if (normCorrect >= 35) return 8.0;
  if (normCorrect >= 33) return 7.5;
  if (normCorrect >= 30) return 7.0;
  if (normCorrect >= 27) return 6.5;
  if (normCorrect >= 23) return 6.0;
  if (normCorrect >= 19) return 5.5;
  if (normCorrect >= 15) return 5.0;
  if (normCorrect >= 13) return 4.5;
  if (normCorrect >= 10) return 4.0;
  if (normCorrect >= 8) return 3.5;
  if (normCorrect >= 6) return 3.0;
  return 2.5;
}
