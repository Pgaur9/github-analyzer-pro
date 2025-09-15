import { NextRequest, NextResponse } from "next/server";
import { analyzeFiles, FileBlob, HeuristicSummary } from "@/lib/heuristics";
import { SCAN_SYSTEM_PROMPT } from "@/lib/prompts/scanPrompt";

// Minimal GitHub fetcher (token optional, supports public repos)
async function fetchRepoFiles(owner: string, repo: string, token?: string, ref = "HEAD", limitBytes = 800_000) {
  // Get tree (recursive)
  const headers: Record<string, string> = { "Accept": "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers });
  if (!refRes.ok) throw new Error(`GitHub API ${refRes.status}: failed to read tree`);
  const tree = await refRes.json();

  // Filter to code files we care about
  const allow = /\.(ts|tsx|js|jsx|java|kt|kts|py|go|rb|php|cs|cpp|cc|c|scala|rs|swift)$/i;
  const blobs = (tree.tree || []).filter((n: any) => n.type === "blob" && allow.test(n.path));

  // Pull file contents (cap total bytes)
  const files: FileBlob[] = [];
  let budget = limitBytes;

  for (const node of blobs) {
    if (budget <= 0) break;
    const raw = await fetch(node.url, { headers }); // blob API returns base64
    if (!raw.ok) continue;
    const j = await raw.json();
    const buf = Buffer.from(j.content || "", "base64");
    if (buf.length > Math.min(budget, 200_000)) continue; // skip very large file
    const content = buf.toString("utf8");
    files.push({ path: node.path, content, size: buf.length });
    budget -= buf.length;
  }
  return files;
}

function parseRepo(input: string): { owner: string; repo: string } | null {
  const m1 = input.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/|$)/i);
  if (m1) return { owner: m1[1], repo: m1[2] };
  const m2 = input.match(/^([^\/]+)\/([^\/]+)$/);
  if (m2) return { owner: m2[1], repo: m2[2] };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { repo, githubToken, ref } = await req.json();
    const parsed = parseRepo(repo || "");
    if (!parsed) return NextResponse.json({ error: "Provide a GitHub URL or owner/repo" }, { status: 400 });

    const files = await fetchRepoFiles(parsed.owner, parsed.repo, githubToken, ref || "HEAD");
    const heur: HeuristicSummary = analyzeFiles(files);

    // Prepare compact evidence for the LLM (limit to first N issues and small snippets)
    const evidence = {
      stats: heur.stats,
      duplicates: heur.duplicateClusters.slice(0, 20),
      issues: heur.issues.slice(0, 200).map(i => ({
        ...i,
        snippet: i.snippet?.slice(0, 400)
      }))
    };

    // Server-side Gemini call (no external sec API)
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ heuristics: heur, ai: null, warning: "GEMINI_API_KEY not set; returning heuristic results only." });
    }

    const prompt = `${SCAN_SYSTEM_PROMPT}\n\nEvidence:\n${JSON.stringify(evidence, null, 2)}`;
    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1800 } })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ heuristics: heur, ai: null, warning: `Gemini call failed: ${resp.status} ${text}` }, { status: 200 });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Try to parse JSON from model output
    let aiJson: any = null;
    try {
      aiJson = JSON.parse(text.trim().replace(/^```json|```/g, ""));
    } catch {
      // best-effort: return raw
      aiJson = { raw: text };
    }

    return NextResponse.json({ heuristics: heur, ai: aiJson });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}