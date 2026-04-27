import { GITHUB_API_BASE } from "../constants";

interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

export class GitHubAPI {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.GH_PERSONAL_TOKEN || "";
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Fairlx-App",
    };
    
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    
    return headers;
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      // Retry on 429 (Rate Limit), 403 (could be secondary rate limit), or 5xx
      if ((response.status === 429 || response.status === 403 || response.status >= 500) && retries > 0) {
        // If it's a 403, we should check if it's actually a rate limit
        // Secondary rate limits often return 403
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (4 - retries);
        
        // Capped delay consistent with Gemini logic
        const waitTime = Math.min(delay, 5000); 
        
        await new Promise(r => setTimeout(r, waitTime));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        // Retry on connection errors
        await new Promise(r => setTimeout(r, 1000 * (4 - retries)));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } {
    try {
      const cleanUrl = url.replace(/\.git$/, "").replace(/\/$/, "");
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      
      if (!match) {
        throw new Error("Invalid GitHub URL format");
      }

      return {
        owner: match[1]!,
        repo: match[2]!,
      };
    } catch {
      throw new Error("Failed to parse GitHub URL");
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string) {
    const response = await this.fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("REPO_NOT_FOUND");
      }
      if (response.status === 403) {
        // Log the 403 body for debugging
        try {
          const errorBody = await response.json();
          console.error("[GitHub API 403 Error]:", errorBody);
          
          if (errorBody.message?.includes("rate limit")) {
            throw new Error("GITHUB_RATE_LIMIT");
          }
          
          throw new Error(`ACCESS_DENIED: ${errorBody.message || "Forbidden"}`);
        } catch {
          throw new Error("ACCESS_DENIED");
        }
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data,
      private: data.private || false,
    };
  }

  /**
   * Check if repository is accessible with current token
   */
  async checkRepositoryAccess(owner: string, repo: string): Promise<{
    accessible: boolean;
    isPrivate: boolean;
    needsToken: boolean;
    error?: string;
  }> {
    try {
      const repoData = await this.getRepository(owner, repo);
      return {
        accessible: true,
        isPrivate: repoData.private,
        needsToken: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage === "REPO_NOT_FOUND") {
        // Could be private or doesn't exist
        return {
          accessible: false,
          isPrivate: true, // Assume private since we can't access
          needsToken: true,
          error: "Repository not found or private. Token required.",
        };
      }
      
      if (errorMessage === "ACCESS_DENIED") {
        return {
          accessible: false,
          isPrivate: true,
          needsToken: true,
          error: "Access denied. This is a private repository. Token required.",
        };
      }
      
      return {
        accessible: false,
        isPrivate: false,
        needsToken: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get repository contents
   */
  async getContents(
    owner: string,
    repo: string,
    path: string = "",
    branch: string = "main"
  ): Promise<GitHubFileContent[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    
    const response = await this.fetchWithRetry(url, { headers: this.getHeaders() });

    if (!response.ok) {
      if (response.status === 404) {
        // Try with master branch
        if (branch === "main") {
          return this.getContents(owner, repo, path, "master");
        }
        throw new Error("Path not found in repository");
      }
      throw new Error(`Failed to fetch contents: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Get file content (decoded)
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string = "main"
  ): Promise<string> {
    const contents = await this.getContents(owner, repo, path, branch);
    const file = contents[0];

    if (!file || file.type !== "file") {
      throw new Error(`Invalid file type for ${path}`);
    }

    // If content is present, use it
    if (file.content) {
      return Buffer.from(file.content, "base64").toString("utf-8");
    }

    // If content is missing (e.g. for files > 1MB), use download_url
    if (file.download_url) {
      const response = await this.fetchWithRetry(file.download_url, {});
      if (!response.ok) {
        throw new Error(`Failed to download file from ${file.download_url}`);
      }
      return await response.text();
    }

    throw new Error(`Content not available for ${path}`);
  }

  /**
   * Recursively get all files in repository
   */
  async getAllFiles(
    owner: string,
    repo: string,
    branch: string = "main",
    path: string = "",
    maxFiles: number = 100
  ): Promise<Array<{ path: string; content: string; type: string }>> {
    const files: Array<{ path: string; content: string; type: string }> = [];
    
    try {
      const contents = await this.getContents(owner, repo, path, branch);

      // Parallelize file content fetching with a concurrency limit
      const CONCURRENCY_LIMIT = 5;

      const processItem = async (item: GitHubFileContent) => {
        // Skip common directories that don't need analysis
        if (
          item.type === "dir" &&
          (item.name.startsWith(".") ||
            ["node_modules", "dist", "build", "vendor", "__pycache__", ".git", ".next"].includes(
              item.name
            ))
        ) {
          return;
        }

        if (item.type === "file") {
          if (files.length >= maxFiles) return;

          // Only process code files
          const codeExtensions = [
            ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cs", ".rb", ".php", ".swift", ".kt", ".md", ".json", ".yaml", ".yml",
          ];

          if (codeExtensions.some((ext) => item.name.endsWith(ext))) {
            try {
              const content = await this.getFileContent(owner, repo, item.path, branch);
              files.push({
                path: item.path,
                content: content.slice(0, 10000), // Limit content size
                type: item.name.split(".").pop() || "unknown",
              });
            } catch (e) {
              console.warn(`[GitHub API] Failed to fetch file ${item.path}:`, e);
            }
          }
        } else if (item.type === "dir") {
          try {
            const subFiles = await this.getAllFiles(
              owner,
              repo,
              branch,
              item.path,
              maxFiles
            );
            // Deduplicate and limit
            for (const f of subFiles) {
              if (files.length < maxFiles && !files.find(existing => existing.path === f.path)) {
                files.push(f);
              }
            }
          } catch (e) {
             console.warn(`[GitHub API] Failed to fetch dir ${item.path}:`, e);
          }
        }
      };

      // Concurrency worker implementation
      const pool = [...contents];
      const workers = Array(Math.min(CONCURRENCY_LIMIT, pool.length)).fill(null).map(async () => {
        while (pool.length > 0 && files.length < maxFiles) {
          const item = pool.shift();
          if (item) {
            await processItem(item);
          }
        }
      });

      await Promise.all(workers);
    } catch (e) {
      console.error("[GitHub API] Error in getAllFiles:", e);
    }

    return files;
  }

  /**
   * Get recent commits with file details (optimized for batch requests with pagination)
   * Fetches detailed information for ALL commits
   */
  async getCommits(
    owner: string,
    repo: string,
    branch: string = "main",
    limit: number = 500
  ): Promise<GitHubCommit[]> {
    const perPage = 100; // GitHub API max per page
    const allCommits: GitHubCommit[] = [];
    let page = 1;
    
    try {
      while (allCommits.length < limit) {
        const remaining = limit - allCommits.length;
        const pageSize = Math.min(remaining, perPage);
        
        // Fetch commits with basic info (1 API call per page)
        const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${pageSize}&page=${page}`;
        
        const response = await this.fetchWithRetry(url, { headers: this.getHeaders() });

        if (!response.ok) {
          if (response.status === 404 && branch === "main" && page === 1) {
            return this.getCommits(owner, repo, "master", limit);
          }
          throw new Error(`Failed to fetch commits: ${response.statusText}`);
        }

        const commits = await response.json();
        
        // If no more commits, break
        if (!commits || commits.length === 0) {
          break;
        }
        
        // Fetch detailed info for ALL commits with file changes
        const batchSize = 10;
        const detailedCommits: GitHubCommit[] = [];
        
        for (let i = 0; i < commits.length; i += batchSize) {
          const batch = commits.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (commit: GitHubCommit) => {
              try {
                const detailUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`;
                const detailResponse = await this.fetchWithRetry(detailUrl, { headers: this.getHeaders() });
                
                if (!detailResponse.ok) {
                  return commit; // Return basic commit if details fail
                }
                
                return await detailResponse.json();
              } catch {
                return commit;
              }
            })
          );
          detailedCommits.push(...batchResults);
          
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < commits.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Add all detailed commits
        allCommits.push(...detailedCommits);
        
        // If we got fewer commits than requested, we've reached the end
        if (commits.length < pageSize) {
          break;
        }
        
        page++;
        
        // Small delay between pages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return allCommits.slice(0, limit);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get single commit with details
   */
  async getCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<GitHubCommit> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`;
    
    const response = await this.fetchWithRetry(url, { headers: this.getHeaders() });

    if (!response.ok) {
      throw new Error(`Failed to fetch commit: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get commit diff
   */
  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`;
    
    const response = await this.fetchWithRetry(url, {
      headers: {
        ...this.getHeaders(),
        Accept: "application/vnd.github.v3.diff",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch commit diff: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Generate file tree structure
   */
  generateFileTree(files: Array<{ path: string }>): string {
    const tree: Record<string, unknown> = {};

    files.forEach((file) => {
      const parts = file.path.split("/");
      let current: Record<string, unknown> = tree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = null; // File
        } else {
          current[part] = current[part] || {};
          current = current[part] as Record<string, unknown>;
        }
      });
    });

    const buildTreeString = (obj: Record<string, unknown>, prefix: string = ""): string => {
      const entries = Object.entries(obj);
      return entries
        .map(([key, value], index) => {
          const isLast = index === entries.length - 1;
          const connector = isLast ? "`-- " : "|-- ";
          const newPrefix = prefix + (isLast ? "    " : "|   ");

          if (value === null) {
            return `${prefix}${connector}${key}`;
          } else {
            return `${prefix}${connector}${key}/\n${buildTreeString(
              value as Record<string, unknown>,
              newPrefix
            )}`;
          }
        })
        .join("\n");
    };

    return buildTreeString(tree);
  }

  /**
   * Generate Mermaid diagram from file structure
   */
  generateMermaidDiagram(files: Array<{ path: string }>): string {
    const directories = new Set<string>();
    const filesByDir: Record<string, string[]> = {};

    files.forEach((file) => {
      const parts = file.path.split("/");
      
      if (parts.length === 1) {
        filesByDir["root"] = filesByDir["root"] || [];
        filesByDir["root"].push(parts[0]!);
      } else {
        const dir = parts.slice(0, -1).join("/");
        const fileName = parts[parts.length - 1]!;
        
        directories.add(dir);
        filesByDir[dir] = filesByDir[dir] || [];
        filesByDir[dir].push(fileName);
      }
    });

    let mermaid = "graph TD\n";
    mermaid += "    Root[Project Root]\n";

    Array.from(directories)
      .slice(0, 20)
      .forEach((dir) => {
        const dirId = dir.replace(/[\/\-\.]/g, "_");
        const dirName = dir.split("/").pop() || dir;
        mermaid += `    ${dirId}["[DIR] ${dirName}"]\n`;
        
        const parentDir = dir.split("/").slice(0, -1).join("/");
        const parentId = parentDir ? parentDir.replace(/[\/\-\.]/g, "_") : "Root";
        mermaid += `    ${parentId} --> ${dirId}\n`;
      });

    return mermaid;
  }
}

export const githubAPI = new GitHubAPI();
