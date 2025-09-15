// Lightweight repo heuristics for CPD/PMD/Checkstyle-like findings (language-agnostic)

// Tokenize into simple words/symbols for similarity and complexity counts
export function tokenize(src: string): string[] {
  return src
    .replace(/\r\n/g, "\n")
    .split(/(\b|\s|[{}()[\];,.:<>+\-*/%=&|!^~?])/g)
    .map(s => s)
    .filter(Boolean);
}

// Build k-gram shingles of tokens (default k=30 for near-duplicate detection)
export function shingles(tokens: string[], k = 30): string[] {
  if (tokens.length < k) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    out.push(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

// Jaccard similarity of two shingle sets
export function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type FileBlob = {
  path: string;
  language?: string;
  content: string; // plain text
  size: number;
};

export type HeuristicIssue = {
  type: "DUPLICATION" | "COMPLEXITY" | "STYLE" | "POTENTIAL_SMELL";
  file: string;
  message: string;
  severity: "info" | "minor" | "major" | "critical";
  line?: number;
  snippet?: string;
};

export type HeuristicSummary = {
  issues: HeuristicIssue[];
  duplicateClusters: { files: string[]; similarity: number }[];
  stats: {
    filesAnalyzed: number;
    bytesAnalyzed: number;
  };
};

const BRANCH_TOKENS = [
  "if","else","for","while","case","catch","?","&&","||","try","foreach","switch"
];

// Quick-and-dirty cyclomatic-ish score
function approxComplexity(tokens: string[]): number {
  return tokens.filter(t => BRANCH_TOKENS.includes(t)).length + 1;
}

function countMaxNesting(src: string): number {
  let depth = 0, maxDepth = 0;
  for (const ch of src) {
    if (ch === "{") { depth++; if (depth > maxDepth) maxDepth = depth; }
    if (ch === "}") { depth = Math.max(0, depth - 1); }
  }
  return maxDepth;
}

function styleChecks(src: string, path: string): HeuristicIssue[] {
  const issues: HeuristicIssue[] = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (line.length > 140) {
      issues.push({ type: "STYLE", file: path, line: i + 1, severity: "minor", message: "Line exceeds 140 characters", snippet: line.slice(0, 180) });
    }
    if (/^\s*catch\s*\(\s*(Exception|Throwable|Error)\s*[),]/.test(line) || /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/.test(line)) {
      issues.push({ type: "POTENTIAL_SMELL", file: path, line: i + 1, severity: "major", message: "Broad or empty catch block", snippet: line.trim() });
    }
    if (/SELECT .* FROM .* \+ /.test(line) || /"SELECT .*" \+/.test(line)) {
      issues.push({ type: "POTENTIAL_SMELL", file: path, line: i + 1, severity: "major", message: "Possible SQL string concatenation (risk of injection)", snippet: line.trim() });
    }
    if (/MD5|SHA1|DES\b/.test(line)) {
      issues.push({ type: "POTENTIAL_SMELL", file: path, line: i + 1, severity: "major", message: "Weak cryptography in use (MD5/SHA1/DES)", snippet: line.trim() });
    }
    if (/TODO|FIXME/.test(line)) {
      issues.push({ type: "STYLE", file: path, line: i + 1, severity: "info", message: "TODO/FIXME present", snippet: line.trim() });
    }
  });
  return issues;
}

export function analyzeFiles(files: FileBlob[], opts?: { maxPairs?: number }): HeuristicSummary {
  const issues: HeuristicIssue[] = [];
  const stats = { filesAnalyzed: 0, bytesAnalyzed: 0 };
  const tokenMap = new Map<string, string[]>(); // path -> tokens
  const shingleMap = new Map<string, Set<string>>(); // path -> shingle set

  // Per-file checks
  for (const f of files) {
    stats.filesAnalyzed++;
    stats.bytesAnalyzed += f.size || f.content.length;
    const toks = tokenize(f.content);
    tokenMap.set(f.path, toks);

    // Complexity & nesting
    const c = approxComplexity(toks);
    const nesting = countMaxNesting(f.content);
    if (c > 40) {
      issues.push({ type: "COMPLEXITY", file: f.path, severity: "major", message: `High cyclomatic complexity ~${c} (threshold 40)` });
    } else if (c > 20) {
      issues.push({ type: "COMPLEXITY", file: f.path, severity: "minor", message: `Elevated complexity ~${c} (threshold 20)` });
    }
    if (nesting > 5) {
      issues.push({ type: "COMPLEXITY", file: f.path, severity: "minor", message: `Deep nesting level ${nesting} (>5)` });
    }

    // Style / smell patterns
    issues.push(...styleChecks(f.content, f.path));

    // Shingles for CPD-like detection
    const sh = new Set(shingles(toks, 30));
    shingleMap.set(f.path, sh);
  }

  // Near-duplicate detection across files (bounded)
  const paths = Array.from(shingleMap.keys());
  const maxPairs = opts?.maxPairs ?? 8000;
  let pairs = 0;
  const duplicateClusters: { files: string[]; similarity: number }[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (pairs++ > maxPairs) break;
      const a = shingleMap.get(paths[i])!;
      const b = shingleMap.get(paths[j])!;
      const sim = jaccard(a, b);
      if (sim >= 0.6) {
        duplicateClusters.push({ files: [paths[i], paths[j]], similarity: Number(sim.toFixed(2)) });
        // Also raise individual duplication issues
        issues.push({
          type: "DUPLICATION",
          file: paths[i],
          severity: "minor",
          message: `Near-duplicate with ${paths[j]} (Jaccard ≈ ${sim.toFixed(2)})`
        });
      }
    }
  }

  return { issues, duplicateClusters, stats };
}