import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query, Permission, Role } from "node-appwrite";
import { z } from "zod";

import { createSessionClient } from "@/lib/appwrite";
import { DATABASE_ID, CUSTOM_COLUMNS_ID, PROJECTS_ID, WORKFLOW_STATUSES_ID, WORKFLOW_TRANSITIONS_ID } from "@/config";

import { createCustomColumnSchema, updateCustomColumnSchema } from "../schemas";

// Query schema for GET - supports both projectId and workflowId
const getCustomColumnsQuerySchema = z.object({
  workspaceId: z.string(),
  projectId: z.string().optional(),
  workflowId: z.string().optional(),
});

const app = new Hono()
  .get(
    "/",
    zValidator("query", getCustomColumnsQuerySchema),
    async (c) => {
      const { workspaceId, projectId, workflowId } = c.req.valid("query");

      const { databases } = await createSessionClient();

      const queries = [
        Query.equal("workspaceId", workspaceId),
        Query.orderAsc("position"),
      ];

      // Filter by projectId or workflowId
      if (projectId) {
        queries.push(Query.equal("projectId", projectId));
      }
      if (workflowId) {
        queries.push(Query.equal("workflowId", workflowId));
      }

      const customColumns = await databases.listDocuments(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        queries
      );

      return c.json({ data: customColumns });
    }
  )
  .post(
    "/",
    zValidator("json", createCustomColumnSchema),
    async (c) => {
      const { name, workspaceId, projectId, workflowId, icon, color, position } = c.req.valid("json");

      const { databases, account } = await createSessionClient();
      const user = await account.get();

      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.write(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ];

      // Build query based on projectId or workflowId
      const filterQueries = [Query.equal("workspaceId", workspaceId)];
      if (projectId) {
        filterQueries.push(Query.equal("projectId", projectId));
      }
      if (workflowId) {
        filterQueries.push(Query.equal("workflowId", workflowId));
      }

      // If no position provided, get the highest position + 1000
      let finalPosition = position;
      if (finalPosition === undefined) {
        const existingColumns = await databases.listDocuments(
          DATABASE_ID,
          CUSTOM_COLUMNS_ID,
          [
            ...filterQueries,
            Query.orderDesc("position"),
            Query.limit(1),
          ]
        );

        finalPosition = existingColumns.documents.length > 0 
          ? existingColumns.documents[0].position + 1000 
          : 1000;
      }

      const documentData: Record<string, unknown> = {
        name,
        workspaceId,
        icon,
        color,
        position: finalPosition,
      };

      // Only set projectId or workflowId if provided
      if (projectId) {
        documentData.projectId = projectId;
      }
      if (workflowId) {
        documentData.workflowId = workflowId;
      }

      const customColumn = await databases.createDocument(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        ID.unique(),
        documentData,
        permissions
      );

      // Auto-sync: If this is a project column and the project has a workflow, create a workflow status
      if (projectId && !workflowId) {
        try {
          // Get the project to check if it has a workflowId
          const project = await databases.getDocument(
            DATABASE_ID,
            PROJECTS_ID,
            projectId
          );

          if (project.workflowId) {
            // Check if status already exists in workflow with the same name or key
            const normalizedKey = name.toLowerCase().replace(/[\s_-]+/g, "_").toUpperCase();
            const existingStatuses = await databases.listDocuments(
              DATABASE_ID,
              WORKFLOW_STATUSES_ID,
              [
                Query.equal("workflowId", project.workflowId),
                Query.or([
                  Query.equal("name", name),
                  Query.equal("key", normalizedKey)
                ])
              ]
            );

            if (existingStatuses.total === 0) {
              // Get max position for workflow statuses
              const workflowStatuses = await databases.listDocuments(
                DATABASE_ID,
                WORKFLOW_STATUSES_ID,
                [
                  Query.equal("workflowId", project.workflowId),
                  Query.orderDesc("position"),
                  Query.limit(1)
                ]
              );
              const statusPosition = workflowStatuses.documents.length > 0 
                ? workflowStatuses.documents[0].position + 1 
                : 0;

              // Create the workflow status
              await databases.createDocument(
                DATABASE_ID,
                WORKFLOW_STATUSES_ID,
                ID.unique(),
                {
                  workspaceId,
                  workflowId: project.workflowId,
                  name: name,
                  key: normalizedKey,
                  icon: icon || "Circle",
                  color: color || "#6B7280",
                  statusType: "OPEN",
                  description: "",
                  position: statusPosition,
                  positionX: 100 + (statusPosition * 180), // Place new statuses on canvas
                  positionY: 100,
                  isInitial: false,
                  isFinal: false,
                },
                permissions
              );
            }
          }
        } catch (syncError) {
          // Log but don't fail the main operation
          console.error("Error syncing custom column to workflow status:", syncError);
        }
      }

      return c.json({ data: customColumn });
    }
  )
  .patch(
    "/:customColumnId",
    zValidator("json", updateCustomColumnSchema),
    async (c) => {
      const customColumnId = c.req.param("customColumnId");
      const updates = c.req.valid("json");

      const { databases } = await createSessionClient();

      const customColumn = await databases.updateDocument(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        customColumnId,
        updates
      );

      return c.json({ data: customColumn });
    }
  )
  .delete("/:customColumnId", async (c) => {
    const customColumnId = c.req.param("customColumnId");

    const { databases } = await createSessionClient();

    // Get the custom column before deleting to know its name/projectId
    let columnName: string | null = null;
    let columnProjectId: string | null = null;
    
    try {
      const customColumn = await databases.getDocument(
        DATABASE_ID,
        CUSTOM_COLUMNS_ID,
        customColumnId
      );
      columnName = customColumn.name;
      columnProjectId = customColumn.projectId;
    } catch {
      // Column might not exist, continue with delete attempt
    }

    // Delete the custom column
    await databases.deleteDocument(
      DATABASE_ID,
      CUSTOM_COLUMNS_ID,
      customColumnId
    );

    // Auto-sync: If this was a project column and the project has a workflow, cleanup the workflow status
    if (columnName && columnProjectId) {
      try {
        // Get the project to check if it has a workflowId
        const project = await databases.getDocument(
          DATABASE_ID,
          PROJECTS_ID,
          columnProjectId
        );

        if (project.workflowId) {
          // Find the matching workflow status by name or key
          const normalizedKey = columnName.toLowerCase().replace(/[\s_-]+/g, "_").toUpperCase();
          const matchingStatuses = await databases.listDocuments(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            [
              Query.equal("workflowId", project.workflowId),
              Query.or([
                Query.equal("name", columnName),
                Query.equal("key", normalizedKey)
              ])
            ]
          );

          // Delete matching workflow statuses and their transitions
          for (const status of matchingStatuses.documents) {
            // First, delete all transitions to/from this status
            const relatedTransitions = await databases.listDocuments(
              DATABASE_ID,
              WORKFLOW_TRANSITIONS_ID,
              [
                Query.equal("workflowId", project.workflowId),
                Query.or([
                  Query.equal("fromStatusId", status.$id),
                  Query.equal("toStatusId", status.$id)
                ])
              ]
            );

            for (const transition of relatedTransitions.documents) {
              try {
                await databases.deleteDocument(
                  DATABASE_ID,
                  WORKFLOW_TRANSITIONS_ID,
                  transition.$id
                );
              } catch {
                // Transition may have already been deleted
              }
            }

            // Then delete the workflow status
            try {
              await databases.deleteDocument(
                DATABASE_ID,
                WORKFLOW_STATUSES_ID,
                status.$id
              );
            } catch {
              // Status may have already been deleted
            }
          }
        }
      } catch (syncError) {
        // Log but don't fail the main operation - column is already deleted
        console.error("Error cleaning up workflow status after column delete:", syncError);
      }
    }

    return c.json({ data: { $id: customColumnId } });
  });

export default app;
