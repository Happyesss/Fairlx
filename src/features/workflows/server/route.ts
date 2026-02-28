import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query, type Databases } from "node-appwrite";
import { z } from "zod";

import { getMember } from "@/features/members/utils";
import { MemberRole } from "@/features/members/types";
import { SpaceRole, SpaceMember } from "@/features/spaces/types";

import {
  DATABASE_ID,
  WORKFLOWS_ID,
  WORKFLOW_STATUSES_ID,
  WORKFLOW_TRANSITIONS_ID,
  PROJECTS_ID,
  PROJECT_TEAM_MEMBERS_ID,
  SPACE_MEMBERS_ID,
  CUSTOM_COLUMNS_ID,
  DEFAULT_COLUMN_SETTINGS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createWorkflowStatusSchema,
  updateWorkflowStatusSchema,
  createWorkflowTransitionSchema,
  updateWorkflowTransitionSchema,
} from "../schemas";
import {
  Workflow,
  WorkflowStatus,
  WorkflowTransition,
  PopulatedWorkflow,
  DEFAULT_SOFTWARE_WORKFLOW,
  StatusType,
} from "../types";

/**
 * Helper function to check if user has permission to manage workflows
 * Permissions:
 * - Workspace OWNER or ADMIN can manage all workflows
 * - Space ADMIN (Master) can manage workflows in their space
 */
async function checkWorkflowPermission(
  databases: Databases,
  workspaceId: string,
  userId: string,
  spaceId?: string | null
): Promise<{ hasPermission: boolean; member: { role?: string } | null }> {
  const member = (await getMember({
    databases,
    workspaceId,
    userId,
  })) as { role?: string } | undefined;

  if (!member) {
    return { hasPermission: false, member: null };
  }

  // Workspace OWNER or ADMIN can always manage workflows
  if (member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN) {
    return { hasPermission: true, member };
  }

  // If it's a space-level workflow, check if user is Space Master
  if (spaceId) {
    const spaceMembership = await databases.listDocuments<SpaceMember>(
      DATABASE_ID,
      SPACE_MEMBERS_ID,
      [
        Query.equal("spaceId", spaceId),
        Query.equal("userId", userId),
      ]
    );

    if (spaceMembership.total > 0 && spaceMembership.documents[0].role === SpaceRole.ADMIN) {
      return { hasPermission: true, member };
    }
  }

  return { hasPermission: false, member };
}

