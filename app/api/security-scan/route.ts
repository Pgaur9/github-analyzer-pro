import { NextRequest, NextResponse } from "next/server";
import { parseRepo, githubRequest } from "@/lib/github";

function humanizeError(prefix: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/GitHub API (\d{3})/);
  const code = statusMatch ? Number(statusMatch[1]) : undefined;

  if (code === 404) {
    return `${prefix} not available: Feature not enabled for this repository. You can enable it in Settings → Code security and analysis.`;
  }
  if (code === 403) {
    return `${prefix} not accessible: Token permissions may be insufficient. Ensure PAT includes: Security events (read), Dependabot alerts (read), Code scanning alerts (read). If the repo is in an org with SSO, authorize the token.`;
  }
  if (code === 401) {
    return `${prefix} requires authentication. Provide a PAT with the required permissions.`;
  }
  // Don't show technical errors for common cases
  if (msg.includes("not enabled") || msg.includes("not accessible")) {
    return `${prefix} not available for this repository.`;
  }
  return `${prefix} not accessible: ${msg}`;
}

export async function POST(req: NextRequest) {
  try {
    const { repo, githubToken } = await req.json();

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "Missing repo" }, { status: 400 });
    }

    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid repo format. Use URL or owner/repo." },
        { status: 400 }
      );
    }

    const { owner, repo: repoName } = parsed;

    // If no token provided, DO NOT fail; return guidance (GitHub requires auth for alerts).
    if (!githubToken) {
      return NextResponse.json(
        {
          dependabot: null,
          codeScanning: null,
          requiresAuth: true,
          warnings: [
            "GitHub security alert APIs require authentication, even for public repositories.",
            "Provide a Personal Access Token (PAT) with: Security events (read), Dependabot alerts (read), Code scanning alerts (read).",
          ],
        },
        { status: 200 }
      );
    }

    const result: {
      dependabot: any[] | null;
      codeScanning: any[] | null;
      warnings: string[];
      requiresAuth?: boolean;
      hasSecurityFeatures?: boolean;
    } = { dependabot: null, codeScanning: null, warnings: [], hasSecurityFeatures: false };

    // Try Dependabot alerts - don't fail if unavailable
    try {
      const alerts = await githubRequest<any[]>(
        `/repos/${owner}/${repoName}/dependabot/alerts?per_page=100`,
        githubToken
      );
      result.dependabot = alerts ?? [];
      result.hasSecurityFeatures = true;
    } catch (e) {
      // Don't add warning for expected failures - just skip
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("404") && !msg.includes("not enabled")) {
        result.warnings.push(humanizeError("Dependabot alerts", e));
      }
    }

    // Try Code scanning alerts - don't fail if unavailable  
    try {
      const cs = await githubRequest<any[]>(
        `/repos/${owner}/${repoName}/code-scanning/alerts?per_page=100`,
        githubToken
      );
      result.codeScanning = cs ?? [];
      result.hasSecurityFeatures = true;
    } catch (e) {
      // Don't add warning for expected failures - just skip
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("404") && !msg.includes("not enabled")) {
        result.warnings.push(humanizeError("Code scanning alerts", e));
      }
    }

    // Add informational message if no security features are available
    if (!result.hasSecurityFeatures && result.warnings.length === 0) {
      result.warnings.push("No security scanning features are enabled for this repository. Enable Dependabot and Code Scanning in your repository settings for enhanced security insights.");
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}