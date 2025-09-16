# GitHub Analyzer Pro

🚀 **An enhanced GitHub Repository Analyzer** with AI-powered README generation, comprehensive code analysis, and security scanning capabilities.

![GitHub Analyzer Pro Interface](https://github.com/user-attachments/assets/58531639-1c11-4668-bc21-c9a7afc950d3)

## ✨ Key Features

- 🤖 **AI-Powered README Generator** - Create comprehensive, professional READMEs with live typing animation
- 🔍 **Advanced Code Analysis** - Detect security vulnerabilities, bugs, performance issues, and code smells
- 📊 **Repository Insights** - Get detailed analysis of file types, languages, and project structure
- 🛡️ **Security Scanning** - Identify security alerts, vulnerable dependencies, and code scanning issues
- 📝 **Live Editor & Preview** - Side-by-side markdown editing with real-time preview
- 🔄 **GitHub Integration** - Works with both public and private repositories
- 📱 **Responsive Design** - Beautiful interface that works on all devices

## 🏗️ Architecture

Built with modern web technologies for performance and scalability:
- **Frontend**: Next.js 15 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Markdown**: react-markdown with GitHub Flavored Markdown support
- **AI Integration**: Google Gemini for intelligent analysis and generation
- **API Integration**: GitHub REST API for repository access

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | Next.js | 15.x | Full-stack React framework |
| Runtime | Node.js | 18+ | Server runtime |
| Language | TypeScript | 5.x | Type-safe development |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI Components | Lucide React | Latest | Icons and UI elements |
| Markdown | react-markdown | 9.x | Markdown rendering |
| AI Provider | Google Gemini | Latest | LLM for analysis and generation |

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm, yarn, or pnpm package manager
- Google Gemini API key ([Get one here](https://ai.google.dev/))
- GitHub token (optional, for private repositories)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Pgaur9/github-analyzer-pro.git
cd github-analyzer-pro
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Configure environment**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
# Required: Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: GitHub Token for private repositories
GITHUB_TOKEN=your_github_token_here
```

4. **Start development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open in browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Usage

### README Generation

1. **Navigate to `/readme`**
2. **Enter a GitHub repository** (URL or owner/repo format)
3. **Watch the magic happen** - AI analyzes your code and generates a comprehensive README
4. **Enjoy the typing animation** - See your README appear with smooth, realistic typing
5. **Edit and preview** - Make changes in the side-by-side editor
6. **Download or create PR** - Export your README or submit it directly to GitHub

### Code Analysis

1. **Visit `/analyzer` for security analysis** 
2. **Use the AI scan endpoint** for comprehensive code analysis with:
   - **Security vulnerabilities** (SQL injection, weak crypto, hardcoded secrets)
   - **Bug detection** (null pointers, resource leaks, error handling)
   - **Performance issues** (inefficient algorithms, N+1 queries)
   - **Code quality** (complexity, duplication, style issues)

### Advanced Features

- **Auto-scroll**: Editor and preview automatically scroll during generation
- **Variable speed typing**: Headers and code blocks type slower for readability
- **Real-time stats**: See line count and character count as you type
- **AI refinement**: Select text and use AI to improve clarity and style
- **GitHub integration**: Create pull requests directly from the interface

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | none | Yes |
| `GITHUB_TOKEN` | GitHub personal access token | none | No* |
| `NODE_ENV` | Environment mode | development | No |

*GitHub token is only required for private repositories. Public repositories work without authentication but may be rate-limited.

## 📁 Project Structure

```
github-analyzer-pro/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── ai-scan/       # AI-powered code analysis
│   │   ├── analyze-repo/  # Repository analysis
│   │   └── generate-readme/ # README generation
│   ├── readme/            # README generator page
│   ├── analyzer/          # Code analysis page
│   └── layout.tsx         # Root layout
├── lib/                   # Shared utilities
│   ├── github.ts          # GitHub API helpers
│   ├── heuristics.ts      # Code analysis engine
│   ├── prompt.ts          # AI prompt templates
│   └── prompts/           # Specialized prompts
├── components/            # React components
├── public/               # Static assets
└── README.md            # This file
```

## 🎨 Features Deep Dive

### Enhanced README Generation
- **Comprehensive Analysis**: Analyzes 20+ sections including architecture, workflow, and deployment
- **Smart Content**: Understands your tech stack and suggests appropriate content
- **Professional Structure**: Follows industry best practices for documentation
- **Visual Elements**: Includes tables, badges, and code examples

### Advanced Code Analysis
- **Security Scanning**: Detects common vulnerabilities and security anti-patterns
- **Performance Analysis**: Identifies bottlenecks and optimization opportunities
- **Code Quality**: Measures complexity, duplication, and maintainability
- **Actionable Insights**: Provides specific remediation steps for each issue

### Beautiful UI/UX
- **Smooth Animations**: Realistic typing effects with variable speed
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Live Preview**: See changes instantly in the side-by-side preview
- **Status Indicators**: Clear feedback on what's happening

## 🧪 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

**Rate Limiting**: If you see 403 errors, you may be hitting GitHub's rate limits. Add a GitHub token to increase your rate limit.

**API Key Issues**: Ensure your `GEMINI_API_KEY` is set correctly in `.env.local` and has the necessary permissions.

**Build Errors**: Make sure you're using Node.js 18+ and all dependencies are installed.

### Getting Help

- 📖 Check the [documentation](https://github.com/Pgaur9/github-analyzer-pro)
- 🐛 Report bugs via [GitHub Issues](https://github.com/Pgaur9/github-analyzer-pro/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/Pgaur9/github-analyzer-pro/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Google Gemini](https://ai.google.dev/) for powerful AI capabilities
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Lucide](https://lucide.dev/) for beautiful icons
- The open-source community for inspiration and tools

---

**Built with ❤️ by the GitHub Analyzer Pro team**