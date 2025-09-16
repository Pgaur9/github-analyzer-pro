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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const revealTimer = useRef<number | null>(null);
  const isRevealingRef = useRef(false);
  const latestFullText = useRef<string>("");
  // Store the full target content to allow resuming interrupted animations
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Utility: sleep for animations
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helpers: sticky auto-scroll only when user is near the bottom
  const isNearBottom = (el: HTMLElement, threshold = 80) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };
  
  const stickToBottomIfNeeded = (el: HTMLElement | null) => {
    if (!el) return;
    if (isNearBottom(el)) {
      // Use requestAnimationFrame to avoid layout thrash during rapid updates
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  };

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
    // Enhanced tokenization for better typing effect
    return Array.from(
      text.matchAll(
        /```[\s\S]*?```|`[^`]*`|#{1,6}[^\n]*|\*{1,2}[^*]*\*{1,2}|[>\-\+\*]\s+[^\n]*|[\n]{2,}|[\n]|[\w\u00A0-\uFFFF]+(?:['''][^\s]*)?|[^\w\s\n]/g
      )
    ).map((m) => m[0]);
  };

  const startReveal = async (full: string) => {
    cancelReveal();
    const cleanText = full.replace(/\r\n/g, "\n");
    latestFullText.current = cleanText;
    setPendingTarget(cleanText);
    setIsRevealing(true);
    setMarkdown("");
    
    await new Promise((resolve) => setTimeout(resolve, 0));
    
    let currentText = "";
    const baseStepMs = 8;
    
    for (let i = 0; i < cleanText.length; i++) {
      // Check if animation should continue
      if (!isRevealingRef.current) break;
      
      currentText += cleanText[i];
      setMarkdown(currentText);
      
      // Update cursor position and scroll
      if (editorRef.current) {
        const pos = currentText.length;
        editorRef.current.selectionStart = pos;
        editorRef.current.selectionEnd = pos;
        stickToBottomIfNeeded(editorRef.current);
      }
      stickToBottomIfNeeded(previewRef.current);
      
      // Variable typing speed based on character
      const ch = cleanText[i];
      const extra = ch === '\n' ? 12 : ch === '.' ? 8 : ch === ',' ? 4 : 0;
      const jitter = Math.floor(Math.random() * 4); // 0-3ms natural variation
      
      await delay(baseStepMs + extra + jitter);
      
      // Batch processing for very long content to avoid blocking
      if (cleanText.length > 1500 && i % 25 === 0) {
        await delay(0);
      }
    }
    
    setIsRevealing(false);
    setPendingTarget(null);
    
    // Final scroll to bottom
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
      }
      if (previewRef.current) {
        previewRef.current.scrollTop = previewRef.current.scrollHeight;
      }
    }, 100);
  };

  // Continue typing from current position to target
  const animateContinueToTarget = async () => {
    if (!pendingTarget) return;
    
    const text = pendingTarget.replace(/\r\n/g, "\n");
    const startIndex = markdown.length;
    
    if (!text.startsWith(markdown)) {
      // If content diverged, just set target and exit
      setMarkdown(text);
      setPendingTarget(null);
      return;
    }
    
    setIsRevealing(true);
    const baseStepMs = 8;
    
    for (let i = startIndex; i < text.length; i++) {
      if (!isRevealingRef.current) break;
      
      const currentText = text.slice(0, i + 1);
      setMarkdown(currentText);
      
      if (editorRef.current) {
        const pos = i + 1;
        editorRef.current.selectionStart = pos;
        editorRef.current.selectionEnd = pos;
        stickToBottomIfNeeded(editorRef.current);
      }
      stickToBottomIfNeeded(previewRef.current);
      
      const ch = text[i];
      const extra = ch === '\n' ? 12 : ch === '.' ? 8 : ch === ',' ? 4 : 0;
      const jitter = Math.floor(Math.random() * 4);
      
      await delay(baseStepMs + extra + jitter);
      
      if (text.length > 1500 && i % 25 === 0) {
        await delay(0);
      }
    }
    
    setIsRevealing(false);
    setPendingTarget(null);
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
      
      const generatedMarkdown = String(data.markdown || "");
      latestFullText.current = generatedMarkdown;
      
      // Hide loading overlay before typing animation starts
      setIsGenerating(false);
      
      // Start typing animation
      await startReveal(generatedMarkdown);
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
      <section className="grid gap-6 grid-cols-1 xl:grid-cols-2 min-h-[600px]">
        {/* Editor */}
        <div className="card-lg min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="toolbar">
              <span className="chip">
                📝 Editor
                {isRevealing && (
                  <span className="ml-2 text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                    Typing...
                  </span>
                )}
              </span>
            </div>
            <div className="toolbar flex-wrap">
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
          <div className="flex-1 flex flex-col">
            <textarea
              ref={editorRef}
              className="textarea flex-1 min-h-[520px] md:min-h-[640px] resize-none"
              style={{ scrollBehavior: 'smooth' }}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Your README content will appear here as it's being generated..."
            />
            <div className="mt-3 flex gap-2">
              {isRevealing ? (
                <button
                  className="btn btn-primary"
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
                  disabled={!latestFullText.current}
                >
                  <Play className="h-4 w-4" /> Fill instantly
                </button>
              )}
              {/* Resume typing button appears when we have a pending target and current text is a prefix */}
              {!isRevealing && pendingTarget && markdown.length < pendingTarget.length && pendingTarget.startsWith(markdown) && (
                <button
                  className="btn btn-primary"
                  onClick={() => { void animateContinueToTarget(); }}
                  title="Continue typing the generated README"
                >
                  <Play className="h-4 w-4" /> Resume typing
                </button>
              )}
              {markdown && markdown !== DEFAULT_MD && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    cancelReveal();
                    setMarkdown(DEFAULT_MD);
                    latestFullText.current = "";
                    setPendingTarget(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card-lg min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="toolbar">
              <span className="chip">
                👁️ Preview
                {(isGenerating || isRevealing) && (
                  <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                    Live rendering...
                  </span>
                )}
              </span>
            </div>
            <div className="toolbar">
              <span className="text-xs text-white/60">
                {markdown.split('\n').length} lines • {markdown.length} chars
              </span>
            </div>
          </div>
          <div 
            ref={previewRef}
            className="flex-1 overflow-y-auto pr-2"
            style={{ 
              scrollBehavior: 'smooth',
              minHeight: '520px',
              maxHeight: '640px'
            }}
          >
            <article className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {markdown}
              </ReactMarkdown>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}