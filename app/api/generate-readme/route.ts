import { NextRequest, NextResponse } from "next/server";
import { parseRepo, githubRequest, getCandidateFiles, getFileContent, type GitHubRepoMeta } from "@/lib/github";
import { buildPrompt } from "@/lib/prompt";
import { normalizeMarkdown } from "@/lib/markdown";

export async function POST(req: NextRequest) {
  try {
    const { repo, githubToken, userNotes } = await req.json();

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "Missing repo parameter" }, { status: 400 });
    }
    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub repo. Use URL or owner/repo." }, { status: 400 });
    }
    const { owner, repo: repoName } = parsed;

    // Try to get repo metadata - for public repos, token is optional
    let repoMeta: GitHubRepoMeta;
    try {
      repoMeta = await githubRequest<GitHubRepoMeta>(`/repos/${owner}/${repoName}`, githubToken);
    } catch (error: any) {
      if (!githubToken && error.message.includes("403")) {
        return NextResponse.json({ 
          error: "This appears to be a private repository. Please provide a GitHub token to access it." 
        }, { status: 403 });
      }
      throw error;
    }

    const candidates = await getCandidateFiles(owner, repoName, githubToken);
    const files: Array<{ path: string; content: string }> = [];
    for (const f of candidates) {
      try {
        const content = await getFileContent(owner, repoName, f.path, githubToken);
        if (content) files.push({ path: f.path, content });
      } catch {
        // skip unreadable files
      }
    }

    const basePrompt = buildPrompt(`${owner}/${repoName}`, repoMeta, files);
    const finalPrompt =
      userNotes && typeof userNotes === "string" && userNotes.trim().length
        ? `${basePrompt}\n\nAdditional author notes/preferences:\n${userNotes}`
        : basePrompt;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server misconfigured: GEMINI_API_KEY missing" }, { status: 500 });
    }

    const geminiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!geminiResp.ok) {
      const text = await geminiResp.text();
      return NextResponse.json({ error: `Gemini error ${geminiResp.status}: ${text}` }, { status: 500 });
    }

    const data = await geminiResp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 });
    }
    const cleaned = normalizeMarkdown(text);
    return NextResponse.json({ markdown: cleaned });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}