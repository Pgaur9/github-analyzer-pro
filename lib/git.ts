import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GitDiffOptions {
  baseCommit?: string;
  targetCommit?: string;
  filePath?: string;
  contextLines?: number;
  unified?: boolean;
}

export interface GitDiffResult {
  diff: string;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  files: GitDiffFileChange[];
}

export interface GitDiffFileChange {
  path: string;
  type: 'added' | 'deleted' | 'modified' | 'renamed';
  oldPath?: string;
  insertions: number;
  deletions: number;
  diff: string;
}

export async function getGitDiff(
  repoPath: string,
  options: GitDiffOptions = {}
): Promise<GitDiffResult> {
  const {
    baseCommit = 'HEAD~1',
    targetCommit = 'HEAD',
    filePath,
    contextLines = 3,
    unified = true
  } = options;

  try {
    // Ensure we're in a git repository
    const isGitRepo = fs.existsSync(path.join(repoPath, '.git'));
    if (!isGitRepo) {
      throw new Error('Not a git repository');
    }

    // Build git diff command
    const args = [
      'git',
      'diff',
      unified ? '--unified=' + contextLines : '--no-patch',
      '--stat',
      '--numstat',
      baseCommit,
      targetCommit
    ];

    if (filePath) {
      args.push('--', filePath);
    }

    // Get diff output
    const diffOutput = execSync(args.join(' '), {
      cwd: repoPath,
      encoding: 'utf8',
      timeout: 30000, // 30 seconds timeout
    });

    // Get detailed diff for each file
    const detailedDiffArgs = [
      'git',
      'diff',
      '--unified=' + contextLines,
      baseCommit,
      targetCommit
    ];

    if (filePath) {
      detailedDiffArgs.push('--', filePath);
    }

    const detailedDiff = execSync(detailedDiffArgs.join(' '), {
      cwd: repoPath,
      encoding: 'utf8',
      timeout: 30000,
    });

    // Parse the output
    const result = parseDiffOutput(diffOutput, detailedDiff);
    
    return result;
  } catch (error) {
    throw new Error(`Git diff failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getGitLog(
  repoPath: string,
  maxCount: number = 10
): Promise<Array<{
  hash: string;
  message: string;
  author: string;
  date: string;
}>> {
  try {
    const logOutput = execSync(
      `git log --oneline --pretty=format:"%H|%s|%an|%ad" --date=short -${maxCount}`,
      {
        cwd: repoPath,
        encoding: 'utf8',
        timeout: 15000,
      }
    );

    return logOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash, message, author, date };
      });
  } catch (error) {
    throw new Error(`Git log failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    
    return branch;
  } catch (error) {
    throw new Error(`Get current branch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseDiffOutput(statOutput: string, detailedDiff: string): GitDiffResult {
  const files: GitDiffFileChange[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  // Parse stat output to get file changes
  const statLines = statOutput.split('\n').filter(line => line.trim());
  
  for (const line of statLines) {
    if (line.includes('\t')) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const insertions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const filePath = parts[2];
        
        totalInsertions += insertions;
        totalDeletions += deletions;
        
        // Determine file change type
        let type: GitDiffFileChange['type'] = 'modified';
        if (filePath.includes(' => ')) {
          type = 'renamed';
        } else if (insertions > 0 && deletions === 0) {
          type = 'added';
        } else if (insertions === 0 && deletions > 0) {
          type = 'deleted';
        }

        files.push({
          path: filePath,
          type,
          insertions,
          deletions,
          diff: extractFileDiff(detailedDiff, filePath),
        });
      }
    }
  }

  return {
    diff: detailedDiff,
    stats: {
      filesChanged: files.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
    },
    files,
  };
}

function extractFileDiff(fullDiff: string, filePath: string): string {
  const lines = fullDiff.split('\n');
  const startPattern = `diff --git a/${filePath} b/${filePath}`;
  const nextFilePattern = /^diff --git a\//;
  
  let startIndex = -1;
  let endIndex = lines.length;
  
  // Find start of this file's diff
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startPattern) || lines[i].includes(`--- a/${filePath}`)) {
      startIndex = i;
      break;
    }
  }
  
  // Find end of this file's diff (start of next file)
  if (startIndex >= 0) {
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (nextFilePattern.test(lines[i])) {
        endIndex = i;
        break;
      }
    }
  }
  
  if (startIndex >= 0) {
    return lines.slice(startIndex, endIndex).join('\n');
  }
  
  return '';
}

export function isGitRepository(repoPath: string): boolean {
  try {
    return fs.existsSync(path.join(repoPath, '.git'));
  } catch {
    return false;
  }
}

export async function cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
  try {
    execSync(`git clone ${repoUrl} ${targetPath}`, {
      encoding: 'utf8',
      timeout: 60000, // 60 seconds timeout
    });
  } catch (error) {
    throw new Error(`Git clone failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}