import type { AuthContext } from "../auth/context";
import type { McpResourceDefinition, McpResourceTemplate } from "../protocol/types";
import { listSkills } from "../skills/registry";

const JSON_MIME = "application/json";

export const RESOURCE_TEMPLATES: McpResourceTemplate[] = [
  {
    uriTemplate: "fairlx://workspaces/{workspaceId}",
    name: "Workspace",
    description: "A Fairlx workspace the actor can access",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}",
    name: "Project",
    description: "A Fairlx project",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}/backlog",
    name: "Project backlog",
    description: "Work items not assigned to a sprint",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}/sprints/active",
    name: "Active sprints",
    description: "Currently active sprints in a project",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://work-items/{workItemId}",
    name: "Work item",
    description: "A single work item",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://work-items/{workItemId}/context",
    name: "Agent context",
    description: "Work item plus comments, links, sprint, and project",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}/workflow",
    name: "Project workflow",
    description: "Workflow statuses and transitions for a project",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}/docs/{docId}",
    name: "Project document",
    description: "Metadata for a project document",
    mimeType: JSON_MIME,
  },
  {
    uriTemplate: "fairlx://projects/{projectId}/activity",
    name: "Project activity",
    description: "Recent audit activity for a project",
    mimeType: JSON_MIME,
  },
];

export function listResourceTemplates(): McpResourceTemplate[] {
  return RESOURCE_TEMPLATES;
}

export function listResources(auth: AuthContext): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = listSkills().map((skill) => ({
    uri: `fairlx://skills/${skill.id}`,
    name: skill.name,
    description: skill.description,
    mimeType: "text/markdown",
  }));

  if (auth.workspaceId) {
    resources.push({
      uri: `fairlx://workspaces/${auth.workspaceId}`,
      name: "Bound workspace",
      description: "Workspace bound to this MCP token",
      mimeType: JSON_MIME,
    });
  }

  if (auth.projectId) {
    const projectId = auth.projectId;
    resources.push(
      {
        uri: `fairlx://projects/${projectId}`,
        name: "Bound project",
        description: "Project bound to this MCP token",
        mimeType: JSON_MIME,
      },
      {
        uri: `fairlx://projects/${projectId}/backlog`,
        name: "Bound project backlog",
        description: "Backlog for the bound project",
        mimeType: JSON_MIME,
      },
      {
        uri: `fairlx://projects/${projectId}/sprints/active`,
        name: "Bound active sprints",
        description: "Active sprints for the bound project",
        mimeType: JSON_MIME,
      },
      {
        uri: `fairlx://projects/${projectId}/workflow`,
        name: "Bound project workflow",
        description: "Workflow for the bound project",
        mimeType: JSON_MIME,
      },
      {
        uri: `fairlx://projects/${projectId}/activity`,
        name: "Bound project activity",
        description: "Activity for the bound project",
        mimeType: JSON_MIME,
      }
    );
  }

  return resources;
}
