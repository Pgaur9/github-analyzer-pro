// Shared GitHub helpers: request wrapper and repo parser

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