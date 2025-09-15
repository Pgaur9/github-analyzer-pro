import { NextRequest, NextResponse } from "next/server";
import { parseRepo, githubRequest } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const { repo, token, markdown, commitMessage, prTitle, prBody } = await req.json();

    if (!repo || typeof repo !== "string") return NextResponse.json({ error: "Missing repo" }, { status: 400 });
    if (!token || typeof token !== "string") return NextResponse.json({ error: "Missing token" }, { status: 400 });
    if (typeof markdown !== "string" || !markdown.trim()) return NextResponse.json({ error: "Missing markdown" }, { status: 400 });

    const parsed = parseRepo(repo);
    if (!parsed) return NextResponse.json({ error: "Invalid repo format. Use URL or owner/repo." }, { status: 400 });

    const { owner, repo: repoName } = parsed;

    // Get default branch
    const repoInfo = await githubRequest<{ default_branch: string }>(`/repos/${owner}/${repoName}`, token);
    const base = repoInfo.default_branch || "main";

    // Get base ref SHA
    const refData = await githubRequest<{ object: { sha: string } }>(
      `/repos/${owner}/${repoName}/git/ref/heads/${encodeURIComponent(base)}`,
      token
    );
    const baseSha = refData.object.sha;

    // Create new branch
    const branch = `wtb/readme-update-${Date.now()}`;
    await githubRequest(
      `/repos/${owner}/${repoName}/git/refs`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
      }
    );

    // Check existing README.md
    let existingSha: string | undefined;
    try {
      const existing = await githubRequest<{ sha: string }>(
        `/repos/${owner}/${repoName}/contents/${encodeURIComponent("README.md")}?ref=${encodeURIComponent(branch)}`,
        token
      );
      existingSha = existing.sha;
    } catch {
      // file might not exist; proceed without sha
    }

    // Commit README.md to new branch
    const contentB64 = Buffer.from(markdown, "utf-8").toString("base64");
    await githubRequest(
      `/repos/${owner}/${repoName}/contents/${encodeURIComponent("README.md")}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          message: commitMessage || "chore(readme): update README via GitHub Analyzer Pro",
          content: contentB64,
          branch,
          sha: existingSha
        })
      }
    );

    // Open PR
    const pr = await githubRequest<{ html_url: string }>(
      `/repos/${owner}/${repoName}/pulls`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          title: prTitle || "Update README via GitHub Analyzer Pro",
          head: branch,
          base,
          body: prBody || "This PR updates README.md generated/refined in GitHub Analyzer Pro."
        })
      }
    );

    return NextResponse.json({ url: pr.html_url });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    const statusMatch = msg.match(/^GitHub API (\d{3}):/);
    const status = statusMatch ? Number(statusMatch[1]) : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}