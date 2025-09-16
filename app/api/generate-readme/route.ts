import { NextRequest, NextResponse } from "next/server";
import { parseRepo, githubRequest, getCandidateFiles, getFileContent, type GitHubRepoMeta } from "@/lib/github";
import { buildPrompt } from "@/lib/prompt";
import { normalizeMarkdown } from "@/lib/markdown";
import { DEMO_REPO_META, DEMO_FILES, isDemoRepository } from "@/lib/demo-data";

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

    // Check if this is a demo repository first
    const isDemo = isDemoRepository(owner, repoName);
    
    let repoMeta: GitHubRepoMeta;
    let files: Array<{ path: string; content: string }> = [];

    if (isDemo) {
      // Use demo data for demo repositories
      repoMeta = DEMO_REPO_META;
      files = DEMO_FILES;
    } else {
      // Try to get repo metadata - for public repos, token is optional
      try {
        repoMeta = await githubRequest<GitHubRepoMeta>(`/repos/${owner}/${repoName}`, githubToken);
      } catch (error: any) {
        if (!githubToken && error.message.includes("403")) {
          // Check if it's a rate limit error or private repository
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes("rate limit") || errorMsg.includes("api rate limit exceeded")) {
            return NextResponse.json({ 
              error: "GitHub API rate limit exceeded. Please provide a GitHub token to increase rate limits, or try again later. Alternatively, try 'octocat/Hello-World' for a demo." 
            }, { status: 429 });
          } else if (errorMsg.includes("not found")) {
            return NextResponse.json({ 
              error: "Repository not found. Please check the repository name and ensure it exists." 
            }, { status: 404 });
          } else {
            // Default to assuming it's a private repository for other 403 errors
            return NextResponse.json({ 
              error: "This appears to be a private repository or the API rate limit has been exceeded. Please provide a GitHub token to access it. Alternatively, try 'octocat/Hello-World' for a demo." 
            }, { status: 403 });
          }
        }
        throw error;
      }

      let candidates: Array<{ path: string; content?: string }> = [];
      try {
        candidates = await getCandidateFiles(owner, repoName, githubToken);
      } catch (error: any) {
        if (!githubToken && error.message.includes("403")) {
          return NextResponse.json({ 
            error: "GitHub API rate limit exceeded while accessing repository files. Please provide a GitHub token or try again later. Alternatively, try 'octocat/Hello-World' for a demo." 
          }, { status: 429 });
        }
        throw error;
      }

      for (const f of candidates) {
        try {
          const content = await getFileContent(owner, repoName, f.path, githubToken);
          if (content) files.push({ path: f.path, content });
        } catch {
          // skip unreadable files
        }
      }
    }

    const basePrompt = buildPrompt(`${owner}/${repoName}`, repoMeta, files);
    const finalPrompt =
      userNotes && typeof userNotes === "string" && userNotes.trim().length
        ? `${basePrompt}\n\nAdditional author notes/preferences:\n${userNotes}`
        : basePrompt;

    // Add demo mode notice if applicable
    const demoNotice = isDemo ? "\n\n[NOTE: This is a demo generation using sample repository data]" : "";

    const apiKey = process.env.GEMINI_API_KEY;
    const isValidApiKey = apiKey && apiKey !== "your_gemini_api_key_here" && apiKey.trim().length > 0;
    
    if (!isValidApiKey) {
      // For demo repositories, provide a fallback README when Gemini API is not available
      if (isDemo) {
        const fallbackMarkdown = `# ${repoMeta.name}

${repoMeta.description}

## Overview

This is a demonstration repository showcasing a simple Node.js/Express.js application. This README was generated as a demo when the Gemini API key was not configured.

## Features

- Express.js web server
- JSON API endpoints
- Environment-based configuration
- Simple and clean codebase

## Quick Start

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
\`\`\`bash
git clone ${repoMeta.clone_url}
cd ${repoMeta.name}
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Start the development server:
\`\`\`bash
npm start
\`\`\`

The server will start on port 3000 by default, or the port specified in the PORT environment variable.

## API Endpoints

### GET /

Returns a simple JSON response with a greeting message and timestamp.

**Response:**
\`\`\`json
{
  "message": "Hello World!",
  "timestamp": "2023-12-01T12:30:00.000Z"
}
\`\`\`

## Project Structure

\`\`\`
${repoMeta.name}/
├── index.js          # Main application file
├── package.json      # Project configuration and dependencies
└── README.md         # This file
\`\`\`

## Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Runtime | Node.js | JavaScript runtime environment |
| Framework | Express.js | Web application framework |
| Package Manager | npm | Dependency management |

## Scripts

| Command | Description |
|---------|-------------|
| \`npm start\` | Start the production server |
| \`npm test\` | Run the test suite |

## Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the ${repoMeta.license?.name || 'MIT License'}.

---

*This README was generated using GitHub Analyzer Pro in demo mode.*`;

        return NextResponse.json({ markdown: fallbackMarkdown });
      }
      return NextResponse.json({ error: "Server misconfigured: GEMINI_API_KEY missing or invalid" }, { status: 500 });
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
          contents: [{ parts: [{ text: finalPrompt + demoNotice }] }],
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