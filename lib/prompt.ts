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
    `Language: ${repoMeta?.language ?? "N/A"}\n` +
    `Topics: ${repoMeta?.topics?.join(", ") ?? "N/A"}\n` +
    `Homepage: ${repoMeta?.homepage ?? "N/A"}\n` +
    `License: ${repoMeta?.license?.name ?? "N/A"}`;

  const fileSummaries = files
    .map(f => `---\nPath: ${f.path}\n\n${f.content.substring(0, 4000)}`)
    .join("\n\n");

  return `You are an expert technical writer and open-source maintainer with deep knowledge of software architecture and development workflows. Generate a comprehensive, professional README.md that not only documents the project but tells its story and showcases its value.

STRICT FORMATTING REQUIREMENTS:
- Output ONLY GitHub-Flavored Markdown (GFM)
- NO raw HTML tags whatsoever (<div>, <h3>, <center>, etc.)
- Proper spacing: exactly one blank line between sections, before/after lists, code blocks, and tables
- Space after list markers (-, *, +)
- Use fenced code blocks with appropriate language hints
- Ensure all tables are properly formatted with alignment

CONTENT STRUCTURE (follow this exact order):

## 1. PROJECT HEADER
- Compelling title with brief tagline
- Repository badges (build status, version, license, downloads if applicable)
- Hero description that explains the project's purpose and value proposition

## 2. TABLE OF CONTENTS
- Comprehensive navigation for easy browsing

## 3. OVERVIEW & MOTIVATION
- What problem does this solve?
- Why was it created?
- Who is the target audience?
- What makes it unique/better than alternatives?

## 4. KEY FEATURES
- Bulleted list of main capabilities
- Focus on user benefits, not just technical features
- Use action-oriented language

## 5. ARCHITECTURE & DESIGN
- High-level system architecture (1-2 paragraphs)
- Key design decisions and trade-offs
- Optional: include architecture diagram as ASCII art or mermaid code block
- Technology choices and rationale

## 6. TECHNOLOGY STACK
Present as a well-organized table:

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Frontend | React | 18.x | User interface |
| Backend | Node.js | 20.x | Server runtime |

## 7. QUICK START
- Prerequisites (versions, dependencies)
- Installation steps (clear, copy-pasteable commands)
- Basic usage example
- Expected output/results

## 8. DETAILED USAGE
- Code examples with explanations
- Different use cases and scenarios
- Configuration options
- Best practices and tips

## 9. PROJECT WORKFLOW
Explain the development and user workflow:
- How the application/library works internally
- Data flow and processing steps
- Integration patterns
- Deployment workflow

## 10. CONFIGURATION
Environment variables and settings as a table:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| API_KEY | Service API key | none | Yes |

## 11. PROJECT STRUCTURE
\`\`\`
project-name/
├── src/
│   ├── components/     # React components
│   ├── utils/         # Utility functions
│   └── types/         # TypeScript definitions
├── docs/              # Documentation
├── tests/             # Test files
└── README.md         # This file
\`\`\`

## 12. DEVELOPMENT
- Setting up development environment
- Running in development mode
- Code style and conventions
- Debugging tips

## 13. TESTING
- How to run tests
- Test coverage information
- Testing philosophy and approach

## 14. SCRIPTS & COMMANDS
Available npm/yarn/pnpm scripts:

| Command | Description |
|---------|-------------|
| \\\`npm start\\\` | Start development server |
| \\\`npm test\\\` | Run test suite |

## 15. API DOCUMENTATION
- If applicable, document key APIs/endpoints
- Request/response examples
- Authentication details

## 16. DEPLOYMENT
- Production deployment steps
- Environment-specific configurations
- CI/CD pipeline information
- Performance considerations

## 17. ROADMAP
Use checkbox format for future plans:
- [ ] Feature X implementation
- [ ] Performance improvements
- [ ] Mobile app version

## 18. CONTRIBUTING
- How others can contribute
- Code style guidelines
- Pull request process
- Issue reporting guidelines

## 19. TROUBLESHOOTING
- Common issues and solutions
- FAQ section
- Where to get help

## 20. LICENSE & ACKNOWLEDGMENTS
- License information
- Credits to contributors, libraries, or inspirations
- Third-party licenses

CONTENT GUIDELINES:
- Write for both technical and non-technical audiences
- Use clear, concise language with concrete examples
- Include relevant code snippets that users can copy-paste
- Focus on practical value and real-world usage
- Anticipate user questions and address them proactively
- Make the project approachable and exciting to use

ANALYSIS INSTRUCTIONS:
Analyze the provided repository files deeply to understand:
- The project's core purpose and functionality
- Technology stack and dependencies
- Architecture and code organization  
- Entry points and main workflows
- Configuration and setup requirements
- Testing approach and build process

If information is not available in the files, make educated assumptions based on:
- File structure and naming conventions
- Common patterns in the detected technology stack
- Industry best practices for similar projects

${metaSnippet}

## REPOSITORY FILES ANALYSIS:
${fileSummaries}

Generate a README that makes developers excited to use this project and provides everything they need for success.`;
}