// Shared GitHub helpers: request wrapper and repo parser

export interface GitHubRepoMeta {
  name: string;
  full_name: string;
  description?: string;
  stargazers_count: number;
  language?: string;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  license?: {
    name: string;
    spdx_id: string;
  };
  homepage?: string;
  html_url: string;
  clone_url: string;
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
}

export function parseRepo(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const urlMatch = input.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/|$)/i);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const plain = input.match(/^([^\/]+)\/([^\/]+)$/);
  if (plain) return { owner: plain[1], repo: plain[2] };
  return null;
}

export async function githubRequest<T>(
  pathOrUrl: string,
  token?: string,
  init?: RequestInit
): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbsolute ? pathOrUrl : `https://api.github.com${pathOrUrl}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-analyzer-pro",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Throw with status embedded so callers can humanize the error
    throw new Error(`GitHub API ${res.status}: ${text || res.statusText}`);
  }
  // Some endpoints may return 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export async function getCandidateFiles(
  owner: string,
  repo: string,
  token?: string,
  ref = "HEAD",
  limitFiles = 100
): Promise<GitHubFile[]> {
  // Get repository tree (recursive)
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-analyzer-pro",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  
  if (!treeRes.ok) {
    const text = await treeRes.text().catch(() => "");
    throw new Error(`GitHub API ${treeRes.status}: ${text || treeRes.statusText}`);
  }

  const tree = await treeRes.json();
  
  // Filter to important code files, prioritize configuration and source files
  const importantExtensions = /\.(ts|tsx|js|jsx|py|java|kt|kts|go|rb|php|cs|cpp|cc|c|scala|rs|swift|json|yaml|yml|toml|md|txt|sh|dockerfile|makefile)$/i;
  const configFiles = /^(package\.json|tsconfig\.json|\.env|\.gitignore|README\.md|LICENSE|Dockerfile|Makefile|pom\.xml|build\.gradle|requirements\.txt|Cargo\.toml|go\.mod|composer\.json)$/i;
  
  const candidates = (tree.tree || [])
    .filter((node: any) => node.type === "blob")
    .filter((node: any) => {
      // Always include important config files
      if (configFiles.test(node.path.split('/').pop() || '')) return true;
      // Include files with important extensions
      if (importantExtensions.test(node.path)) return true;
      // Skip everything else
      return false;
    })
    .sort((a: any, b: any) => {
      // Prioritize config files
      const aIsConfig = configFiles.test(a.path.split('/').pop() || '');
      const bIsConfig = configFiles.test(b.path.split('/').pop() || '');
      if (aIsConfig && !bIsConfig) return -1;
      if (!aIsConfig && bIsConfig) return 1;
      // Then by depth (prefer root files)
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;
      return aDepth - bDepth;
    })
    .slice(0, limitFiles)
    .map((node: any) => ({
      name: node.path.split('/').pop() || '',
      path: node.path,
      sha: node.sha,
      size: node.size || 0,
      url: node.url,
      html_url: `https://github.com/${owner}/${repo}/blob/${ref}/${node.path}`,
      git_url: node.url,
      download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${node.path}`,
      type: "file"
    }));

  return candidates;
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string,
  ref = "HEAD"
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-analyzer-pro",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
    const contentRes = await fetch(contentUrl, { headers });
    
    if (!contentRes.ok) {
      // For public repos without auth, try raw URL as fallback
      if (!token && contentRes.status === 403) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
        const rawRes = await fetch(rawUrl);
        if (rawRes.ok) {
          const text = await rawRes.text();
          // Limit file size to prevent memory issues
          return text.length > 200_000 ? text.substring(0, 200_000) + "\n... (truncated)" : text;
        }
      }
      return null;
    }

    const content = await contentRes.json();
    
    // Handle file content (usually base64 encoded)
    if (content.content && content.encoding === "base64") {
      const decoded = Buffer.from(content.content, "base64").toString("utf8");
      // Limit file size to prevent memory issues
      return decoded.length > 200_000 ? decoded.substring(0, 200_000) + "\n... (truncated)" : decoded;
    }
    
    return null;
  } catch (error) {
    // Return null for any errors (file not found, network issues, etc.)
    return null;
  }
}