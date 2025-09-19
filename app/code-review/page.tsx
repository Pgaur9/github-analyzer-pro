"use client";

import { useState, useRef } from "react";
import { Lock, Loader2, GitBranch, FileText, Code, AlertCircle, CheckCircle, Clock, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CodeReviewPage() {
  const [repo, setRepo] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [baseCommit, setBaseCommit] = useState("HEAD~1");
  const [targetCommit, setTargetCommit] = useState("HEAD");
  const [includeRepoContext, setIncludeRepoContext] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    repository: string;
    branch: string;
    comparison: { base: string; target: string };
    diff: {
      stats: { filesChanged: number; insertions: number; deletions: number };
      files: Array<{
        path: string;
        type: string;
        insertions: number;
        deletions: number;
      }>;
    };
    review: string;
    includeRepoContext: boolean;
  } | null>(null);

  const resultRef = useRef<HTMLDivElement | null>(null);

  const onReview = async () => {
    if (!repo.trim()) {
      setError("Please enter a GitHub repository URL or owner/repo");
      return;
    }
    if (isPrivate && !githubToken.trim()) {
      setError("Private repos require a GitHub token with repo read access");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/code-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          githubToken: githubToken || undefined,
          baseCommit,
          targetCommit,
          includeRepoContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform code review");
      }

      setResult(data);
      
      // Scroll to results
      setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    const content = `# Code Review Report

**Repository:** ${result.repository}
**Branch:** ${result.branch}
**Comparison:** ${result.comparison.base} → ${result.comparison.target}
**Files Changed:** ${result.diff.stats.filesChanged}
**Changes:** +${result.diff.stats.insertions} -${result.diff.stats.deletions}
**Generated:** ${new Date().toISOString()}

---

${result.review}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${result.repository.replace('/', '-')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-8">
        <h1 className="hero">AI Code Review</h1>
        <p className="hero-sub">
          Analyze git diffs with AI-powered code review using repository context
        </p>
      </section>

      <div className="card space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">GitHub Repository</label>
          <div className="flex items-stretch gap-2">
            <input
              className="input-hero"
              placeholder="https://github.com/facebook/react or owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <button
              type="button"
              className={`btn ${isPrivate ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setIsPrivate(!isPrivate)}
              title="Toggle Private repository"
            >
              <Lock className="h-4 w-4" /> Private
            </button>
          </div>
        </div>

        {isPrivate && (
          <div>
            <label className="block text-sm font-medium mb-2">GitHub Token</label>
            <input
              type="password"
              className="input w-full"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <p className="text-xs text-white/60 mt-1">
              Required for private repositories. Token needs &apos;repo&apos; read access.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Base Commit</label>
            <input
              className="input w-full"
              placeholder="HEAD~1"
              value={baseCommit}
              onChange={(e) => setBaseCommit(e.target.value)}
            />
            <p className="text-xs text-white/60 mt-1">
              Starting commit for comparison (e.g., HEAD~1, main, commit hash)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Target Commit</label>
            <input
              className="input w-full"
              placeholder="HEAD"
              value={targetCommit}
              onChange={(e) => setTargetCommit(e.target.value)}
            />
            <p className="text-xs text-white/60 mt-1">
              Ending commit for comparison (e.g., HEAD, feature-branch, commit hash)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="includeContext"
            checked={includeRepoContext}
            onChange={(e) => setIncludeRepoContext(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="includeContext" className="text-sm">
            Include repository context for better analysis (recommended)
          </label>
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={onReview}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            <Code className="h-4 w-4" />
          )}{" "}
          {isLoading ? "Analyzing Code..." : "Start Code Review"}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-red-300">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div ref={resultRef} className="space-y-6">
          {/* Summary Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Review Complete
              </h2>
              <button
                onClick={downloadReport}
                className="btn btn-ghost text-sm"
              >
                <Download className="h-4 w-4" />
                Download Report
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <GitBranch className="h-4 w-4" />
                  <span className="text-sm font-medium">Repository</span>
                </div>
                <p className="text-white font-mono text-sm">{result.repository}</p>
                <p className="text-white/60 text-xs">{result.branch}</p>
              </div>
              
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Files Changed</span>
                </div>
                <p className="text-white font-mono text-lg">{result.diff.stats.filesChanged}</p>
              </div>
              
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <span className="text-sm font-medium">+</span>
                  <span className="text-sm font-medium">Insertions</span>
                </div>
                <p className="text-white font-mono text-lg">{result.diff.stats.insertions}</p>
              </div>
              
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <span className="text-sm font-medium">-</span>
                  <span className="text-sm font-medium">Deletions</span>
                </div>
                <p className="text-white font-mono text-lg">{result.diff.stats.deletions}</p>
              </div>
            </div>

            <div className="mt-4 text-sm text-white/60">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Comparing {result.comparison.base} → {result.comparison.target}
                {result.includeRepoContext && " (with repository context)"}
              </span>
            </div>
          </div>

          {/* Files Changed */}
          {result.diff.files && result.diff.files.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Files Changed</h3>
              <div className="space-y-2">
                {result.diff.files.map((file, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        file.type === 'added' ? 'bg-green-500/20 text-green-400' :
                        file.type === 'deleted' ? 'bg-red-500/20 text-red-400' :
                        file.type === 'modified' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {file.type}
                      </span>
                      <span className="font-mono text-sm">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-400">+{file.insertions}</span>
                      <span className="text-red-400">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Review */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">AI Code Review</h3>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.review}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}