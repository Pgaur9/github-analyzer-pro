import { NextRequest, NextResponse } from "next/server";
import { parseRepo, githubRequest, getCandidateFiles } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const { repo, githubToken } = await req.json();
    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "Missing repo parameter" }, { status: 400 });
    }
    const parsed = parseRepo(repo);
    if (!parsed) return NextResponse.json({ error: "Invalid GitHub repo. Use URL or owner/repo." }, { status: 400 });
    const { owner, repo: repoName } = parsed;

    // Try to get repo info - for public repos, token is optional
    let repoInfo: { default_branch: string };
    try {
      repoInfo = await githubRequest<{ default_branch: string }>(`/repos/${owner}/${repoName}`, githubToken);
    } catch (error: any) {
      if (!githubToken && error.message.includes("403")) {
        return NextResponse.json({ 
          error: "This appears to be a private repository. Please provide a GitHub token to access it." 
        }, { status: 403 });
      }
      throw error;
    }
    
    const languages = await githubRequest<Record<string, number>>(`/repos/${owner}/${repoName}/languages`, githubToken).catch(() => ({}));

    const candidates = await getCandidateFiles(owner, repoName, githubToken);
    // File counts by extension
    const counts: Record<string, number> = {};
    for (const f of candidates) {
      const m = f.path.match(/(\.[a-z0-9]+)$/i);
      const ext = m ? m[1].toLowerCase() : "other";
      counts[ext] = (counts[ext] || 0) + 1;
    }

    // Optional tiny AI note if key present
    let aiNote = "";
    if (process.env.GEMINI_API_KEY) {
      const topPaths = candidates.slice(0, 12).map(c => c.path).join("\n");
      const prompt = `Provide one short paragraph summarizing this repository based on filenames and languages only. Be cautious and generic.\nLanguages: ${Object.keys(languages).join(", ") || "Unknown"}\nPaths:\n${topPaths}`;
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY!
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 160 }
        })
      }).catch(() => null);
      const data = await resp?.json().catch(() => null);
      aiNote = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || "";
    }

    return NextResponse.json({
      defaultBranch: repoInfo.default_branch || "main",
      languages,
      fileTypeCounts: counts,
      note: aiNote
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}