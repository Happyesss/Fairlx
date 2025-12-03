import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or less.").optional(),
  deadline: z.string().optional(),
  image: z
    .union([
      z.instanceof(File),
      z.string().transform((value) => (value === "" ? undefined : value)),
    ])
    .optional(),
  workspaceId: z.string(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Minimum 1 character required.").optional(),
  description: z.string().trim().max(2000, "Description must be 2000 characters or less.").optional(),
  deadline: z.string().optional().nullable(),
  image: z
    .union([
      z.instanceof(File),
      z.string().transform((value) => (value === "" ? undefined : value)),
    ])
    .optional(),
});

export const assignProjectToTeamSchema = z.object({
  projectId: z.string(),
  teamId: z.string(),
});

export const unassignProjectFromTeamSchema = z.object({
  projectId: z.string(),
  teamId: z.string(),
});

export const getTeamProjectsSchema = z.object({
  teamId: z.string(),
});