const app = new Hono()
  // Create a new workflow
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createWorkflowSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        name,
        key,
        description,
        workspaceId,
        spaceId,
        isDefault,
        copyFromWorkflowId,
      } = c.req.valid("json");

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workspaceId,
        user.$id,
        spaceId
      );

      if (!hasPermission) {
        return c.json(
          { error: "Only workspace owners, admins, or space masters can create workflows" },
          403
        );
      }

      // Create the workflow
      const workflow = await databases.createDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        ID.unique(),
        {
          name,
          key,
          description: description || null,
          workspaceId,
          spaceId: spaceId || null,
          isDefault: isDefault || false,
          isArchived: false,
        }
      );

      // If copying from existing workflow
      if (copyFromWorkflowId) {
        const sourceStatuses = await databases.listDocuments<WorkflowStatus>(
          DATABASE_ID,
          WORKFLOW_STATUSES_ID,
          [Query.equal("workflowId", copyFromWorkflowId), Query.orderAsc("position")]
        );

        const sourceTransitions = await databases.listDocuments<WorkflowTransition>(
          DATABASE_ID,
          WORKFLOW_TRANSITIONS_ID,
          [Query.equal("workflowId", copyFromWorkflowId)]
        );

        // Copy statuses and create mapping
        const statusIdMap: Record<string, string> = {};
        for (const status of sourceStatuses.documents) {
          const newStatus = await databases.createDocument<WorkflowStatus>(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            ID.unique(),
            {
              workflowId: workflow.$id,
              name: status.name,
              key: status.key,
              icon: status.icon,
              color: status.color,
              statusType: status.statusType,
              description: status.description,
              position: status.position,
              positionX: status.positionX || 0,
              positionY: status.positionY || 0,
              isInitial: status.isInitial,
              isFinal: status.isFinal,
            }
          );
          statusIdMap[status.$id] = newStatus.$id;
        }

        // Copy transitions with mapped status IDs
        for (const transition of sourceTransitions.documents) {
          const newFromId = statusIdMap[transition.fromStatusId];
          const newToId = statusIdMap[transition.toStatusId];
          if (newFromId && newToId) {
            await databases.createDocument<WorkflowTransition>(
              DATABASE_ID,
              WORKFLOW_TRANSITIONS_ID,
              ID.unique(),
              {
                workflowId: workflow.$id,
                fromStatusId: newFromId,
                toStatusId: newToId,
                name: transition.name,
                description: transition.description,
                allowedTeamIds: transition.allowedTeamIds,
                allowedMemberRoles: transition.allowedMemberRoles,
                requiresApproval: transition.requiresApproval,
                approverTeamIds: transition.approverTeamIds,
              }
            );
          }
        }
      } else {
        // Create default statuses from template (Software Development - simple linear flow)
        const template = DEFAULT_SOFTWARE_WORKFLOW;
        const statusIdMap: Record<string, string> = {};

        for (const statusDef of template.statuses) {
          const status = await databases.createDocument<WorkflowStatus>(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            ID.unique(),
            {
              workflowId: workflow.$id,
              name: statusDef.name,
              key: statusDef.key,
              icon: statusDef.icon,
              color: statusDef.color,
              statusType: statusDef.statusType,
              position: statusDef.position,
              positionX: statusDef.positionX || (statusDef.position * 250),
              positionY: statusDef.positionY || 100,
              isInitial: statusDef.isInitial,
              isFinal: statusDef.isFinal,
            }
          );
          statusIdMap[statusDef.key] = status.$id;
        }

        // ALWAYS create simple transitions from template (never use "ALL")
        // Software Development template has proper defined transitions
        if (Array.isArray(template.transitions)) {
          // Create transitions from template
          for (const transitionDef of template.transitions) {
            const fromId = statusIdMap[transitionDef.from];
            const toId = statusIdMap[transitionDef.to];
            if (fromId && toId) {
              await databases.createDocument<WorkflowTransition>(
                DATABASE_ID,
                WORKFLOW_TRANSITIONS_ID,
                ID.unique(),
                {
                  workflowId: workflow.$id,
                  fromStatusId: fromId,
                  toStatusId: toId,
                  name: transitionDef.name || null,
                  allowedTeamIds: transitionDef.allowedTeamIds || null,
                  requiresApproval: transitionDef.requiresApproval || false,
                }
              );
            }
          }
        }
      }

      return c.json({ data: workflow });
    }
  )

  // Get all workflows for a workspace/space/project
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        spaceId: z.string().optional(),
        projectId: z.string().optional(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, spaceId, projectId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const queries = [Query.equal("workspaceId", workspaceId)];

      if (projectId) {
        queries.push(Query.equal("projectId", projectId));
      } else if (spaceId) {
        queries.push(Query.equal("spaceId", spaceId));
      }

      const workflows = await databases.listDocuments<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        queries
      );

      // Populate with status counts
      const populatedWorkflows: PopulatedWorkflow[] = await Promise.all(
        workflows.documents.map(async (workflow) => {
          const statuses = await databases.listDocuments<WorkflowStatus>(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            [Query.equal("workflowId", workflow.$id)]
          );

          return {
            ...workflow,
            statusCount: statuses.total,
          };
        })
      );

      return c.json({ data: { documents: populatedWorkflows, total: populatedWorkflows.length } });
    }
  )

  // Get allowed transitions from a status
  // NOTE: This route must be defined BEFORE /:workflowId to avoid being caught by the parameterized route
  .get(
    "/allowed-transitions",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workflowId: z.string(),
        fromStatusId: z.string(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workflowId, fromStatusId } = c.req.valid("query");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      const member = await getMember({
        databases,
        workspaceId: workflow.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Get all transitions from this status
      const transitions = await databases.listDocuments<WorkflowTransition>(
        DATABASE_ID,
        WORKFLOW_TRANSITIONS_ID,
        [
          Query.equal("workflowId", workflowId),
          Query.equal("fromStatusId", fromStatusId),
        ]
      );

      // Get user's team memberships for filtering
      const userTeamMemberships = await databases.listDocuments(
        DATABASE_ID,
        PROJECT_TEAM_MEMBERS_ID,
        [Query.equal("userId", user.$id)]
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userTeamIds = userTeamMemberships.documents.map((m) => (m as any).teamId);

      // Filter transitions based on role and team restrictions
      const allowedTransitions = transitions.documents.filter((t) => {
        // Check role restrictions
        if (t.allowedMemberRoles && t.allowedMemberRoles.length > 0) {
          if (!t.allowedMemberRoles.includes(member.role)) {
            return false;
          }
        }

        // Check team restrictions
        if (t.allowedTeamIds && t.allowedTeamIds.length > 0) {
          const hasAllowedTeam = t.allowedTeamIds.some((teamId: string) =>
            userTeamIds.includes(teamId)
          );
          if (!hasAllowedTeam) {
            return false;
          }
        }

        return true;
      });

      // Get the target status details
      const targetStatusIds = allowedTransitions.map((t) => t.toStatusId);
      const targetStatuses =
        targetStatusIds.length > 0
          ? await databases.listDocuments<WorkflowStatus>(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            [Query.equal("$id", targetStatusIds)]
          )
          : { documents: [] };

      const statusMap = new Map(
        targetStatuses.documents.map((s) => [s.$id, s])
      );

      const result = allowedTransitions.map((t) => ({
        ...t,
        toStatus: statusMap.get(t.toStatusId),
        requiresApproval: t.requiresApproval || false,
      }));

      return c.json({ data: result });
    }
  )

  // Get a single workflow with all statuses and transitions
  .get("/:workflowId", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    const member = await getMember({
      databases,
      workspaceId: workflow.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const statuses = await databases.listDocuments<WorkflowStatus>(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("workflowId", workflowId), Query.orderAsc("position")]
    );

    const transitions = await databases.listDocuments<WorkflowTransition>(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [Query.equal("workflowId", workflowId)]
    );

    const populatedWorkflow: PopulatedWorkflow = {
      ...workflow,
      statuses: statuses.documents,
      transitions: transitions.documents,
      statusCount: statuses.total,
    };

    return c.json({ data: populatedWorkflow });
  })

  // Update a workflow
  .patch(
    "/:workflowId",
    sessionMiddleware,
    zValidator("json", updateWorkflowSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId } = c.req.param();

      const updates = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      if (workflow.isSystem) {
        return c.json({ error: "Cannot modify system workflows" }, 400);
      }

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can update workflows" }, 403);
      }

      const updatedWorkflow = await databases.updateDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId,
        updates
      );

      return c.json({ data: updatedWorkflow });
    }
  )

  // Delete a workflow
  .delete("/:workflowId", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    if (workflow.isSystem) {
      return c.json({ error: "Cannot delete system workflows" }, 400);
    }

    const { hasPermission } = await checkWorkflowPermission(
      databases,
      workflow.workspaceId,
      user.$id,
      workflow.spaceId
    );

    if (!hasPermission) {
      return c.json({ error: "Only workspace owners, admins, or space masters can delete workflows" }, 403);
    }

    // Delete all statuses and transitions
    const statuses = await databases.listDocuments<WorkflowStatus>(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("workflowId", workflowId)]
    );

    const transitions = await databases.listDocuments<WorkflowTransition>(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [Query.equal("workflowId", workflowId)]
    );

    await Promise.all([
      ...statuses.documents.map((s) =>
        databases.deleteDocument(DATABASE_ID, WORKFLOW_STATUSES_ID, s.$id)
      ),
      ...transitions.documents.map((t) =>
        databases.deleteDocument(DATABASE_ID, WORKFLOW_TRANSITIONS_ID, t.$id)
      ),
    ]);

    await databases.deleteDocument(DATABASE_ID, WORKFLOWS_ID, workflowId);

    return c.json({ data: { $id: workflowId } });
  })

  // ============ Status endpoints ============

  // Add a status to a workflow
  .post(
    "/:workflowId/statuses",
    sessionMiddleware,
    zValidator("json", createWorkflowStatusSchema.omit({ workflowId: true })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId } = c.req.param();

      const statusData = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      if (workflow.isSystem) {
        return c.json({ error: "Cannot modify system workflows" }, 400);
      }

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can add statuses" }, 403);
      }

      // Check for duplicate key
      const existingStatuses = await databases.listDocuments<WorkflowStatus>(
        DATABASE_ID,
        WORKFLOW_STATUSES_ID,
        [Query.equal("workflowId", workflowId), Query.equal("key", statusData.key)]
      );

      if (existingStatuses.total > 0) {
        return c.json({ error: "Status key already exists in this workflow" }, 400);
      }

      // Get max position if not provided
      let position = statusData.position;
      if (position === undefined) {
        const allStatuses = await databases.listDocuments<WorkflowStatus>(
          DATABASE_ID,
          WORKFLOW_STATUSES_ID,
          [Query.equal("workflowId", workflowId), Query.orderDesc("position")]
        );
        position = (allStatuses.documents[0]?.position ?? -1) + 1;
      }

      const status = await databases.createDocument<WorkflowStatus>(
        DATABASE_ID,
        WORKFLOW_STATUSES_ID,
        ID.unique(),
        {
          workflowId,
          name: statusData.name,
          key: statusData.key,
          icon: statusData.icon || "Circle",
          color: statusData.color,
          statusType: statusData.statusType || StatusType.OPEN,
          description: statusData.description || null,
          position,
          positionX: statusData.positionX || 0,
          positionY: statusData.positionY || 0,
          isInitial: statusData.isInitial || false,
          isFinal: statusData.isFinal || false,
        }
      );

      // Auto-sync: Create custom columns in all projects that use this workflow
      try {
        const projectsUsingWorkflow = await databases.listDocuments(
          DATABASE_ID,
          PROJECTS_ID,
          [Query.equal("workflowId", workflowId)]
        );

        // Create custom column for each project using this workflow
        for (const project of projectsUsingWorkflow.documents) {
          // Check if custom column already exists for this project with the same name
          const existingColumns = await databases.listDocuments(
            DATABASE_ID,
            CUSTOM_COLUMNS_ID,
            [
              Query.equal("projectId", project.$id),
              Query.equal("name", statusData.name)
            ]
          );

          if (existingColumns.total === 0) {
            // Get max position for this project's columns
            const projectColumns = await databases.listDocuments(
              DATABASE_ID,
              CUSTOM_COLUMNS_ID,
              [
                Query.equal("projectId", project.$id),
                Query.orderDesc("position"),
                Query.limit(1)
              ]
            );
            const columnPosition = projectColumns.documents.length > 0 
              ? projectColumns.documents[0].position + 1000 
              : 1000;

            await databases.createDocument(
              DATABASE_ID,
              CUSTOM_COLUMNS_ID,
              ID.unique(),
              {
                name: statusData.name,
                workspaceId: workflow.workspaceId,
                projectId: project.$id,
                icon: statusData.icon || "Circle",
                color: statusData.color,
                position: columnPosition,
              }
            );
          }
        }
      } catch (syncError) {
        // Log but don't fail the main operation
        console.error("Error syncing workflow status to project columns:", syncError);
      }

      return c.json({ data: status });
    }
  )

  // Get all statuses for a workflow
  .get("/:workflowId/statuses", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    const member = await getMember({
      databases,
      workspaceId: workflow.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const statuses = await databases.listDocuments<WorkflowStatus>(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("workflowId", workflowId), Query.orderAsc("position")]
    );

    return c.json({ data: statuses });
  })

  // Update a status
  .patch(
    "/:workflowId/statuses/:statusId",
    sessionMiddleware,
    zValidator("json", updateWorkflowStatusSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId, statusId } = c.req.param();

      const updates = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      if (workflow.isSystem) {
        return c.json({ error: "Cannot modify system workflows" }, 400);
      }

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can update statuses" }, 403);
      }

      const updatedStatus = await databases.updateDocument<WorkflowStatus>(
        DATABASE_ID,
        WORKFLOW_STATUSES_ID,
        statusId,
        updates
      );

      return c.json({ data: updatedStatus });
    }
  )

  // Delete a status
  .delete("/:workflowId/statuses/:statusId", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId, statusId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    if (workflow.isSystem) {
      return c.json({ error: "Cannot modify system workflows" }, 400);
    }

    const { hasPermission } = await checkWorkflowPermission(
      databases,
      workflow.workspaceId,
      user.$id,
      workflow.spaceId
    );

    if (!hasPermission) {
      return c.json({ error: "Only workspace owners, admins, or space masters can delete statuses" }, 403);
    }

    // Delete associated transitions
    const transitions = await databases.listDocuments<WorkflowTransition>(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [
        Query.equal("workflowId", workflowId),
        Query.or([
          Query.equal("fromStatusId", statusId),
          Query.equal("toStatusId", statusId),
        ]),
      ]
    );

    await Promise.all(
      transitions.documents.map((t) =>
        databases.deleteDocument(DATABASE_ID, WORKFLOW_TRANSITIONS_ID, t.$id)
      )
    );

    await databases.deleteDocument(DATABASE_ID, WORKFLOW_STATUSES_ID, statusId);

    return c.json({ data: { $id: statusId } });
  })

  // ============ Transition endpoints ============

  // Add a transition
  .post(
    "/:workflowId/transitions",
    sessionMiddleware,
    zValidator("json", createWorkflowTransitionSchema.omit({ workflowId: true })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId } = c.req.param();

      const transitionData = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      if (workflow.isSystem) {
        return c.json({ error: "Cannot modify system workflows" }, 400);
      }

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can add transitions" }, 403);
      }

      // Check if transition already exists
      const existingTransitions = await databases.listDocuments<WorkflowTransition>(
        DATABASE_ID,
        WORKFLOW_TRANSITIONS_ID,
        [
          Query.equal("workflowId", workflowId),
          Query.equal("fromStatusId", transitionData.fromStatusId),
          Query.equal("toStatusId", transitionData.toStatusId),
        ]
      );

      if (existingTransitions.total > 0) {
        return c.json({ error: "Transition already exists" }, 400);
      }

      const transition = await databases.createDocument<WorkflowTransition>(
        DATABASE_ID,
        WORKFLOW_TRANSITIONS_ID,
        ID.unique(),
        {
          workflowId,
          fromStatusId: transitionData.fromStatusId,
          toStatusId: transitionData.toStatusId,
          name: transitionData.name || null,
          description: transitionData.description || null,
          allowedTeamIds: transitionData.allowedTeamIds || null,
          allowedMemberRoles: transitionData.allowedMemberRoles || null,
          requiresApproval: transitionData.requiresApproval || false,
          approverTeamIds: transitionData.approverTeamIds || null,
        }
      );

      return c.json({ data: transition });
    }
  )

  // Get all transitions for a workflow
  .get("/:workflowId/transitions", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    const member = await getMember({
      databases,
      workspaceId: workflow.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const transitions = await databases.listDocuments<WorkflowTransition>(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [Query.equal("workflowId", workflowId)]
    );

    return c.json({ data: transitions });
  })

  // Update a transition
  .patch(
    "/:workflowId/transitions/:transitionId",
    sessionMiddleware,
    zValidator("json", updateWorkflowTransitionSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId, transitionId } = c.req.param();

      const updates = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      if (workflow.isSystem) {
        return c.json({ error: "Cannot modify system workflows" }, 400);
      }

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can update transitions" }, 403);
      }

      const updatedTransition = await databases.updateDocument<WorkflowTransition>(
        DATABASE_ID,
        WORKFLOW_TRANSITIONS_ID,
        transitionId,
        updates
      );

      return c.json({ data: updatedTransition });
    }
  )

  // Delete a transition
  .delete("/:workflowId/transitions/:transitionId", sessionMiddleware, async (c) => {
    const databases = c.get("databases");
    const user = c.get("user");
    const { workflowId, transitionId } = c.req.param();

    const workflow = await databases.getDocument<Workflow>(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    );

    if (workflow.isSystem) {
      return c.json({ error: "Cannot modify system workflows" }, 400);
    }

    const { hasPermission } = await checkWorkflowPermission(
      databases,
      workflow.workspaceId,
      user.$id,
      workflow.spaceId
    );

    if (!hasPermission) {
      return c.json({ error: "Only workspace owners, admins, or space masters can delete transitions" }, 403);
    }

    await databases.deleteDocument(DATABASE_ID, WORKFLOW_TRANSITIONS_ID, transitionId);

    return c.json({ data: { $id: transitionId } });
  })

  // ============ Transition validation ============

  // Validate if a transition is allowed
  .post(
    "/validate-transition",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        workflowId: z.string(),
        fromStatusId: z.string(),
        toStatusId: z.string(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workflowId, fromStatusId, toStatusId } = c.req.valid("json");

      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      const member = await getMember({
        databases,
        workspaceId: workflow.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Check if transition exists
      const transition = await databases.listDocuments<WorkflowTransition>(
        DATABASE_ID,
        WORKFLOW_TRANSITIONS_ID,
        [
          Query.equal("workflowId", workflowId),
          Query.equal("fromStatusId", fromStatusId),
          Query.equal("toStatusId", toStatusId),
        ]
      );

      if (transition.total === 0) {
        return c.json({
          data: {
            allowed: false,
            reason: "TRANSITION_NOT_ALLOWED",
            message: "This status transition is not allowed in this workflow",
          },
        });
      }

      const transitionDoc = transition.documents[0];

      // Check role restrictions (using new allowedMemberRoles)
      if (transitionDoc.allowedMemberRoles && transitionDoc.allowedMemberRoles.length > 0) {
        if (!transitionDoc.allowedMemberRoles.includes(member.role)) {
          return c.json({
            data: {
              allowed: false,
              reason: "ROLE_NOT_ALLOWED",
              message: "Your role does not have permission for this transition",
            },
          });
        }
      }

      // Check team restrictions
      if (transitionDoc.allowedTeamIds && transitionDoc.allowedTeamIds.length > 0) {
        // Get user's team memberships
        const userTeamMemberships = await databases.listDocuments(
          DATABASE_ID,
          PROJECT_TEAM_MEMBERS_ID,
          [Query.equal("userId", user.$id)]
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userTeamIds = userTeamMemberships.documents.map((m) => (m as any).teamId);
        const hasAllowedTeam = transitionDoc.allowedTeamIds.some((teamId: string) =>
          userTeamIds.includes(teamId)
        );

        if (!hasAllowedTeam) {
          return c.json({
            data: {
              allowed: false,
              reason: "TEAM_NOT_ALLOWED",
              message: "Your team does not have permission for this transition",
            },
          });
        }
      }

      // Check if requires approval
      if (transitionDoc.requiresApproval) {
        // Check if user is in an approver team
        const userTeamMemberships = await databases.listDocuments(
          DATABASE_ID,
          PROJECT_TEAM_MEMBERS_ID,
          [Query.equal("userId", user.$id)]
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userTeamIds = userTeamMemberships.documents.map((m) => (m as any).teamId);
        const isApprover = transitionDoc.approverTeamIds?.some((teamId: string) =>
          userTeamIds.includes(teamId)
        );

        if (!isApprover) {
          return c.json({
            data: {
              allowed: false,
              reason: "REQUIRES_APPROVAL",
              message: "This transition requires approval from designated teams",
              approverTeamIds: transitionDoc.approverTeamIds,
            },
          });
        }
      }

      return c.json({
        data: {
          allowed: true,
          transition: transitionDoc,
        },
      });
    }
  )

  // ============ Connect project to workflow ============
  .post(
    "/:workflowId/connect-project/:projectId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId, projectId } = c.req.param();

      // Get the workflow
      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can connect projects to workflows" }, 403);
      }

      // Get the project
      const project = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      if (project.workspaceId !== workflow.workspaceId) {
        return c.json({ error: "Project and workflow must be in the same workspace" }, 400);
      }

      // Update the project to use this workflow
      const updatedProject = await databases.updateDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
        {
          workflowId: workflowId,
        }
      );

      return c.json({
        data: {
          project: updatedProject,
          workflow: workflow,
        },
      });
    }
  )

  // ============ Sync workflow and project statuses with conflict resolution ============
  .post(
    "/:workflowId/sync-with-resolution/:projectId",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        resolution: z.enum(["workflow", "project"]),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId, projectId } = c.req.param();
      const { resolution } = c.req.valid("json");

      // Get the workflow with statuses
      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      const { hasPermission } = await checkWorkflowPermission(
        databases,
        workflow.workspaceId,
        user.$id,
        workflow.spaceId
      );

      if (!hasPermission) {
        return c.json({ error: "Only workspace owners, admins, or space masters can sync workflow and project" }, 403);
      }

      // Get workflow statuses
      const workflowStatuses = await databases.listDocuments<WorkflowStatus>(
        DATABASE_ID,
        WORKFLOW_STATUSES_ID,
        [Query.equal("workflowId", workflowId), Query.orderAsc("position")]
      );

      // Get the project
      const project = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      if (project.workspaceId !== workflow.workspaceId) {
        return c.json({ error: "Project and workflow must be in the same workspace" }, 400);
      }

      // Get project's customWorkItemTypes (legacy/inline storage)
      const projectCustomTypes = (project.customWorkItemTypes || []) as Array<{
        key: string;
        label: string;
        icon: string;
        color: string;
        visible?: boolean;
      }>;

      // Get custom columns from the database
      const projectCustomColumns = await databases.listDocuments(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        [
          Query.equal("workspaceId", workflow.workspaceId),
          Query.equal("projectId", projectId),
          Query.orderAsc("position"),
        ]
      );

      // Get default column settings (to check which columns are hidden/enabled)
      const defaultColumnSettings = await databases.listDocuments(
        DATABASE_ID,
        DEFAULT_COLUMN_SETTINGS_ID,
        [
          Query.equal("workspaceId", workflow.workspaceId),
          Query.equal("projectId", projectId),
        ]
      );

      // Build a map of column visibility from default settings
      const columnVisibility = new Map<string, boolean>();
      for (const setting of defaultColumnSettings.documents) {
        columnVisibility.set(setting.columnId, setting.isEnabled);
      }

      // Helper function to normalize status key for matching
      const normalizeKey = (name: string): string => {
        return name.toLowerCase().replace(/[\s_-]+/g, "_").toUpperCase();
      };

      // Helper function to find matching workflow status
      const findMatchingWorkflowStatus = (
        name: string,
        key: string
      ): WorkflowStatus | undefined => {
        // First try exact key match
        let match = workflowStatuses.documents.find(s => s.key === key);
        if (match) return match;

        // Try normalized key match
        const normalizedKey = normalizeKey(name);
        match = workflowStatuses.documents.find(s => s.key === normalizedKey);
        if (match) return match;

        // Try name match (case insensitive)
        match = workflowStatuses.documents.find(
          s => s.name.toLowerCase() === name.toLowerCase()
        );
        return match;
      };

      if (resolution === "workflow") {
        // =========================================
        // WORKFLOW TAKES PRIORITY
        // =========================================
        // - Sync workflow statuses → project columns
        // - Statuses on canvas become visible columns
        // - Statuses off canvas (0,0) become hidden columns

        const newCustomTypes = workflowStatuses.documents.map((status) => {
          const isOnCanvas =
            (status.positionX !== undefined && status.positionX > 0) ||
            (status.positionY !== undefined && status.positionY > 0);

          return {
            key: status.key,
            label: status.name,
            icon: status.icon,
            color: status.color,
            visible: isOnCanvas,
          };
        });

        // Get existing custom columns for this project
        const existingColumnMap = new Map(
          projectCustomColumns.documents.map(col => [col.name.toLowerCase(), col])
        );

        // Sync custom columns: create new ones or update existing ones
        let position = 1000;
        for (const status of workflowStatuses.documents) {
          const existingColumn = existingColumnMap.get(status.name.toLowerCase());

          if (existingColumn) {
            // Update existing column
            await databases.updateDocument(
              DATABASE_ID,
              CUSTOM_COLUMNS_ID,
              existingColumn.$id,
              {
                icon: status.icon,
                color: status.color,
                position: position,
              }
            );
            existingColumnMap.delete(status.name.toLowerCase());
          } else {
            // Create new column
            await databases.createDocument(
              DATABASE_ID,
              CUSTOM_COLUMNS_ID,
              ID.unique(),
              {
                name: status.name,
                workspaceId: workflow.workspaceId,
                projectId: projectId,
                icon: status.icon,
                color: status.color,
                position: position,
              }
            );
          }
          position += 1000;
        }

        // Delete custom columns that no longer exist in workflow
        for (const [, column] of existingColumnMap) {
          await databases.deleteDocument(
            DATABASE_ID,
            CUSTOM_COLUMNS_ID,
            column.$id
          );
        }

        await databases.updateDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId,
          {
            workflowId: workflowId,
            customWorkItemTypes: JSON.stringify(newCustomTypes),
          }
        );

        return c.json({
          data: {
            message: "Project synced to workflow statuses",
            resolution: "workflow",
            statusCount: newCustomTypes.length,
          },
        });
      } else {
        // =========================================
        // PROJECT TAKES PRIORITY
        // =========================================
        // - Sync project columns → workflow statuses
        // - Add missing statuses to workflow with canvas positions
        // - Update existing statuses visibility based on project column visibility
        // - Hidden columns → status moves off canvas (but not deleted)

        // Default task statuses (always available in projects)
        const DEFAULT_STATUSES = [
          { key: "TODO", label: "To Do", color: "#9CA3AF", icon: "Circle" },
          { key: "ASSIGNED", label: "Assigned", color: "#EF4444", icon: "UserCheck" },
          { key: "IN_PROGRESS", label: "In Progress", color: "#F59E0B", icon: "Clock" },
          { key: "IN_REVIEW", label: "In Review", color: "#3B82F6", icon: "Eye" },
          { key: "DONE", label: "Done", color: "#10B981", icon: "CheckCircle" },
        ];

        // Build comprehensive list of all project statuses from multiple sources
        interface ProjectStatus {
          key: string;
          name: string;
          icon: string;
          color: string;
          isVisible: boolean;
          source: "default" | "customColumn" | "customType";
        }

        const allProjectStatuses: ProjectStatus[] = [];
        const seenNames = new Set<string>();

        // 1. Start with default statuses (these are always present in a project)
        // Check visibility from defaultColumnSettings
        for (const defaultStatus of DEFAULT_STATUSES) {
          const normalizedName = defaultStatus.label.toLowerCase();
          // Check if this default column is enabled (visible)
          // If no setting exists, default to visible (true)
          const isVisible = columnVisibility.has(defaultStatus.key)
            ? columnVisibility.get(defaultStatus.key)
            : true;

          if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            allProjectStatuses.push({
              key: defaultStatus.key,
              name: defaultStatus.label,
              icon: defaultStatus.icon,
              color: defaultStatus.color,
              isVisible: isVisible !== false,
              source: "default",
            });
          }
        }

        // 2. Add custom columns from the database (may override defaults or add new ones)
        for (const col of projectCustomColumns.documents) {
          const normalizedName = col.name.toLowerCase();
          // Check if this name matches a default status (to update it)
          const existingIndex = allProjectStatuses.findIndex(
            s => s.name.toLowerCase() === normalizedName
          );

          if (existingIndex >= 0) {
            // Update existing status with custom column properties
            allProjectStatuses[existingIndex] = {
              ...allProjectStatuses[existingIndex],
              icon: col.icon || allProjectStatuses[existingIndex].icon,
              color: col.color || allProjectStatuses[existingIndex].color,
              source: "customColumn",
            };
          } else if (!seenNames.has(normalizedName)) {
            // Add as new custom column
            seenNames.add(normalizedName);
            allProjectStatuses.push({
              key: normalizeKey(col.name),
              name: col.name,
              icon: col.icon || "Circle",
              color: col.color || "#6B7280",
              isVisible: true,
              source: "customColumn",
            });
          }
        }

        // 3. Add project's customWorkItemTypes (may override or add new ones)
        for (const type of projectCustomTypes) {
          // Skip entries with missing or invalid label
          if (!type.label || typeof type.label !== 'string') {
            console.warn('Skipping customWorkItemType with invalid label:', type);
            continue;
          }

          const normalizedName = type.label.toLowerCase();
          const existingIndex = allProjectStatuses.findIndex(
            s => s.name.toLowerCase() === normalizedName
          );

          if (existingIndex >= 0) {
            // Update existing status
            allProjectStatuses[existingIndex] = {
              ...allProjectStatuses[existingIndex],
              icon: type.icon || allProjectStatuses[existingIndex].icon,
              color: type.color || allProjectStatuses[existingIndex].color,
              isVisible: type.visible !== false,
              source: "customType",
            };
          } else if (!seenNames.has(normalizedName)) {
            // Add as new custom type
            seenNames.add(normalizedName);
            allProjectStatuses.push({
              key: type.key,
              name: type.label,
              icon: type.icon || "Circle",
              color: type.color || "#6B7280",
              isVisible: type.visible !== false,
              source: "customType",
            });
          }
        }

        // Track statistics
        let addedCount = 0;
        let updatedCount = 0;

        // Calculate base canvas position for new statuses
        let maxX = 100;
        let maxY = 100;
        for (const status of workflowStatuses.documents) {
          if (status.positionX && status.positionX > maxX) maxX = status.positionX;
          if (status.positionY && status.positionY > maxY) maxY = status.positionY;
        }
        let newStatusOffsetY = 0;

        // Process each project status
        for (const projectStatus of allProjectStatuses) {
          const existingWorkflowStatus = findMatchingWorkflowStatus(
            projectStatus.name,
            projectStatus.key
          );

          if (existingWorkflowStatus) {
            // Status exists in workflow - update visibility based on project
            const shouldBeOnCanvas = projectStatus.isVisible;
            const isCurrentlyOnCanvas =
              (existingWorkflowStatus.positionX !== undefined && existingWorkflowStatus.positionX > 0) ||
              (existingWorkflowStatus.positionY !== undefined && existingWorkflowStatus.positionY > 0);

            if (shouldBeOnCanvas !== isCurrentlyOnCanvas) {
              // Need to update canvas position
              if (shouldBeOnCanvas && !isCurrentlyOnCanvas) {
                // Move onto canvas
                await databases.updateDocument(
                  DATABASE_ID,
                  WORKFLOW_STATUSES_ID,
                  existingWorkflowStatus.$id,
                  {
                    positionX: maxX + 250,
                    positionY: 100 + newStatusOffsetY,
                    icon: projectStatus.icon,
                    color: projectStatus.color,
                  }
                );
                newStatusOffsetY += 150;
                updatedCount++;
              } else if (!shouldBeOnCanvas && isCurrentlyOnCanvas) {
                // Move off canvas (hide)
                await databases.updateDocument(
                  DATABASE_ID,
                  WORKFLOW_STATUSES_ID,
                  existingWorkflowStatus.$id,
                  {
                    positionX: 0,
                    positionY: 0,
                  }
                );
                updatedCount++;
              }
            }
          } else {
            // Status doesn't exist in workflow - create it
            const newPosition = workflowStatuses.total + addedCount;

            await databases.createDocument<WorkflowStatus>(
              DATABASE_ID,
              WORKFLOW_STATUSES_ID,
              ID.unique(),
              {
                workflowId,
                name: projectStatus.name,
                key: projectStatus.key,
                icon: projectStatus.icon,
                color: projectStatus.color,
                statusType: StatusType.OPEN,
                description: null,
                position: newPosition,
                // If visible, place on canvas; otherwise off canvas
                positionX: projectStatus.isVisible ? maxX + 250 : 0,
                positionY: projectStatus.isVisible ? 100 + newStatusOffsetY : 0,
                isInitial: false,
                isFinal: false,
              }
            );

            if (projectStatus.isVisible) {
              newStatusOffsetY += 150;
            }
            addedCount++;
          }
        }

        // Update project to use this workflow
        await databases.updateDocument(
          DATABASE_ID,
          PROJECTS_ID,
          projectId,
          {
            workflowId: workflowId,
          }
        );

        return c.json({
          data: {
            message: "Workflow synced from project statuses",
            resolution: "project",
            addedStatuses: addedCount,
            updatedStatuses: updatedCount,
          },
        });
      }
    }
  )

  // ============ Disconnect project from workflow ============
  .post(
    "/:workflowId/disconnect-project/:projectId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workflowId, projectId } = c.req.param();

      // Get the workflow
      const workflow = await databases.getDocument<Workflow>(
        DATABASE_ID,
        WORKFLOWS_ID,
        workflowId
      );

      const member = await getMember({
        databases,
        workspaceId: workflow.workspaceId,
        userId: user.$id,
      });

      if (!member || member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Only admins can disconnect projects from workflows" }, 403);
      }

      // Update the project to remove workflow connection
      const updatedProject = await databases.updateDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
        {
          workflowId: null,
        }
      );

      return c.json({
        data: {
          project: updatedProject,
        },
      });
    }
  )

  // ============ Get workflow statuses for a project ============
  .get(
    "/project/:projectId/statuses",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId } = c.req.param();

      // Get the project
      const project = await databases.getDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // If project has a workflow, get its statuses
      if (project.workflowId) {
        const statuses = await databases.listDocuments<WorkflowStatus>(
          DATABASE_ID,
          WORKFLOW_STATUSES_ID,
          [Query.equal("workflowId", project.workflowId), Query.orderAsc("position")]
        );

        return c.json({
          data: {
            statuses: statuses.documents,
            workflowId: project.workflowId,
          }
        });
      }

      // No workflow connected - return default statuses
      const defaultStatuses = [
        { $id: "TODO", name: "To Do", key: "TODO", icon: "Circle", color: "#6B7280", statusType: StatusType.OPEN, position: 0, isInitial: true, isFinal: false },
        { $id: "ASSIGNED", name: "Assigned", key: "ASSIGNED", icon: "UserCheck", color: "#F59E0B", statusType: StatusType.OPEN, position: 1, isInitial: false, isFinal: false },
        { $id: "IN_PROGRESS", name: "In Progress", key: "IN_PROGRESS", icon: "Clock", color: "#3B82F6", statusType: StatusType.IN_PROGRESS, position: 2, isInitial: false, isFinal: false },
        { $id: "IN_REVIEW", name: "In Review", key: "IN_REVIEW", icon: "Eye", color: "#8B5CF6", statusType: StatusType.IN_PROGRESS, position: 3, isInitial: false, isFinal: false },
        { $id: "DONE", name: "Done", key: "DONE", icon: "CheckCircle", color: "#10B981", statusType: StatusType.CLOSED, position: 4, isInitial: false, isFinal: true },
      ];

      return c.json({
        data: {
          statuses: defaultStatuses,
          workflowId: null,
        }
      });
    }
  );

export default app;