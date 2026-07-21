import { createHash, randomBytes } from "crypto";
import { Databases, Query } from "node-appwrite";
import { DATABASE_ID, PROJECT_INTEGRATIONS_ID } from "@/config";
import { decryptToken } from "@/features/github-integration/lib/encryption";
import {
  CustomMcpServerConfig,
  IntegrationProvider,
  ProjectIntegration,
} from "../types";
import { parseVcsConfig, type VcsRepoConfig } from "./vcs-config";
import { slugifyBranchTitle, suggestedBranchName } from "./branch";

export { slugifyBranchTitle, suggestedBranchName };
export { parseVcsConfig, buildCloneUrl, serializeVcsConfig } from "./vcs-config";

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Prefer GitHub repo, then GitLab / Bitbucket project integrations. */
export async function resolveProjectVcs(
  databases: Databases,
  projectId: string,
  githubRepo?: {
    owner?: string;
    repositoryName?: string;
    branch?: string;
  } | null
): Promise<VcsRepoConfig | null> {
  if (githubRepo?.owner && githubRepo?.repositoryName) {
    return {
      provider: "github",
      owner: String(githubRepo.owner),
      repo: String(githubRepo.repositoryName),
      defaultBranch: String(githubRepo.branch || "main"),
      cloneUrl: `https://github.com/${githubRepo.owner}/${githubRepo.repositoryName}.git`,
    };
  }

  const gitlab = await getProjectIntegration(databases, projectId, "gitlab");
  if (gitlab?.enabled !== false) {
    const cfg = parseVcsConfig("gitlab", gitlab?.configJson);
    if (cfg) return cfg;
  }

  const bitbucket = await getProjectIntegration(databases, projectId, "bitbucket");
  if (bitbucket?.enabled !== false) {
    const cfg = parseVcsConfig("bitbucket", bitbucket?.configJson);
    if (cfg) return cfg;
  }

  return null;
}

export async function getProjectIntegration(
  databases: Databases,
  projectId: string,
  provider: IntegrationProvider
): Promise<ProjectIntegration | null> {
  try {
    const result = await databases.listDocuments<ProjectIntegration>(
      DATABASE_ID,
      PROJECT_INTEGRATIONS_ID,
      [
        Query.equal("projectId", projectId),
        Query.equal("provider", provider),
        Query.limit(1),
      ]
    );
    return result.documents[0] || null;
  } catch {
    return null;
  }
}

export async function listProjectIntegrations(
  databases: Databases,
  projectId: string
): Promise<ProjectIntegration[]> {
  try {
    const result = await databases.listDocuments<ProjectIntegration>(
      DATABASE_ID,
      PROJECT_INTEGRATIONS_ID,
      [Query.equal("projectId", projectId), Query.limit(50)]
    );
    return result.documents;
  } catch {
    return [];
  }
}

export function decryptIntegrationToken(token?: string | null): string | null {
  if (!token) return null;
  try {
    if (token.includes(":")) {
      return decryptToken(token);
    }
    return token;
  } catch {
    return null;
  }
}

export function parseCustomMcps(integration?: ProjectIntegration | null): CustomMcpServerConfig[] {
  if (!integration?.configJson) return [];
  try {
    const parsed = JSON.parse(integration.configJson) as { servers?: CustomMcpServerConfig[] };
    return Array.isArray(parsed.servers) ? parsed.servers : [];
  } catch {
    return [];
  }
}

export function hashMcpToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateMcpToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `flx_${randomBytes(24).toString("hex")}`;
  return {
    plaintext,
    hash: hashMcpToken(plaintext),
    prefix: plaintext.slice(0, 10),
  };
}

