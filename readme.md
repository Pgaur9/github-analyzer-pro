# GitHub Analyzer Pro

An enhanced GitHub Repository Analyzer with:
- AI-powered README generator
- Lightweight repository insights
- Security alerts (Dependabot + Code Scanning)
- One-click PR flow to update README.md in a target repository

## Tech
- Next.js 15 (App Router) + React 18 + TypeScript
- Tailwind CSS
- react-markdown + remark-gfm + remark-breaks

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

## Notes

- No secrets are hardcoded.
- The client-side "Refine selection" feature allows entering a personal Gemini key, stored locally in your browser and sent directly to Gemini (never to this server).