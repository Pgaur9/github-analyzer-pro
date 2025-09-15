"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Lock, ExternalLink } from "lucide-react";

type ScanResult = {
  dependabot: any[] | null;
  codeScanning: any[] | null;
  warnings: string[];
  requiresAuth?: boolean;
  error?: string;
};

export default function AnalyzerPage() {
  const [repo, setRepo] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optional: load a saved token for convenience
  useEffect(() => {
    try {
      const t = localStorage.getItem("gap_github_token");
      if (t) setGithubToken(t);
    } catch {}
  }, []);

  const saveToken = () => {
    try {
      if (githubToken) localStorage.setItem("gap_github_token", githubToken);
      else localStorage.removeItem("gap_github_token");
      alert("Saved token locally");
    } catch {}
  };

  const fetchAlerts = async () => {
    if (!repo.trim()) {
      setError("Enter a GitHub repo URL or owner/repo");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/security-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          githubToken: githubToken || undefined, // token is OPTIONAL now
        }),
      });
      const data: ScanResult = await res.json();
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to fetch security alerts");
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch security alerts");
    } finally {
      setIsLoading(false);
    }
  };

  const Section = ({
    title,
    items,
    docUrl,
  }: {
    title: string;
    items: any[] | null | undefined;
    docUrl: string;
  }) => {
    const hasData = Array.isArray(items) && items.length > 0;
    return (
      <div className="card-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <a
            className="text-sm text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"
            href={docUrl}
            target="_blank"
            rel="noreferrer"
          >
            Docs <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {!items && (
          <div className="text-white/60 text-sm">
            Not available yet. {result?.requiresAuth ? "Authentication required." : ""}
          </div>
        )}
        {Array.isArray(items) && items.length === 0 && (
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            <span>No alerts found.</span>
          </div>
        )}
        {hasData && (
          <div className="space-y-3">
            {items!.map((a: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm text-white/90 break-words">
                  <pre className="whitespace-pre-wrap break-words text-xs text-white/80">
                    {JSON.stringify(a, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 pt-2">
        <h1 className="hero">Security Analyzer</h1>
        <p className="hero-sub">
          Fetch Dependabot and Code Scanning alerts. Token is optional, but GitHub requires authentication to access alerts even for public repositories.
        </p>
      </section>

      <section className="card-lg">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="input"
            placeholder="owner/repo or https://github.com/owner/repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
          <button className="btn btn-primary" onClick={fetchAlerts} disabled={isLoading || !repo.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}{" "}
            {isLoading ? "Fetching…" : "Fetch security alerts"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="input"
            type="password"
            placeholder="Optional: GitHub Token (PAT) to access alerts"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
          />
          <button className="btn" onClick={saveToken}>
            <Lock className="h-4 w-4" /> Save token locally
          </button>
        </div>

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        {result?.requiresAuth && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                GitHub’s security alert APIs require authentication even for public repositories. Provide a PAT with:
                Security events (read), Dependabot alerts (read), Code scanning alerts (read).
              </div>
            </div>
          </div>
        )}

        {result?.warnings?.length ? (
          <div className="mt-4 space-y-2">
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 text-yellow-200 p-3 text-sm">
                {w}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Section
          title="Dependabot alerts"
          items={result?.dependabot}
          docUrl="https://docs.github.com/code-security/dependabot/dependabot-alerts/about-dependabot-alerts"
        />
        <Section
          title="Code scanning alerts"
          items={result?.codeScanning}
          docUrl="https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning"
        />
      </section>
    </div>
  );
}