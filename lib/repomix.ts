import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface RepomixOptions {
  include?: string[];
  ignore?: string[];
  style?: 'xml' | 'markdown' | 'json' | 'plain';
  followSymlinks?: boolean;
}

export interface RepomixResult {
  content: string;
  stats: {
    totalFiles: number;
    totalSize: number;
    processedFiles: number;
  };
}

export async function packRepository(
  repoPath: string,
  options: RepomixOptions = {}
): Promise<RepomixResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomix-'));
  const outputFile = path.join(tempDir, 'output.txt');
  
  try {
    // Build repomix command
    const args = [
      'npx',
      'repomix',
      repoPath,
      '--output',
      outputFile,
      '--style',
      options.style || 'plain'
    ];

    // Add include patterns
    if (options.include && options.include.length > 0) {
      args.push('--include');
      args.push(options.include.join(','));
    }

    // Add ignore patterns
    if (options.ignore && options.ignore.length > 0) {
      args.push('--ignore');
      args.push(options.ignore.join(','));
    }

    // Execute repomix
    execSync(args.join(' '), {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000, // 60 seconds timeout
    });

    // Read the output file
    const content = fs.readFileSync(outputFile, 'utf8');
    
    // Parse stats from output (basic implementation)
    const stats = {
      totalFiles: (content.match(/File:/g) || []).length,
      totalSize: content.length,
      processedFiles: (content.match(/File:/g) || []).length,
    };

    return {
      content,
      stats,
    };
  } catch (error) {
    throw new Error(`Repomix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function getDefaultIgnorePatterns(): string[] {
  return [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.env',
    '.env.local',
    '.env.production',
    '*.log',
    '.DS_Store',
    'coverage',
    '.nyc_output',
    '.cache',
    '.vscode',
    '.idea',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.eslintcache',
    'tsconfig.tsbuildinfo',
  ];
}

export function getDefaultIncludePatterns(): string[] {
  return [
    '*.ts',
    '*.tsx',
    '*.js',
    '*.jsx',
    '*.py',
    '*.java',
    '*.go',
    '*.rs',
    '*.cpp',
    '*.c',
    '*.h',
    '*.cs',
    '*.php',
    '*.rb',
    '*.swift',
    '*.kt',
    '*.scala',
    '*.md',
    '*.json',
    '*.yaml',
    '*.yml',
    '*.toml',
    '*.cfg',
    '*.ini',
    'Dockerfile',
    'docker-compose.yml',
    'Makefile',
    'README*',
    'LICENSE*',
  ];
}