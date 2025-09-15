import type { GitHubRepoMeta } from "./github";

export function buildPrompt(
  repoFullName: string,
  repoMeta: GitHubRepoMeta,
  files: Array<{ path: string; content: string }>
) {
  const metaSnippet =
    `Repository: ${repoFullName}\n` +
    `Description: ${repoMeta?.description ?? ""}\n` +
    `Stars: ${repoMeta?.stargazers_count ?? "N/A"}\n` +
    `Language: ${repoMeta?.language ?? "N/A"}`;

  const fileSummaries = files
    .map(f => `---\nPath: ${f.path}\n\n${f.content.substring(0, 4000)}`)
    .join("\n\n");

  return `You are an expert open-source maintainer. Generate a comprehensive, professional README.md for the repository below.

Strict formatting rules:
- Output must be GitHub-Flavored Markdown (GFM) only.
- Do NOT use raw HTML tags (no <div>, <h3>, <center>, etc.).
- Ensure proper spacing:
  - Exactly one blank line between sections and before/after lists, code blocks, and tables.
  - A space after list markers (-, *, +).
- Use fenced code blocks with language hints.

Content requirements (use this exact section order unless user notes say otherwise):
1. Title and short description
2. Badges (build, license, package, coverage if applicable)
3. Table of Contents
4. Key Features (bulleted)
5. Architecture Overview (1–2 paragraphs + optional diagram code block)
6. Tech Stack (as a table)
7. Getting Started (installation, prerequisites)
8. Configuration (as a table of env vars)
9. Usage (code examples)
10. Project Structure (tree in a fenced code block)
11. Scripts (as a table of npm/pnpm/yarn scripts, if relevant)
12. Roadmap (checkbox task list)
13. Contributing
14. Testing
15. License
16. Acknowledgements

Tables — use these schemas exactly and include a blank line before and after each table:
- Tech Stack:

| Area | Tool | Version |
|---|---|---|
| Frontend | Next.js | 15.x |

- Configuration:

| ENV | Description | Example |
|---|---|---|
| NEXT_PUBLIC_API | Public API base URL | https://api.example.com |

- Scripts (skip if not applicable):

| Command | Description |
|---|---|
| dev | Start local dev server |

Roadmap format (example):

- [ ] Improve documentation
- [ ] Add e2e tests
- [ ] Publish Docker image

Prefer concise, actionable content. Derive details from the provided files and metadata. If something is unknown, suggest sensible defaults and placeholders.

${metaSnippet}

Project files (samples):
${fileSummaries}`;
}