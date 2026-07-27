/** Client-safe VCS config helpers for GitLab / Bitbucket project integrations. */

export type VcsProvider = "github" | "gitlab" | "bitbucket";

export type VcsRepoConfig = {
  provider: VcsProvider;
  /** GitLab base URL (default https://gitlab.com). Ignored for Bitbucket cloud. */
  baseUrl?: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  cloneUrl: string;
};

export type StoredVcsConfig = {
  baseUrl?: string;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  cloneUrl?: string;
};

export function normalizeBaseUrl(url?: string | null): string {
  const raw = (url || "https://gitlab.com").trim().replace(/\/+$/, "");
  return raw || "https://gitlab.com";
}

export function buildCloneUrl(
  provider: "gitlab" | "bitbucket",
  owner: string,
  repo: string,
  baseUrl?: string
): string {
  const o = owner.trim().replace(/^\/+|\/+$/g, "");
  const r = repo.trim().replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  if (provider === "bitbucket") {
    return `https://bitbucket.org/${o}/${r}.git`;
  }
  return `${normalizeBaseUrl(baseUrl)}/${o}/${r}.git`;
}

export function parseVcsConfig(
  provider: "gitlab" | "bitbucket",
  configJson?: string | null
): VcsRepoConfig | null {
  if (!configJson) return null;
  try {
    const parsed = JSON.parse(configJson) as StoredVcsConfig;
    const owner = String(parsed.owner || "").trim();
    const repo = String(parsed.repo || "").trim();
    if (!owner || !repo) return null;
    const defaultBranch = String(parsed.defaultBranch || "main").trim() || "main";
    const baseUrl =
      provider === "gitlab" ? normalizeBaseUrl(parsed.baseUrl) : undefined;
    const cloneUrl =
      String(parsed.cloneUrl || "").trim() ||
      buildCloneUrl(provider, owner, repo, baseUrl);
    return {
      provider,
      baseUrl,
      owner,
      repo,
      defaultBranch,
      cloneUrl,
    };
  } catch {
    return null;
  }
}

export function serializeVcsConfig(input: {
  provider: "gitlab" | "bitbucket";
  baseUrl?: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
}): string {
  const owner = input.owner.trim();
  const repo = input.repo.trim().replace(/\.git$/i, "");
  const defaultBranch = (input.defaultBranch || "main").trim() || "main";
  const baseUrl =
    input.provider === "gitlab" ? normalizeBaseUrl(input.baseUrl) : undefined;
  return JSON.stringify({
    ...(baseUrl ? { baseUrl } : {}),
    owner,
    repo,
    defaultBranch,
    cloneUrl: buildCloneUrl(input.provider, owner, repo, baseUrl),
  });
}
