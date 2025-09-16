// Demo repository data for when GitHub API is unavailable
import type { GitHubRepoMeta } from "./github";

export const DEMO_REPO_META: GitHubRepoMeta = {
  name: "Hello-World",
  full_name: "octocat/Hello-World",
  description: "My first repository on GitHub!",
  stargazers_count: 2000,
  language: "JavaScript",
  default_branch: "main",
  private: false,
  fork: false,
  archived: false,
  topics: ["demo", "github", "first-repo"],
  license: {
    name: "MIT License",
    spdx_id: "MIT"
  },
  homepage: "",
  html_url: "https://github.com/octocat/Hello-World",
  clone_url: "https://github.com/octocat/Hello-World.git",
  size: 100,
  created_at: "2011-01-26T19:01:12Z",
  updated_at: "2023-12-01T12:30:00Z",
  pushed_at: "2023-12-01T12:30:00Z"
};

export const DEMO_FILES = [
  {
    path: "package.json",
    content: `{
  "name": "hello-world",
  "version": "1.0.0",
  "description": "My first repository on GitHub!",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  },
  "keywords": ["demo", "github", "hello-world"],
  "author": "octocat",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}`
  },
  {
    path: "index.js",
    content: `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello World!',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`
  },
  {
    path: "README.md",
    content: `# Hello World

This is my first repository on GitHub!

## Getting Started

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Start the server: \`npm start\`

## Features

- Simple Express.js server
- JSON API endpoint
- Environment-based port configuration`
  }
];

export function isDemoRepository(owner: string, repo: string): boolean {
  return (owner.toLowerCase() === "octocat" && repo.toLowerCase() === "hello-world") ||
         (owner.toLowerCase() === "demo" && repo.toLowerCase() === "repository");
}