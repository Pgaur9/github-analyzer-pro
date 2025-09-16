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
  type: "SECURITY" | "BUGS" | "PERFORMANCE" | "DUPLICATION" | "COMPLEXITY" | "STYLE";
  category: string;
  file: string;
  message: string;
  severity: "info" | "minor" | "major" | "critical";
  line?: number;
  snippet?: string;
  impact?: string;
  remediation?: string;
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

function securityChecks(src: string, path: string): HeuristicIssue[] {
  const issues: HeuristicIssue[] = [];
  const lines = src.split("\n");
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Security vulnerabilities
    if (/password\s*=\s*["'][\w]+["']|api[_-]?key\s*=\s*["'][\w\-]+["']/i.test(line)) {
      issues.push({
        type: "SECURITY",
        category: "hardcoded-credentials",
        file: path,
        line: lineNum,
        severity: "critical",
        message: "Hardcoded credentials detected",
        snippet: trimmed,
        impact: "Credentials could be exposed in version control",
        remediation: "Use environment variables or secure configuration"
      });
    }

    if (/SELECT .* FROM .* \+ |"SELECT .*" \+|query\s*=\s*["'].* \+ /i.test(line)) {
      issues.push({
        type: "SECURITY",
        category: "sql-injection",
        file: path,
        line: lineNum,
        severity: "critical",
        message: "Potential SQL injection vulnerability",
        snippet: trimmed,
        impact: "Could allow unauthorized database access",
        remediation: "Use parameterized queries or prepared statements"
      });
    }

    if (/exec\s*\(|system\s*\(|eval\s*\(|setTimeout\s*\(.*function/i.test(line)) {
      issues.push({
        type: "SECURITY",
        category: "code-injection",
        file: path,
        line: lineNum,
        severity: "critical",
        message: "Potential code injection vulnerability",
        snippet: trimmed,
        impact: "Could allow arbitrary code execution",
        remediation: "Validate and sanitize all inputs, avoid dynamic code execution"
      });
    }

    if (/MD5|SHA1|DES\b|MD4|RC4/i.test(line)) {
      issues.push({
        type: "SECURITY",
        category: "weak-cryptography",
        file: path,
        line: lineNum,
        severity: "major",
        message: "Weak cryptographic algorithm detected",
        snippet: trimmed,
        impact: "Cryptographic operations may be easily broken",
        remediation: "Use SHA-256, SHA-3, AES, or other modern algorithms"
      });
    }

    if (/Math\.random\(\)|Random\(\)|new Random\(/i.test(line)) {
      issues.push({
        type: "SECURITY",
        category: "weak-randomness",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "Weak random number generation",
        snippet: trimmed,
        impact: "Predictable random values for security-sensitive operations",
        remediation: "Use cryptographically secure random number generators"
      });
    }
  });

  return issues;
}

function bugChecks(src: string, path: string): HeuristicIssue[] {
  const issues: HeuristicIssue[] = [];
  const lines = src.split("\n");
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // Null pointer issues
    if (/\w+\.\w+\s*(?!\=\=|\!\=)/.test(line) && !/if\s*\(.*\w+\s*(===|!==|==|!=)\s*null/.test(line)) {
      if (/\.length|\.size|\.get\(|\.set\(|\.push\(/.test(line)) {
        issues.push({
          type: "BUGS",
          category: "null-pointer",
          file: path,
          line: lineNum,
          severity: "major",
          message: "Potential null pointer dereference",
          snippet: trimmed,
          impact: "Runtime errors if object is null/undefined",
          remediation: "Add null checks before accessing object properties"
        });
      }
    }

    // Resource leak detection
    if (/new\s+(FileInputStream|FileOutputStream|BufferedReader|Connection|Statement)/i.test(line)) {
      issues.push({
        type: "BUGS",
        category: "resource-leak",
        file: path,
        line: lineNum,
        severity: "major",
        message: "Potential resource leak",
        snippet: trimmed,
        impact: "System resources may not be properly released",
        remediation: "Use try-with-resources or ensure proper cleanup in finally blocks"
      });
    }

    // Broad exception handling
    if (/catch\s*\(\s*(Exception|Throwable|Error)\s*[),]|catch\s*\(\s*\w+\s*\)\s*\{\s*\}/i.test(line)) {
      issues.push({
        type: "BUGS",
        category: "error-handling",
        file: path,
        line: lineNum,
        severity: "major",
        message: "Overly broad or empty exception handling",
        snippet: trimmed,
        impact: "Important errors may be silently ignored",
        remediation: "Catch specific exceptions and handle them appropriately"
      });
    }

    // Array/string bounds
    if (/\[\s*\w+\s*\-\s*1\s*\]|\[\s*length\s*\]/.test(line)) {
      issues.push({
        type: "BUGS",
        category: "bounds-error",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "Potential array bounds error",
        snippet: trimmed,
        impact: "Index out of bounds exceptions",
        remediation: "Validate array indices before access"
      });
    }
  });

  return issues;
}

function performanceChecks(src: string, path: string): HeuristicIssue[] {
  const issues: HeuristicIssue[] = [];
  const lines = src.split("\n");
  
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    // String concatenation in loops
    if (/for\s*\(.*\)\s*\{[\s\S]*\w+\s*\+=\s*["']|while\s*\(.*\)\s*\{[\s\S]*\w+\s*\+=\s*["']/i.test(line)) {
      issues.push({
        type: "PERFORMANCE",
        category: "string-concatenation",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "String concatenation in loop",
        snippet: trimmed,
        impact: "Poor performance due to string immutability",
        remediation: "Use StringBuilder, StringBuffer, or array join"
      });
    }

    // Nested loops
    if (/for\s*\(.*for\s*\(|while\s*\(.*while\s*\(/i.test(line)) {
      issues.push({
        type: "PERFORMANCE",
        category: "nested-loops",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "Nested loops detected",
        snippet: trimmed,
        impact: "Potential O(n²) or higher complexity",
        remediation: "Consider algorithmic improvements or caching"
      });
    }

    // Database queries in loops  
    if (/for\s*\(.*query|while\s*\(.*query|query.*for\s*\(/i.test(line)) {
      issues.push({
        type: "PERFORMANCE",
        category: "database-query",
        file: path,
        line: lineNum,
        severity: "major",
        message: "Database query in loop (N+1 problem)",
        snippet: trimmed,
        impact: "Excessive database calls leading to poor performance",
        remediation: "Batch queries or use joins to fetch data in single call"
      });
    }
  });

  return issues;
}

function styleChecks(src: string, path: string): HeuristicIssue[] {
  const issues: HeuristicIssue[] = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    
    if (line.length > 140) {
      issues.push({
        type: "STYLE",
        category: "line-length",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "Line exceeds 140 characters",
        snippet: line.slice(0, 180),
        impact: "Reduced code readability",
        remediation: "Break long lines into multiple lines"
      });
    }

    if (/TODO|FIXME/.test(line)) {
      issues.push({
        type: "STYLE",
        category: "technical-debt",
        file: path,
        line: lineNum,
        severity: "info",
        message: "TODO/FIXME comment found",
        snippet: trimmed,
        impact: "Incomplete or temporary code",
        remediation: "Complete the implementation or create proper tickets"
      });
    }

    // Bad variable names
    if (/\b(a|b|c|x|y|z|temp|tmp|foo|bar|baz)\b\s*=/.test(line)) {
      issues.push({
        type: "STYLE",
        category: "naming",
        file: path,
        line: lineNum,
        severity: "minor",
        message: "Non-descriptive variable name",
        snippet: trimmed,
        impact: "Reduced code maintainability and readability",
        remediation: "Use descriptive, meaningful variable names"
      });
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

    // Enhanced complexity & nesting checks
    const c = approxComplexity(toks);
    const nesting = countMaxNesting(f.content);
    if (c > 40) {
      issues.push({
        type: "COMPLEXITY",
        category: "cyclomatic-complexity",
        file: f.path,
        severity: "major",
        message: `High cyclomatic complexity ~${c} (threshold 40)`,
        impact: "Code is difficult to understand, test, and maintain",
        remediation: "Break down into smaller functions, reduce conditional complexity"
      });
    } else if (c > 20) {
      issues.push({
        type: "COMPLEXITY",
        category: "cyclomatic-complexity",
        file: f.path,
        severity: "minor",
        message: `Elevated complexity ~${c} (threshold 20)`,
        impact: "Code complexity is getting high",
        remediation: "Consider refactoring to reduce complexity"
      });
    }
    if (nesting > 5) {
      issues.push({
        type: "COMPLEXITY",
        category: "nesting-depth",
        file: f.path,
        severity: "minor",
        message: `Deep nesting level ${nesting} (>5)`,
        impact: "Code is hard to read and understand",
        remediation: "Use early returns, extract methods, or guard clauses"
      });
    }

    // Enhanced analysis checks
    issues.push(...securityChecks(f.content, f.path));
    issues.push(...bugChecks(f.content, f.path));
    issues.push(...performanceChecks(f.content, f.path));
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
          category: "code-duplication",
          file: paths[i],
          severity: "minor",
          message: `Near-duplicate with ${paths[j]} (Jaccard ≈ ${sim.toFixed(2)})`,
          impact: "Duplicated code increases maintenance burden",
          remediation: "Extract common code into shared functions or modules"
        });
      }
    }
  }

  return { issues, duplicateClusters, stats };
}