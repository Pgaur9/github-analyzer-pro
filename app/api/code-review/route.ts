import { NextRequest, NextResponse } from "next/server";
import { packRepository, getDefaultIgnorePatterns, getDefaultIncludePatterns } from "@/lib/repomix";
import { getGitDiff, getCurrentBranch } from "@/lib/git";
import { parseRepo } from "@/lib/github";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CODE_REVIEW_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance, and maintainability. 

Your task is to review the provided code changes and repository context to provide a comprehensive code review.

## ANALYSIS FRAMEWORK

### 1. CODE QUALITY
- Code readability and clarity
- Adherence to coding standards and conventions
- Proper error handling and edge cases
- Code duplication and reusability
- Documentation and comments quality

### 2. SECURITY ANALYSIS
- Input validation and sanitization
- Authentication and authorization
- Data exposure and privacy concerns
- Injection vulnerabilities (SQL, XSS, etc.)
- Secure coding practices

### 3. PERFORMANCE CONSIDERATIONS
- Algorithm efficiency and complexity
- Memory usage and resource management
- Database query optimization
- Caching strategies
- Potential bottlenecks

### 4. MAINTAINABILITY
- Code organization and structure
- Separation of concerns
- Testing coverage and quality
- Dependency management
- Configuration management

### 5. BEST PRACTICES
- Design patterns usage
- SOLID principles adherence
- Framework/language specific best practices
- API design and versioning
- Error handling strategies

## OUTPUT FORMAT

Provide your review in the following structured format:

### 🎯 EXECUTIVE SUMMARY
Brief overview of the changes and overall assessment (2-3 sentences)

### ✅ POSITIVE ASPECTS
- List specific things done well
- Highlight good practices observed

### ⚠️ ISSUES FOUND
For each issue:
- **Severity**: Critical/High/Medium/Low
- **Category**: Security/Performance/Maintainability/Style
- **Location**: File path and line numbers if applicable
- **Description**: Clear explanation of the issue
- **Recommendation**: Specific action to address the issue

### 🔧 IMPROVEMENT SUGGESTIONS
- Broader architectural or design suggestions
- Code organization improvements
- Performance optimization opportunities

### 📋 CHECKLIST
- [ ] Code follows project conventions
- [ ] Proper error handling implemented
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Tests are adequate
- [ ] Documentation is sufficient

### 🎯 OVERALL RATING
Rate from 1-5 stars with brief justification

---

## REPOSITORY CONTEXT:
{repoContext}

## CODE CHANGES TO REVIEW:
{diffContent}

## ADDITIONAL CONTEXT:
- Repository: {repository}
- Branch: {branch}
- Comparing: {baseCommit} → {targetCommit}
- Files changed: {filesChanged}
- Total changes: +{insertions} -{deletions}

Please provide a thorough, constructive review focusing on actionable feedback.`;

export async function POST(req: NextRequest) {
  try {
    const { 
      repo, 
      githubToken, 
      baseCommit = 'HEAD~1', 
      targetCommit = 'HEAD',
      includeRepoContext = true,
      filePath 
    } = await req.json();

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "Missing repo parameter" }, { status: 400 });
    }

    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub repo. Use URL or owner/repo." }, { status: 400 });
    }

    const { owner, repo: repoName } = parsed;

    // Check if Gemini API key is available
    const apiKey = process.env.GEMINI_API_KEY;
    const isValidApiKey = apiKey && apiKey !== "your_gemini_api_key_here" && apiKey.trim().length > 0;
    
    if (!isValidApiKey) {
      return NextResponse.json({ 
        error: "AI code review requires Gemini API key to be configured." 
      }, { status: 503 });
    }

    // Create temporary directory for cloning
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-review-'));
    const repoPath = path.join(tempDir, repoName);

    try {
      // Clone the repository
      const cloneUrl = githubToken 
        ? `https://${githubToken}@github.com/${owner}/${repoName}.git`
        : `https://github.com/${owner}/${repoName}.git`;

      execSync(`git clone ${cloneUrl} ${repoPath}`, {
        encoding: 'utf8',
        timeout: 60000,
        stdio: 'ignore',
      });

      // Get git diff
      const diffResult = await getGitDiff(repoPath, {
        baseCommit,
        targetCommit,
        filePath,
        contextLines: 5,
      });

      // Get repository context if requested
      let repoContext = "";
      if (includeRepoContext) {
        try {
          const packResult = await packRepository(repoPath, {
            style: 'plain',
            ignore: [...getDefaultIgnorePatterns(), '.git/**', 'node_modules/**'],
            include: getDefaultIncludePatterns(),
          });
          
          // Truncate repo context if too large (keep first 8000 chars)
          repoContext = packResult.content.length > 8000 
            ? packResult.content.substring(0, 8000) + "\n\n[... truncated for length ...]"
            : packResult.content;
        } catch (error) {
          console.warn('Failed to get repo context:', error);
          repoContext = "Repository context unavailable";
        }
      }

      // Get additional git information
      const currentBranch = await getCurrentBranch(repoPath);

      // Prepare prompt for AI
      const prompt = CODE_REVIEW_PROMPT
        .replace('{repoContext}', repoContext)
        .replace('{diffContent}', diffResult.diff)
        .replace('{repository}', `${owner}/${repoName}`)
        .replace('{branch}', currentBranch)
        .replace('{baseCommit}', baseCommit)
        .replace('{targetCommit}', targetCommit)
        .replace('{filesChanged}', diffResult.stats.filesChanged.toString())
        .replace('{insertions}', diffResult.stats.insertions.toString())
        .replace('{deletions}', diffResult.stats.deletions.toString());

      // Call Gemini API for code review
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const reviewContent = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No review generated';

      return NextResponse.json({
        success: true,
        repository: `${owner}/${repoName}`,
        branch: currentBranch,
        comparison: {
          base: baseCommit,
          target: targetCommit,
        },
        diff: {
          stats: diffResult.stats,
          files: diffResult.files.map(f => ({
            path: f.path,
            type: f.type,
            insertions: f.insertions,
            deletions: f.deletions,
          })),
        },
        review: reviewContent,
        includeRepoContext,
      });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      
      // Handle specific error cases
      if (message.includes("Authentication failed") || message.includes("403")) {
        return NextResponse.json({ 
          error: "Repository access denied. Please check if the repository is private and provide a valid GitHub token." 
        }, { status: 403 });
      }
      
      if (message.includes("not found") || message.includes("404")) {
        return NextResponse.json({ 
          error: "Repository not found. Please check the repository name." 
        }, { status: 404 });
      }

      if (message.includes("Gemini API error")) {
        return NextResponse.json({ 
          error: "AI service temporarily unavailable. Please try again later." 
        }, { status: 503 });
      }

      return NextResponse.json({ error: `Code review failed: ${message}` }, { status: 500 });
    } finally {
      // Cleanup temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}