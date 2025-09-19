# GitHub Analyzer Pro

An enhanced GitHub Repository Analyzer with:
- AI-powered README generator
- Lightweight repository insights
- Security alerts (Dependabot + Code Scanning)
- **AI Code Review with git diff analysis and repository context**
- One-click PR flow to update README.md in a target repository

## Tech
- Next.js 15 (App Router) + React 18 + TypeScript
- Tailwind CSS
- react-markdown + remark-gfm + remark-breaks
- repomix for repository context generation

## Setup

1) Clone and install:
```bash
pnpm install
# or
npm install
```

2) Configure environment:
```bash
cp .env.example .env
# Then set GEMINI_API_KEY=... (server-side key)
```

3) Run:
```bash
pnpm dev
# or
npm run dev
```

Open http://localhost:3000.

## Pages

- / — landing page with links
- /readme — README generator, editor + preview, and PR creation flow
- /analyzer — repo insights and security alerts
- **New: /code-review — AI-powered code review using git diff and repository context**

## New AI Code Review Feature

The AI Code Review feature provides intelligent code analysis by:

1. **Repository Context**: Uses repomix to generate a comprehensive, AI-friendly representation of the entire repository
2. **Git Diff Analysis**: Analyzes changes between commits using git diff
3. **AI-Powered Review**: Combines repository context with code changes for thorough AI review using Gemini

### Features:
- Compare any two commits (HEAD~1 vs HEAD by default)
- Support for private repositories with GitHub tokens
- Comprehensive analysis including:
  - Code quality and readability
  - Security considerations
  - Performance implications
  - Best practices adherence
  - Maintainability assessment
- Downloadable review reports
- File-by-file change summary

### API Endpoints:
- `/api/repomix-pack` - Generate repository context using repomix
- `/api/git-diff` - Get git diff between commits
- `/api/code-review` - Combined AI-powered code review

## Notes

- No secrets are hardcoded.
- The client-side "Refine selection" feature allows entering a personal Gemini key, stored locally in your browser and sent directly to Gemini (never to this server).
- AI Code Review requires a configured Gemini API key for comprehensive analysis.