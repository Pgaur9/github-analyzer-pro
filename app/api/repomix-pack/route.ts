import { NextRequest, NextResponse } from "next/server";
import { packRepository, getDefaultIgnorePatterns, getDefaultIncludePatterns } from "@/lib/repomix";
import { parseRepo } from "@/lib/github";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const { repo, githubToken, options = {} } = await req.json();

    if (!repo || typeof repo !== "string") {
      return NextResponse.json({ error: "Missing repo parameter" }, { status: 400 });
    }

    const parsed = parseRepo(repo);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub repo. Use URL or owner/repo." }, { status: 400 });
    }

    const { owner, repo: repoName } = parsed;

    // Create temporary directory for cloning
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomix-clone-'));
    const repoPath = path.join(tempDir, repoName);

    try {
      // Clone the repository
      const cloneUrl = githubToken 
        ? `https://${githubToken}@github.com/${owner}/${repoName}.git`
        : `https://github.com/${owner}/${repoName}.git`;

      execSync(`git clone ${cloneUrl} ${repoPath}`, {
        encoding: 'utf8',
        timeout: 60000,
        stdio: 'ignore', // Suppress output for security
      });

      // Prepare repomix options with defaults
      const repomixOptions = {
        outputFormat: options.outputFormat || 'txt',
        ignore: [...getDefaultIgnorePatterns(), ...(options.ignore || [])],
        include: options.include || getDefaultIncludePatterns(),
        maxFileSize: options.maxFileSize || 100000, // 100KB default
        followSymlinks: options.followSymlinks || false,
      };

      // Pack the repository
      const result = await packRepository(repoPath, repomixOptions);

      return NextResponse.json({
        success: true,
        content: result.content,
        stats: result.stats,
        repository: `${owner}/${repoName}`,
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

      return NextResponse.json({ error: `Failed to pack repository: ${message}` }, { status: 500 });
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