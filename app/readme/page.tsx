"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  Loader2,
  Lock,
  Play,
  Square,
  Wand2,
  Download,
  Copy,
  GitPullRequest,
  Trash2,
} from "lucide-react";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ReadmePage() {
  const [repo, setRepo] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // Start BLANK by default
  const DEFAULT_MD =
    "# README\n\nStart by generating a README from your repository, then edit here. ✨\n";
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MD);

  // Persistence preference (default OFF)
  const [remember, setRemember] = useState(false);

  // Auth-related (kept for convenience; can also be gated if you prefer)
  const [githubToken, setGithubToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const revealTimer = useRef<number | null>(null);
  const isRevealingRef = useRef(false);
  const latestFullText = useRef<string>("");

  // Initial load: only load token + gemini key by default.
  // Load repo/notes/markdown only if "remember" was enabled previously.
  useEffect(() => {
    try {
      const t = localStorage.getItem("gap_github_token");
      if (t) setGithubToken(t);

      const g = localStorage.getItem("gap_gemini_key");
      if (g) setGeminiKey(g);

      const rem = localStorage.getItem("gap_remember_session") === "1";
      setRemember(rem);

      if (rem) {
        const r = localStorage.getItem("gap_repo");
        const n = localStorage.getItem("gap_user_notes");
        const m = localStorage.getItem("gap_readme_md");
        const prv = localStorage.getItem("gap_repo_private");

        if (r) setRepo(r);
        if (n) setUserNotes(n);
        if (m) {
          setMarkdown(m);
          latestFullText.current = m;
        }
        if (prv) setIsPrivate(prv === "1");
      } else {
        // Force blank if remember is off
        setRepo("");
        setUserNotes("");
        setMarkdown(DEFAULT_MD);
        setIsPrivate(false);
      }
    } catch {
      // If localStorage is not available, stay with defaults
    }
  }, []);

  // Save only when "remember" is ON
  useEffect(() => {
    try {
      if (remember) {
        localStorage.setItem("gap_repo", repo);
        localStorage.setItem("gap_user_notes", userNotes);
        localStorage.setItem("gap_repo_private", isPrivate ? "1" : "0");
      }
    } catch {}
  }, [repo, userNotes, isPrivate, remember]);

  useEffect(() => {
    try {
      if (remember) localStorage.setItem("gap_readme_md", markdown);
    } catch {}
  }, [markdown, remember]);

  // Always allow saving these for convenience (can gate if you prefer)
  const saveToken = () => {
    try {
      if (githubToken) localStorage.setItem("gap_github_token", githubToken);
      else localStorage.removeItem("gap_github_token");
      alert("Saved token locally");
    } catch {}
  };
  const saveGemini = () => {
    try {
      if (geminiKey) localStorage.setItem("gap_gemini_key", geminiKey);
      else localStorage.removeItem("gap_gemini_key");
      alert("Saved Gemini key locally");
    } catch {}
  };

  const toggleRemember = () => {
    const next = !remember;
    setRemember(next);
    try {
      localStorage.setItem("gap_remember_session", next ? "1" : "0");
      if (!next) {
        // Purge remembered fields immediately when turning off
        localStorage.removeItem("gap_repo");
        localStorage.removeItem("gap_user_notes");
        localStorage.removeItem("gap_readme_md");
        localStorage.removeItem("gap_repo_private");
      }
    } catch {}
  };

  const clearSession = () => {
    setRepo("");
    setUserNotes("");
    setMarkdown(DEFAULT_MD);
    setIsPrivate(false);
    latestFullText.current = "";
    try {
      localStorage.removeItem("gap_repo");
      localStorage.removeItem("gap_user_notes");
      localStorage.removeItem("gap_readme_md");
      localStorage.removeItem("gap_repo_private");
    } catch {}
  };

  const cancelReveal = () => {
    if (revealTimer.current) {
      window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    isRevealingRef.current = false;
    setIsRevealing(false);
  };

  const tokenizeMarkdown = (text: string) => {
    return Array.from(
      text.matchAll(
        /```[\s\S]*?```|[#>*\-+`]|[\n]|[\w\u00A0-\uFFFF]+|[^\w\s]/g
      )
    ).map((m) => m[0]);
  };

  const startReveal = (full: string) => {
    cancelReveal();
    latestFullText.current = full;
    setIsRevealing(true);
    setMarkdown("");
    const tokens = tokenizeMarkdown(full);
    let i = 0;
    const step = () => {
      const chunkSize = 8;
      const next = tokens.slice(i, i + chunkSize).join("");
      i += chunkSize;
      setMarkdown((prev) => prev + next);
      if (i < tokens.length && isRevealingRef.current) {
        revealTimer.current = window.setTimeout(step, 16);
      } else {
        setIsRevealing(false);
      }
    };
    isRevealingRef.current = true;
    step();
  };

  const onGenerate = async () => {
    if (!repo.trim()) {
      setError("Paste a GitHub repository URL or owner/repo");
      return;
    }
    if (isPrivate && !githubToken.trim()) {
      setError("Private repos require a GitHub token with repo read access");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-readme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          githubToken: githubToken || undefined,
          userNotes: userNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      startReveal(String(data.markdown || ""));
    } catch (e: any) {
      setError(e?.message || "Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  const onCreatePr = async () => {
    if (!repo.trim()) return setError("Enter a repo first");
    if (!githubToken.trim())
      return setError("GitHub token is required to open a PR");
    setError(null);
    try {
      const res = await fetch("/api/create-readme-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          token: githubToken,
          markdown,
          commitMessage:
            "chore(readme): update README via GitHub Analyzer Pro",
          prTitle: "Update README via GitHub Analyzer Pro",
          prBody:
            "This PR updates README.md generated in GitHub Analyzer Pro.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create PR");
      alert(`PR created: ${data.url}`);
      window.open(data.url, "_blank");
    } catch (e: any) {
      setError(e?.message || "Failed to create PR");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      setError("Copy failed");
    }
  };
  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Center overlay while generating */}
      <LoadingOverlay show={isGenerating} />

      {/* Hero */}
      <section className="space-y-4 pt-8">
        <h1 className="hero">Generate a Great README</h1>
        <p className="hero-sub">
          Paste a GitHub repository URL or owner/repo. Analyze the codebase and
          draft a polished README. Edit and preview live.
        </p>
      </section>

      {/* Input row */}
      <section className="card-lg mt-4">
        <div className="flex flex-col gap-3">
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
            <button
              className="btn btn-primary"
              onClick={onGenerate}
              disabled={isGenerating || isRevealing}
            >
              {isGenerating ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}{" "}
              {isGenerating ? "Generating…" : "Generate"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-white/55">
              Repos that are private require a GitHub token with repo read
              access. We never send your token to the client AI provider; it is
              only used server-side to read your repo.
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={remember}
                  onChange={toggleRemember}
                />
                <span className="text-white/80">Remember last session</span>
              </label>
              <button className="btn" onClick={clearSession} title="Clear current fields and saved session">
                <Trash2 className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>
        </div>

        {/* Optional notes */}
        <div className="mt-4">
          <label className="text-sm text-white/70 block mb-2">
            Optional notes or preferences
          </label>
          <textarea
            className="textarea"
            placeholder="Anything specific to include (badges, tech stack, deployment steps, screenshots, etc.)"
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
          />
        </div>

        {/* Private token field (shown when Private is on) */}
        {isPrivate && (
          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
            <input
              className="input"
              type="password"
              placeholder="GitHub Token (ghp_***)"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <button className="btn" onClick={saveToken}>
              Save token locally
            </button>
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </section>

      {/* Editor + Preview with toolbar headers */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Editor */}
        <div className="card-lg min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="toolbar">
              <span className="chip">Editor</span>
            </div>
            <div className="toolbar">
              <button className="chip" onClick={async () => {
                try { await navigator.clipboard.writeText(markdown); } catch { setError("Copy failed"); }
              }}>
                <Copy className="h-4 w-4" /> Copy
              </button>
              <button className="chip" onClick={() => {
                const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "README.md"; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-4 w-4" /> Download
              </button>
              <div className="chip">
                <input
                  className="bg-transparent outline-none w-56"
                  type="password"
                  placeholder="Gemini API key (client-only)"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button
                  className="btn btn-primary px-2 py-1 rounded-full text-xs"
                  onClick={saveGemini}
                >
                  Save
                </button>
              </div>
              <button className="chip" onClick={async () => {
                const el = editorRef.current;
                if (!el) return;
                const start = el.selectionStart ?? 0;
                const end = el.selectionEnd ?? 0;
                const selected = markdown.slice(start, end).trim();
                if (!selected) return setError("Select some text to refine");
                if (!geminiKey) return setError("Add a Gemini API key (client-side) to refine text");
                try {
                  const prompt = `Rewrite the following Markdown selection to improve clarity and conciseness while preserving meaning.\n\n${selected}`;
                  const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-goog-api-key": geminiKey },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 512 } })
                  });
                  if (!resp.ok) throw new Error(await resp.text());
                  const data = await resp.json();
                  const refined: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || "";
                  if (!refined) throw new Error("Empty response from Gemini");
                  setMarkdown(markdown.slice(0, start) + refined + markdown.slice(end));
                } catch (e: any) {
                  setError(e?.message || "Refine failed");
                }
              }}>
                <Wand2 className="h-4 w-4" /> AI Refine
              </button>
              <button className="chip" onClick={onCreatePr}>
                <GitPullRequest className="h-4 w-4" /> Create PR
              </button>
            </div>
          </div>
          <textarea
            ref={editorRef}
            className="textarea min-h-[520px] md:min-h-[640px]"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            {isRevealing ? (
              <button
                className="btn"
                onClick={() => {
                  cancelReveal();
                  setMarkdown(latestFullText.current);
                }}
              >
                <Square className="h-4 w-4" /> Stop animation
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  cancelReveal();
                  setMarkdown(latestFullText.current || markdown);
                }}
              >
                <Play className="h-4 w-4" /> Fill instantly
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="card-lg min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="toolbar">
              <span className="chip">Preview</span>
            </div>
            {(isGenerating || isRevealing) && (
              <span className="text-xs text-white/60">Streaming preview…</span>
            )}
          </div>
          <article className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      </section>
    </>
  );
}