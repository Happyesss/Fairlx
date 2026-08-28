import { z } from "zod";

export const connectGitHubRepoSchema = z.object({
  projectId: z.string(),
  githubUrl: z.string().url().refine(
    (url) => url.includes("github.com"),
    "Must be a valid GitHub repository URL"
  ),
  branch: z.string().default("main"),
  githubToken: z.string().optional(),
});

export const generateDocumentationSchema = z.object({
  projectId: z.string(),
});

export const refineDocumentationSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(3, "Prompt must be at least 3 characters"),
  currentContent: z.string(),
});

export const saveDocumentationSchema = z.object({
  projectId: z.string(),
  content: z.string(),
  fileStructure: z.string().optional(),
  mermaidDiagram: z.string().optional(),
});

// ─── OAuth & Webhook Schemas ──────────────────

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State parameter is required"),
});

export const oauthAuthorizeSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  githubUrl: z.string().optional(),
  branch: z.string().optional(),
});


